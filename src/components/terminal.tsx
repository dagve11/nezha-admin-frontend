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
import { AttachAddon } from "@xterm/addon-attach"
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
const IME_PENDING_INPUT_BLOCK_MS = 100

type ImeState = {
    isComposing: boolean
    blockNextInput: boolean
    clearBlockTimer?: number
}

const stopXtermInputPropagation = (event: Event) => {
    event.stopPropagation()
    event.stopImmediatePropagation()
}

const isImeKeyboardEvent = (event: KeyboardEvent) => {
    return (
        event.isComposing ||
        event.key === "Process" ||
        event.key === "Unidentified" ||
        event.keyCode === 229 ||
        event.which === 229
    )
}

export const XtermComponent = forwardRef<HTMLDivElement, XtermProps & JSX.IntrinsicElements["div"]>(
    ({ wsUrl, setClose, fontSize = TERMINAL_FONT_SIZE_DEFAULT, className, ...props }, ref) => {
        const terminalIdRef = useRef<HTMLDivElement>(null)
        const terminalRef = useRef<Terminal | null>(null)
        const wsRef = useRef<WebSocket | null>(null)
        const imeStateRef = useRef<ImeState>({
            isComposing: false,
            blockNextInput: false,
        })

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

        const clearPendingImeInputBlock = useCallback(() => {
            const clearBlockTimer = imeStateRef.current.clearBlockTimer
            if (clearBlockTimer === undefined) return

            window.clearTimeout(clearBlockTimer)
            imeStateRef.current.clearBlockTimer = undefined
        }, [])

        const scheduleImeInputBlock = useCallback(
            (delay = 0) => {
                clearPendingImeInputBlock()
                imeStateRef.current.blockNextInput = true
                imeStateRef.current.clearBlockTimer = window.setTimeout(() => {
                    imeStateRef.current.blockNextInput = false
                    imeStateRef.current.clearBlockTimer = undefined
                }, delay)
            },
            [clearPendingImeInputBlock],
        )

        const syncImeAnchor = useCallback(() => {
            const terminal = terminalRef.current
            const container = terminalIdRef.current
            if (!terminal || !container || terminal.cols <= 0 || terminal.rows <= 0) return

            const textarea = container.querySelector<HTMLTextAreaElement>(
                ".xterm-helper-textarea",
            )
            const screenElement = container.querySelector<HTMLElement>(".xterm-screen")
            if (!textarea || !screenElement) return

            const screenBounds = screenElement.getBoundingClientRect()
            const screenWidth = screenBounds.width || screenElement.clientWidth
            const screenHeight = screenBounds.height || screenElement.clientHeight
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

            textarea.style.left = `${cursorX * cellWidth}px`
            textarea.style.top = `${cursorY * cellHeight}px`
            textarea.style.width = `${Math.max(cellWidth, 1)}px`
            textarea.style.height = `${Math.max(cellHeight, 1)}px`
            textarea.style.lineHeight = `${Math.max(cellHeight, 1)}px`
            textarea.style.zIndex = "1000"
        }, [])

        const handleImeCompositionStart = useCallback(() => {
            clearPendingImeInputBlock()
            imeStateRef.current.isComposing = true
            imeStateRef.current.blockNextInput = false
            syncImeAnchor()
        }, [clearPendingImeInputBlock, syncImeAnchor])

        const handleImeCompositionEnd = useCallback(() => {
            clearPendingImeInputBlock()
            imeStateRef.current.isComposing = false
            syncImeAnchor()
            scheduleImeInputBlock()
        }, [clearPendingImeInputBlock, scheduleImeInputBlock, syncImeAnchor])

        const blockImeKeyboardEventForXterm = useCallback(
            (event: KeyboardEvent) => {
                syncImeAnchor()

                const isPendingImeKey = isImeKeyboardEvent(event)
                if (isPendingImeKey && !imeStateRef.current.isComposing) {
                    scheduleImeInputBlock(IME_PENDING_INPUT_BLOCK_MS)
                }

                return !(imeStateRef.current.isComposing || isPendingImeKey)
            },
            [scheduleImeInputBlock, syncImeAnchor],
        )

        const handleImeKeyboardEvent = useCallback(
            (event: KeyboardEvent) => {
                if (!blockImeKeyboardEventForXterm(event)) {
                    stopXtermInputPropagation(event)
                }
            },
            [blockImeKeyboardEventForXterm],
        )

        const handleImeInputEvent = useCallback((event: Event) => {
            const inputEvent = event as InputEvent
            const inputType = inputEvent.inputType ?? ""
            const isCompositionInput = inputType.includes("Composition")

            if (
                imeStateRef.current.isComposing ||
                imeStateRef.current.blockNextInput ||
                inputEvent.isComposing ||
                isCompositionInput
            ) {
                stopXtermInputPropagation(event)
            }
        }, [])

        const doResize = useCallback(() => {
            if (!terminalIdRef.current) return

            fitAddon.fit()
            syncImeAnchor()

            const dimensions = fitAddon.proposeDimensions()

            if (dimensions) {
                const prefix = new Int8Array([1])
                const resizeMessage = new TextEncoder().encode(
                    JSON.stringify({
                        Rows: dimensions.rows,
                        Cols: dimensions.cols,
                    }),
                )

                const msg = new Int8Array(prefix.length + resizeMessage.length)
                msg.set(prefix)
                msg.set(resizeMessage, prefix.length)

                const ws = wsRef.current
                if (ws?.readyState !== WebSocket.OPEN) return

                ws.send(msg)
            }
        }, [fitAddon, syncImeAnchor])

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

            const attachAddon = new AttachAddon(ws)
            terminal.attachCustomKeyEventHandler(blockImeKeyboardEventForXterm)
            terminal.loadAddon(attachAddon)
            terminal.loadAddon(fitAddon)
            terminal.open(container)
            fitAddon.fit()
            syncImeAnchor()
            terminal.focus()
            window.addEventListener("resize", onResize)
            container.addEventListener("compositionstart", handleImeCompositionStart, true)
            container.addEventListener("compositionupdate", syncImeAnchor, true)
            container.addEventListener("compositionend", handleImeCompositionEnd, true)
            container.addEventListener("keydown", handleImeKeyboardEvent, true)
            container.addEventListener("keypress", handleImeKeyboardEvent, true)
            container.addEventListener("beforeinput", handleImeInputEvent, true)
            container.addEventListener("input", handleImeInputEvent, true)
            container.addEventListener("focusin", syncImeAnchor, true)

            ws.onopen = () => {
                onResize()
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
                container.removeEventListener("compositionstart", handleImeCompositionStart, true)
                container.removeEventListener("compositionupdate", syncImeAnchor, true)
                container.removeEventListener("compositionend", handleImeCompositionEnd, true)
                container.removeEventListener("keydown", handleImeKeyboardEvent, true)
                container.removeEventListener("keypress", handleImeKeyboardEvent, true)
                container.removeEventListener("beforeinput", handleImeInputEvent, true)
                container.removeEventListener("input", handleImeInputEvent, true)
                container.removeEventListener("focusin", syncImeAnchor, true)
                clearPendingImeInputBlock()
                ws.onopen = null
                ws.onclose = null
                ws.onerror = null
                ws.close()
                terminal.dispose()
                if (wsRef.current === ws) wsRef.current = null
                if (terminalRef.current === terminal) terminalRef.current = null
            }
        }, [
            clearPendingImeInputBlock,
            fitAddon,
            blockImeKeyboardEventForXterm,
            handleImeCompositionEnd,
            handleImeCompositionStart,
            handleImeInputEvent,
            handleImeKeyboardEvent,
            onResize,
            setClose,
            syncImeAnchor,
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
                    "xterm-ime-stable [&_.composition-view]:!opacity-0 [&_.composition-view]:pointer-events-none [&_.xterm-helper-textarea]:!z-[1000]",
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
