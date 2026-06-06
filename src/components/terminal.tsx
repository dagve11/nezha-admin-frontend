import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import useTerminal from "@/hooks/useTerminal"
import { cn, sleep } from "@/lib/utils"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { Expand, FolderClosed, Minus, Plus, Terminal as TerminalIcon } from "lucide-react"
import {
    JSX,
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import { toast } from "sonner"

import { FMCard } from "./fm"
import { Button } from "./ui/button"
import { IconButton } from "./xui/icon-button"

interface XtermProps {
    wsUrl: string
    setClose: React.Dispatch<React.SetStateAction<boolean>>
    fontSize?: number
}

const TERMINAL_FONT_SIZE_DEFAULT = 16
const TERMINAL_FONT_SIZE_MIN = 12
const TERMINAL_FONT_SIZE_MAX = 24
const TERMINAL_INPUT_COMMAND = 0
const TERMINAL_RESIZE_COMMAND = 1
const IME_PENDING_INPUT_BLOCK_MS = 100
const CLAUDE_CODE_INPUT_PROMPT_SCAN_ROWS = 4
const textEncoder = new TextEncoder()

const isImeKeyboardEvent = (event: KeyboardEvent) => {
    return (
        event.isComposing ||
        event.key === "Process" ||
        event.key === "Unidentified" ||
        event.keyCode === 229 ||
        event.which === 229
    )
}

const createTerminalFrame = (command: number, payload: Uint8Array) => {
    const message = new Uint8Array(1 + payload.length)
    message[0] = command
    message.set(payload, 1)
    return message
}

const encodeBinaryString = (data: string) => {
    const bytes = new Uint8Array(data.length)
    for (let index = 0; index < data.length; index += 1) {
        bytes[index] = data.charCodeAt(index) & 0xff
    }
    return bytes
}

const setStyleValue = (element: HTMLElement, property: string, value: string) => {
    if (element.style.getPropertyValue(property) !== value) {
        element.style.setProperty(property, value)
    }
}

const getTerminalBufferLine = (terminal: Terminal, viewportRow: number) => {
    const activeBuffer = terminal.buffer.active
    return activeBuffer.getLine(activeBuffer.baseY + viewportRow)
}

const getTerminalBufferLineText = (terminal: Terminal, viewportRow: number) => {
    const line = getTerminalBufferLine(terminal, viewportRow)
    return line?.translateToString(true) ?? ""
}

const isWideTerminalCharacter = (codePoint: number) => {
    return (
        codePoint >= 0x1100 &&
        (codePoint <= 0x115f ||
            codePoint === 0x2329 ||
            codePoint === 0x232a ||
            (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
            (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
            (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
            (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
            (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
            (codePoint >= 0xff00 && codePoint <= 0xff60) ||
            (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
            (codePoint >= 0x20000 && codePoint <= 0x3fffd))
    )
}

const getTerminalDisplayWidth = (value: string) => {
    let width = 0

    for (const character of value) {
        const codePoint = character.codePointAt(0)
        if (codePoint === undefined) continue

        if (codePoint >= 0x300 && codePoint <= 0x36f) continue
        width += isWideTerminalCharacter(codePoint) ? 2 : 1
    }

    return width
}

const getTerminalBufferLineDisplayWidth = (
    terminal: Terminal,
    viewportRow: number,
    fallbackText: string,
) => {
    const line = getTerminalBufferLine(terminal, viewportRow)
    if (!line) return getTerminalDisplayWidth(fallbackText)

    const maxColumn = Math.min(line.length, terminal.cols)
    for (let column = maxColumn - 1; column >= 0; column -= 1) {
        const cell = line.getCell(column)
        if (!cell?.getChars()) continue

        return column + Math.max(cell.getWidth(), 1)
    }

    return 0
}

const isClaudeCodeFooterLine = (line: string) => {
    return (
        (line.includes("for shortcuts") && line.includes("for agents")) ||
        (line.includes("shortcuts") && line.trimStart().startsWith("?"))
    )
}

const isClaudeCodeVisible = (terminal: Terminal) => {
    for (let row = 0; row < terminal.rows; row += 1) {
        if (getTerminalBufferLineText(terminal, row).includes("Claude Code")) return true
    }

    return false
}

const getClaudeCodePromptIndex = (line: string) => {
    const match = line.match(/^\s*>\s?/)
    if (!match) return -1

    return match[0].indexOf(">")
}

const isClaudeCodePlaceholderInput = (input: string) => {
    return input.startsWith('Try "')
}

const getClaudeCodePromptAnchorColumn = (
    terminal: Terminal,
    viewportRow: number,
    line: string,
    promptIndex: number,
) => {
    const inputStartIndex = line[promptIndex + 1] === " " ? promptIndex + 2 : promptIndex + 1
    const input = line.slice(inputStartIndex).trimEnd()
    const inputStartColumn = getTerminalDisplayWidth(line.slice(0, inputStartIndex))

    if (!input || isClaudeCodePlaceholderInput(input)) return inputStartColumn

    return Math.max(
        inputStartColumn,
        getTerminalBufferLineDisplayWidth(terminal, viewportRow, line.trimEnd()),
    )
}

const getClaudeCodeWrappedInputAnchor = (terminal: Terminal, viewportRow: number) => {
    const line = getTerminalBufferLine(terminal, viewportRow)
    if (!line?.isWrapped) return undefined

    let promptRow = viewportRow - 1
    while (promptRow >= 0 && getTerminalBufferLine(terminal, promptRow)?.isWrapped) {
        promptRow -= 1
    }
    if (promptRow < 0) return undefined

    const promptLine = getTerminalBufferLineText(terminal, promptRow)
    if (getClaudeCodePromptIndex(promptLine) === -1) return undefined

    const continuationLine = getTerminalBufferLineText(terminal, viewportRow)
    return {
        cursorX: getTerminalBufferLineDisplayWidth(
            terminal,
            viewportRow,
            continuationLine.trimEnd(),
        ),
        cursorY: viewportRow,
    }
}

const findClaudeCodeInputPromptAnchor = (terminal: Terminal, cursorY: number) => {
    const startRow = Math.min(Math.max(cursorY, 0), Math.max(terminal.rows - 1, 0))
    const endRow = Math.max(0, startRow - CLAUDE_CODE_INPUT_PROMPT_SCAN_ROWS)

    for (let row = startRow; row >= endRow; row -= 1) {
        const wrappedAnchor = getClaudeCodeWrappedInputAnchor(terminal, row)
        if (wrappedAnchor) return wrappedAnchor

        const line = getTerminalBufferLineText(terminal, row)
        const promptIndex = getClaudeCodePromptIndex(line)
        if (promptIndex === -1) continue

        return {
            cursorX: getClaudeCodePromptAnchorColumn(terminal, row, line, promptIndex),
            cursorY: row,
        }
    }

    return undefined
}

const getClaudeCodeInputAnchor = (
    terminal: Terminal,
    cursorX: number,
    cursorY: number,
) => {
    const currentLine = getTerminalBufferLineText(terminal, cursorY)
    const shouldUseClaudeInputAnchor =
        isClaudeCodeFooterLine(currentLine) || isClaudeCodeVisible(terminal)
    if (!shouldUseClaudeInputAnchor) return { cursorX, cursorY }

    const promptAnchor = findClaudeCodeInputPromptAnchor(terminal, cursorY)
    if (!promptAnchor) return { cursorX, cursorY }

    return {
        cursorX: Math.min(promptAnchor.cursorX, Math.max(terminal.cols - 1, 0)),
        cursorY: promptAnchor.cursorY,
    }
}

export const XtermComponent = forwardRef<HTMLDivElement, XtermProps & JSX.IntrinsicElements["div"]>(
    ({ wsUrl, setClose, fontSize = TERMINAL_FONT_SIZE_DEFAULT, className, ...props }, ref) => {
        const terminalIdRef = useRef<HTMLDivElement>(null)
        const terminalRef = useRef<Terminal | null>(null)
        const wsRef = useRef<WebSocket | null>(null)
        const isComposingRef = useRef(false)
        const imePendingInputBlockUntilRef = useRef(0)
        const imeAnchorAnimationFrameRef = useRef<number | undefined>(undefined)
        const imeAnchorTimerRef = useRef<number | undefined>(undefined)
        const imeAnchorMutationObserverRef = useRef<MutationObserver | null>(null)

        useImperativeHandle(ref, () => {
            return {
                ...terminalIdRef.current!,
                async requestFullscreen() {
                    await terminalIdRef.current?.requestFullscreen()
                },
            }
        }, [])

        const [fitAddon] = useState(() => new FitAddon())
        const sendResize = useRef(false)

        const resetImeHorizontalScroll = useCallback(() => {
            const container = terminalIdRef.current
            if (!container) return

            const scrollContainers = [
                container,
                container.querySelector<HTMLElement>(".xterm"),
                container.querySelector<HTMLElement>(".xterm-screen"),
                container.querySelector<HTMLElement>(".xterm-viewport"),
            ]

            scrollContainers.forEach((element) => {
                if (element) element.scrollLeft = 0
            })
        }, [])

        const syncImeCompositionAnchor = useCallback(() => {
            if (!isComposingRef.current) return

            resetImeHorizontalScroll()

            const terminal = terminalRef.current
            const container = terminalIdRef.current
            if (!terminal || !container || terminal.cols <= 0 || terminal.rows <= 0) return

            const textarea =
                terminal.textarea ??
                container.querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
            const screenElement = container.querySelector<HTMLElement>(".xterm-screen")
            const helpersElement = container.querySelector<HTMLElement>(".xterm-helpers")
            const compositionView = container.querySelector<HTMLElement>(".composition-view")
            if (!textarea || !screenElement || !compositionView) return

            const screenBounds = screenElement.getBoundingClientRect()
            const screenWidth = screenElement.clientWidth || screenBounds.width
            const screenHeight = screenElement.clientHeight || screenBounds.height
            if (!screenWidth || !screenHeight) return

            const cellWidth = screenWidth / terminal.cols
            const cellHeight = screenHeight / terminal.rows
            const cursorX = Math.min(
                Math.max(terminal.buffer.active.cursorX, 0),
                Math.max(terminal.cols - 1, 0),
            )
            const cursorY = Math.min(
                Math.max(terminal.buffer.active.cursorY, 0),
                Math.max(terminal.rows - 1, 0),
            )
            const imeAnchor = getClaudeCodeInputAnchor(terminal, cursorX, cursorY)
            const cursorLeft = imeAnchor.cursorX * cellWidth
            const cursorTop = imeAnchor.cursorY * cellHeight
            const left = `${cursorLeft}px`
            const top = `${cursorTop}px`
            const width = `${Math.max(cellWidth, 1)}px`
            const height = `${Math.max(cellHeight, 1)}px`

            if (helpersElement) {
                setStyleValue(helpersElement, "left", "0px")
                setStyleValue(helpersElement, "top", "0px")
            }

            screenElement.style.overflowX = "hidden"
            setStyleValue(textarea, "left", left)
            setStyleValue(textarea, "top", top)
            setStyleValue(textarea, "width", width)
            setStyleValue(textarea, "height", height)
            setStyleValue(textarea, "line-height", height)
            setStyleValue(compositionView, "left", left)
            setStyleValue(compositionView, "top", top)
            setStyleValue(compositionView, "height", height)
            setStyleValue(compositionView, "line-height", height)
            setStyleValue(
                compositionView,
                "max-width",
                `${Math.max(screenWidth - cursorLeft, cellWidth)}px`,
            )
            setStyleValue(compositionView, "overflow", "hidden")
        }, [resetImeHorizontalScroll])

        const disconnectImeAnchorObserver = useCallback(() => {
            imeAnchorMutationObserverRef.current?.disconnect()
            imeAnchorMutationObserverRef.current = null
        }, [])

        const observeImeAnchorStyles = useCallback(() => {
            disconnectImeAnchorObserver()

            if (typeof MutationObserver === "undefined") return

            const terminal = terminalRef.current
            const container = terminalIdRef.current
            if (!terminal || !container) return

            const textarea =
                terminal.textarea ??
                container.querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
            const compositionView = container.querySelector<HTMLElement>(".composition-view")
            if (!textarea || !compositionView) return

            const observer = new MutationObserver(() => {
                if (isComposingRef.current) syncImeCompositionAnchor()
            })
            observer.observe(textarea, { attributes: true, attributeFilter: ["style"] })
            observer.observe(compositionView, { attributes: true, attributeFilter: ["style"] })
            imeAnchorMutationObserverRef.current = observer
        }, [disconnectImeAnchorObserver, syncImeCompositionAnchor])

        const cancelQueuedImeAnchorSync = useCallback(() => {
            if (imeAnchorAnimationFrameRef.current !== undefined) {
                if (typeof window.cancelAnimationFrame === "function") {
                    window.cancelAnimationFrame(imeAnchorAnimationFrameRef.current)
                } else {
                    window.clearTimeout(imeAnchorAnimationFrameRef.current)
                }
                imeAnchorAnimationFrameRef.current = undefined
            }

            if (imeAnchorTimerRef.current !== undefined) {
                window.clearTimeout(imeAnchorTimerRef.current)
                imeAnchorTimerRef.current = undefined
            }
        }, [])

        const queueImeAnchorSync = useCallback(() => {
            syncImeCompositionAnchor()
            cancelQueuedImeAnchorSync()

            const runFrameSync = () => {
                imeAnchorAnimationFrameRef.current = undefined
                syncImeCompositionAnchor()
            }
            if (typeof window.requestAnimationFrame === "function") {
                imeAnchorAnimationFrameRef.current = window.requestAnimationFrame(runFrameSync)
            } else {
                imeAnchorAnimationFrameRef.current = window.setTimeout(runFrameSync, 0)
            }

            imeAnchorTimerRef.current = window.setTimeout(() => {
                imeAnchorTimerRef.current = undefined
                syncImeCompositionAnchor()
            }, 0)
        }, [cancelQueuedImeAnchorSync, syncImeCompositionAnchor])

        const handleImeCompositionStart = useCallback(() => {
            isComposingRef.current = true
            imePendingInputBlockUntilRef.current = 0
            observeImeAnchorStyles()
            queueImeAnchorSync()
        }, [observeImeAnchorStyles, queueImeAnchorSync])

        const handleImeCompositionUpdate = useCallback(() => {
            queueImeAnchorSync()
        }, [queueImeAnchorSync])

        const handleImeCompositionEnd = useCallback(() => {
            isComposingRef.current = false
            imePendingInputBlockUntilRef.current = 0
            disconnectImeAnchorObserver()
            cancelQueuedImeAnchorSync()
            resetImeHorizontalScroll()
        }, [cancelQueuedImeAnchorSync, disconnectImeAnchorObserver, resetImeHorizontalScroll])

        const blockImeKeyboardEventForXterm = useCallback((event: KeyboardEvent) => {
            const isPendingImeKey = isImeKeyboardEvent(event)
            if (isPendingImeKey) {
                imePendingInputBlockUntilRef.current = Date.now() + IME_PENDING_INPUT_BLOCK_MS
            }

            return !(isComposingRef.current || isPendingImeKey)
        }, [])

        const shouldBlockTerminalInput = useCallback(() => {
            if (isComposingRef.current) return true
            return imePendingInputBlockUntilRef.current > Date.now()
        }, [])

        const sendFrame = useCallback((command: number, payload: Uint8Array) => {
            const ws = wsRef.current
            if (ws?.readyState !== WebSocket.OPEN) return

            ws.send(createTerminalFrame(command, payload))
        }, [])

        const sendTerminalData = useCallback(
            (data: string) => {
                if (shouldBlockTerminalInput()) return
                sendFrame(TERMINAL_INPUT_COMMAND, textEncoder.encode(data))
            },
            [sendFrame, shouldBlockTerminalInput],
        )

        const sendTerminalBinary = useCallback(
            (data: string) => {
                if (shouldBlockTerminalInput()) return
                sendFrame(TERMINAL_INPUT_COMMAND, encodeBinaryString(data))
            },
            [sendFrame, shouldBlockTerminalInput],
        )

        const doResize = useCallback(() => {
            if (!terminalIdRef.current) return

            fitAddon.fit()

            const dimensions = fitAddon.proposeDimensions()

            if (dimensions) {
                const resizeMessage = textEncoder.encode(
                    JSON.stringify({
                        Rows: dimensions.rows,
                        Cols: dimensions.cols,
                    }),
                )

                sendFrame(TERMINAL_RESIZE_COMMAND, resizeMessage)
            }
        }, [fitAddon, sendFrame])

        const onResize = useCallback(async () => {
            if (sendResize.current) return

            sendResize.current = true
            try {
                await sleep(1500)
                doResize()
            } catch (error) {
                console.error("resize error", error)
            } finally {
                sendResize.current = false
            }
        }, [doResize])

        useEffect(() => {
            const container = terminalIdRef.current
            if (!container) return

            const terminal = new Terminal({
                cursorBlink: true,
                fontSize: TERMINAL_FONT_SIZE_DEFAULT,
            })
            const url = new URL(wsUrl, window.location.origin)
            url.protocol = url.protocol.replace("http", "ws")
            const ws = new WebSocket(url)
            ws.binaryType = "arraybuffer"

            terminalRef.current = terminal
            wsRef.current = ws

            terminal.attachCustomKeyEventHandler(blockImeKeyboardEventForXterm)
            const dataDisposable = terminal.onData(sendTerminalData)
            const binaryDisposable = terminal.onBinary(sendTerminalBinary)
            terminal.loadAddon(fitAddon)
            terminal.open(container)
            fitAddon.fit()
            terminal.focus()
            window.addEventListener("resize", onResize)

            const textarea = terminal.textarea
            textarea?.addEventListener("compositionstart", handleImeCompositionStart)
            textarea?.addEventListener("compositionupdate", handleImeCompositionUpdate)
            textarea?.addEventListener("compositionend", handleImeCompositionEnd)

            ws.onopen = () => {
                onResize()
            }
            ws.onmessage = (event) => {
                const data = event.data
                if (typeof data === "string") {
                    terminal.write(data)
                    return
                }

                if (data instanceof ArrayBuffer) {
                    terminal.write(new Uint8Array(data))
                    return
                }

                if (ArrayBuffer.isView(data)) {
                    terminal.write(
                        new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
                    )
                    return
                }

                if (data instanceof Blob) {
                    void data.arrayBuffer().then((buffer) => {
                        if (terminalRef.current === terminal) {
                            terminal.write(new Uint8Array(buffer))
                        }
                    })
                }
            }
            ws.onclose = () => {
                terminal.dispose()
                setClose(true)
            }
            ws.onerror = (e) => {
                console.error(e)
                toast("Websocket error", {
                    description: "View console for details.",
                })
            }

            return () => {
                window.removeEventListener("resize", onResize)
                textarea?.removeEventListener("compositionstart", handleImeCompositionStart)
                textarea?.removeEventListener("compositionupdate", handleImeCompositionUpdate)
                textarea?.removeEventListener("compositionend", handleImeCompositionEnd)
                disconnectImeAnchorObserver()
                cancelQueuedImeAnchorSync()
                dataDisposable.dispose()
                binaryDisposable.dispose()
                ws.onopen = null
                ws.onmessage = null
                ws.onclose = null
                ws.onerror = null
                ws.close()
                terminal.dispose()
                if (wsRef.current === ws) wsRef.current = null
                if (terminalRef.current === terminal) terminalRef.current = null
            }
        }, [
            fitAddon,
            blockImeKeyboardEventForXterm,
            cancelQueuedImeAnchorSync,
            disconnectImeAnchorObserver,
            handleImeCompositionEnd,
            handleImeCompositionStart,
            handleImeCompositionUpdate,
            onResize,
            sendTerminalBinary,
            sendTerminalData,
            setClose,
            wsUrl,
        ])

        useEffect(() => {
            const terminal = terminalRef.current
            if (!terminal) return

            terminal.options.fontSize = fontSize
            doResize()
        }, [doResize, fontSize])

        return (
            <div
                ref={terminalIdRef}
                className={cn(
                    "xterm-ime-anchor [&_.xterm-helpers]:!left-0 [&_.xterm-helpers]:!top-0 [&_.xterm-screen]:overflow-hidden",
                    className,
                )}
                {...props}
            />
        )
    },
)

export const TerminalPage = () => {
    const { id } = useParams<{ id: string }>()
    const [open, setOpen] = useState(false)
    const [fontSize, setFontSize] = useState(TERMINAL_FONT_SIZE_DEFAULT)
    const terminal = useTerminal(id ? parseInt(id) : undefined)
    const terminalIdRef = useRef<HTMLDivElement>(null)
    const decreaseFontSize = () => {
        setFontSize((value) => Math.max(TERMINAL_FONT_SIZE_MIN, value - 1))
    }
    const increaseFontSize = () => {
        setFontSize((value) => Math.min(TERMINAL_FONT_SIZE_MAX, value + 1))
    }
    return (
        <main
            data-testid="mac-terminal-page"
            className="h-[100dvh] overflow-hidden bg-[#171717] text-zinc-100"
        >
            <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-8 sm:py-7">
                <section
                    data-testid="mac-terminal-window"
                    className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#050505] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
                >
                    <div className="relative flex h-12 shrink-0 items-center border-b border-white/10 bg-[#2b2b2b] px-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Close window"
                                onClick={() => window.close()}
                                className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                            <button
                                type="button"
                                aria-label="Minimize window"
                                className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                            <button
                                type="button"
                                aria-label="Zoom window"
                                onClick={async () => {
                                    await terminalIdRef.current?.requestFullscreen()
                                }}
                                className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                        </div>

                        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm font-medium text-zinc-300">
                            <TerminalIcon className="h-4 w-4 text-zinc-400" />
                            <span>{`Terminal (${id})`}</span>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <div
                                data-testid="terminal-font-size-control"
                                className="flex h-8 items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Decrease font size"
                                    aria-label="Decrease terminal font size"
                                    disabled={fontSize <= TERMINAL_FONT_SIZE_MIN}
                                    className="h-8 w-8 rounded-none text-zinc-300 hover:bg-white/10 hover:text-white"
                                    onClick={decreaseFontSize}
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span
                                    data-testid="terminal-font-size"
                                    className="min-w-7 select-none text-center text-[11px] font-medium tabular-nums text-zinc-400"
                                >
                                    {fontSize}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Increase font size"
                                    aria-label="Increase terminal font size"
                                    disabled={fontSize >= TERMINAL_FONT_SIZE_MAX}
                                    className="h-8 w-8 rounded-none text-zinc-300 hover:bg-white/10 hover:text-white"
                                    onClick={increaseFontSize}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Fullscreen"
                                className="h-8 w-8 rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
                                onClick={async () => {
                                    await terminalIdRef.current?.requestFullscreen()
                                }}
                            >
                                <Expand className="h-4 w-4" />
                            </Button>
                            <div className="[&_button]:h-8 [&_button]:w-8 [&_button]:rounded-md [&_button]:bg-transparent [&_button]:text-zinc-300 [&_button]:shadow-none [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
                                <FMCard id={id} />
                            </div>
                        </div>
                    </div>

                    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/5 bg-[#1f1f1f] px-4 text-xs text-zinc-500">
                        <FolderClosed className="h-3.5 w-3.5" />
                        <span className="truncate">agent session / server {id}</span>
                    </div>

                    <div className="min-h-0 flex-1 bg-black p-3">
                        {terminal?.session_id ? (
                            <XtermComponent
                                ref={terminalIdRef}
                                data-testid="terminal-viewport"
                                className="h-full min-h-0 overflow-hidden rounded-sm bg-black"
                                fontSize={fontSize}
                                wsUrl={`/api/v1/ws/terminal/${terminal?.session_id}`}
                                setClose={setOpen}
                            />
                        ) : (
                            <div className="flex h-full min-h-[20rem] items-center justify-center rounded-sm border border-white/10 bg-black px-6 text-center text-sm text-zinc-400">
                                The server does not exist, or have not been connected yet.
                            </div>
                        )}
                    </div>
                </section>
            </div>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Session completed</AlertDialogTitle>
                        <AlertDialogDescription>
                            You may close this window now.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction asChild>
                            <Button onClick={window.close}>Close</Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}

export const TerminalButton = ({ id, menuItem = false }: { id: number; menuItem?: boolean }) => {
    const { t } = useTranslation()
    const handleOpenNewTab = () => {
        window.open(`/dashboard/terminal/${id}`, "_blank")
    }

    if (menuItem) {
        return (
            <button
                type="button"
                onClick={handleOpenNewTab}
                className="flex w-full items-center text-sm px-2 py-2 hover:bg-accent hover:text-accent-foreground"
            >
                <TerminalIcon className="h-4 w-4 mr-2" />
                <span>{t("Terminal")}</span>
            </button>
        )
    }

    return <IconButton variant="outline" icon="terminal" onClick={handleOpenNewTab} />
}
