import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

vi.mock("sonner", () => ({ toast: () => undefined }))

vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react-router-dom")>()
    return {
        ...actual,
        useParams: () => ({ id: "2" }),
    }
})

vi.mock("@/hooks/useTerminal", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/hooks/useTerminal")>()
    return {
        ...actual,
        default: () => ({ session_id: "session-1" }),
    }
})

vi.mock("@/lib/utils", () => ({
    sleep: () => Promise.resolve(),
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

type TerminalMock = {
    options: { fontSize?: number }
    focusCalls: number
    disposeCalls: number
    xterm?: HTMLElement
    textarea?: HTMLTextAreaElement
    screen?: HTMLElement
    viewport?: HTMLElement
    compositionView?: HTMLElement
    buffer: {
        active: {
            cursorX: number
            cursorY: number
            baseY: number
            lines: string[]
            wrappedLines: Set<number>
            getLine: (line: number) =>
                | {
                      isWrapped: boolean
                      length: number
                      getCell: (
                          column: number,
                      ) => { getChars: () => string; getWidth: () => number } | undefined
                      translateToString: (trimRight?: boolean) => string
                  }
                | undefined
        }
    }
    cols: number
    rows: number
    customKeyEventHandler?: (event: KeyboardEvent) => boolean
    writeCalls: Array<string | Uint8Array>
    emitData: (data: string) => void
    emitBinary: (data: string) => void
}

const terminalInstances: TerminalMock[] = []

const isWideTestCharacter = (codePoint: number) => {
    return codePoint >= 0x2e80 && codePoint <= 0x9fff
}

const createBufferCells = (value: string) => {
    const cells: Array<{ chars: string; width: number }> = []

    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0
        if (isWideTestCharacter(codePoint)) {
            cells.push({ chars: character, width: 2 }, { chars: "", width: 0 })
            continue
        }

        cells.push({ chars: character, width: 1 })
    }

    return cells
}

vi.mock("@xterm/addon-fit", () => ({
    FitAddon: class {
        activate() {}
        dispose() {}
        fit() {}
        proposeDimensions() {
            return { rows: 24, cols: 80 }
        }
    },
}))

vi.mock("@xterm/xterm", () => ({
    Terminal: class {
        options: { fontSize?: number }
        focusCalls = 0
        disposeCalls = 0
        cols = 80
        rows = 24
        buffer = {
            active: {
                cursorX: 7,
                cursorY: 3,
                baseY: 0,
                lines: [] as string[],
                wrappedLines: new Set<number>(),
                getLine(line: number) {
                    const value = this.lines[line]
                    if (value === undefined) return undefined
                    const cells = createBufferCells(value)

                    return {
                        isWrapped: this.wrappedLines.has(line),
                        length: cells.length,
                        getCell: (column: number) => {
                            const cell = cells[column]
                            if (!cell) return undefined

                            return {
                                getChars: () => cell.chars,
                                getWidth: () => cell.width,
                            }
                        },
                        translateToString: (trimRight = false) =>
                            trimRight ? value.trimEnd() : value,
                    }
                },
            },
        }
        xterm?: HTMLElement
        textarea?: HTMLTextAreaElement
        screen?: HTMLElement
        viewport?: HTMLElement
        compositionView?: HTMLElement
        customKeyEventHandler?: (event: KeyboardEvent) => boolean
        writeCalls: Array<string | Uint8Array> = []
        private dataListeners: Array<(data: string) => void> = []
        private binaryListeners: Array<(data: string) => void> = []

        constructor(options: { fontSize?: number } = {}) {
            this.options = { ...options }
            terminalInstances.push(this as TerminalMock)
        }

        attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) {
            this.customKeyEventHandler = handler
        }

        onData(listener: (data: string) => void) {
            this.dataListeners.push(listener)
            return {
                dispose: () => {
                    this.dataListeners = this.dataListeners.filter((item) => item !== listener)
                },
            }
        }

        onBinary(listener: (data: string) => void) {
            this.binaryListeners.push(listener)
            return {
                dispose: () => {
                    this.binaryListeners = this.binaryListeners.filter((item) => item !== listener)
                },
            }
        }

        emitData(data: string) {
            this.dataListeners.forEach((listener) => listener(data))
        }

        emitBinary(data: string) {
            this.binaryListeners.forEach((listener) => listener(data))
        }

        loadAddon() {}

        open(container: HTMLElement) {
            const xterm = document.createElement("div")
            xterm.className = "xterm"
            Object.defineProperty(xterm, "scrollLeft", {
                configurable: true,
                writable: true,
                value: 0,
            })
            const viewport = document.createElement("div")
            viewport.className = "xterm-viewport"
            Object.defineProperty(viewport, "scrollLeft", {
                configurable: true,
                writable: true,
                value: 0,
            })
            const screen = document.createElement("div")
            screen.className = "xterm-screen"
            Object.defineProperty(screen, "clientWidth", { configurable: true, value: 800 })
            Object.defineProperty(screen, "clientHeight", { configurable: true, value: 480 })
            Object.defineProperty(screen, "scrollLeft", {
                configurable: true,
                writable: true,
                value: 0,
            })
            const helpers = document.createElement("div")
            helpers.className = "xterm-helpers"
            const textarea = document.createElement("textarea")
            textarea.className = "xterm-helper-textarea"
            const compositionView = document.createElement("div")
            compositionView.className = "composition-view"

            helpers.append(textarea, compositionView)
            screen.append(helpers)
            xterm.append(viewport, screen)
            container.append(xterm)
            this.xterm = xterm
            this.textarea = textarea
            this.screen = screen
            this.viewport = viewport
            this.compositionView = compositionView
        }

        focus() {
            this.focusCalls += 1
        }

        write(data: string | Uint8Array) {
            this.writeCalls.push(data)
        }

        dispose() {
            this.disposeCalls += 1
        }
    },
}))

class FakeWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static instances: FakeWebSocket[] = []
    url: string
    binaryType = "arraybuffer"
    onopen: ((ev: Event) => unknown) | null = null
    onclose: ((ev: Event) => unknown) | null = null
    onerror: ((ev: Event) => unknown) | null = null
    onmessage: ((ev: MessageEvent) => unknown) | null = null
    readyState = 0
    closeCalls = 0
    sent: unknown[] = []

    constructor(url: string | URL) {
        this.url = url.toString()
        FakeWebSocket.instances.push(this)
    }

    close() {
        this.closeCalls += 1
        this.readyState = 3
    }

    open() {
        this.readyState = 1
        this.onopen?.(new Event("open"))
    }

    message(data: unknown) {
        this.onmessage?.(new MessageEvent("message", { data }))
    }

    send(data: unknown) {
        if (this.readyState !== 1) {
            throw new DOMException(
                "Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.",
                "InvalidStateError",
            )
        }
        this.sent.push(data)
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
        return true
    }
}

const bytesFromSentFrame = (data: unknown) => {
    expect(ArrayBuffer.isView(data)).toBe(true)
    const view = data as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}

const decodeFrame = (data: unknown) => {
    const bytes = bytesFromSentFrame(data)
    const payload = bytes.slice(1)
    return {
        command: bytes[0],
        payload,
        text: new TextDecoder().decode(payload),
    }
}

beforeEach(() => {
    FakeWebSocket.instances = []
    terminalInstances.length = 0
    ;(globalThis as { WebSocket: typeof WebSocket }).WebSocket =
        FakeWebSocket as unknown as typeof WebSocket
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    })
})

afterEach(() => {
    vi.clearAllMocks()
})

test("XtermComponent closes the previous WebSocket and reconnects when wsUrl changes", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    const { rerender } = render(
        <XtermComponent wsUrl="/api/v1/ws/terminal/session-1" setClose={noop} />,
    )

    expect(FakeWebSocket.instances).toHaveLength(1)
    const firstSocket = FakeWebSocket.instances[0]

    rerender(<XtermComponent wsUrl="/api/v1/ws/terminal/session-2" setClose={noop} />)

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(firstSocket.closeCalls).toBeGreaterThanOrEqual(1)
    expect(terminalInstances[0].disposeCalls).toBeGreaterThanOrEqual(1)
})

test("XtermComponent does not send resize frames before WebSocket opens", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    expect(() => {
        render(<XtermComponent wsUrl="/api/v1/ws/terminal/session-1" setClose={noop} />)
    }).not.toThrow()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CONNECTING)
    expect(FakeWebSocket.instances[0].sent).toHaveLength(0)
})

test("XtermComponent sends resize frames after WebSocket opens", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const socket = FakeWebSocket.instances[0]
    socket.open()

    await waitFor(() => {
        expect(socket.sent).toHaveLength(1)
    })

    const frame = decodeFrame(socket.sent[0])
    expect(frame.command).toBe(1)
    expect(JSON.parse(frame.text)).toEqual({ Rows: 24, Cols: 80 })
})

test("XtermComponent focuses xterm after opening so IME follows cursor position", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    expect(terminalInstances[0].focusCalls).toBe(1)
})

test("XtermComponent sends xterm text data as terminal input frames", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const socket = FakeWebSocket.instances[0]
    socket.open()

    await waitFor(() => {
        expect(socket.sent).toHaveLength(1)
    })

    socket.sent = []
    terminalInstances[0].emitData("a")

    const frame = decodeFrame(socket.sent[0])
    expect(frame.command).toBe(0)
    expect(frame.text).toBe("a")
})

test("XtermComponent blocks IME composing data and sends only the committed Chinese text", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const socket = FakeWebSocket.instances[0]
    socket.open()

    await waitFor(() => {
        expect(socket.sent).toHaveLength(1)
    })

    socket.sent = []
    const textarea = terminalInstances[0].textarea!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    terminalInstances[0].emitData("x'ao")
    expect(socket.sent).toHaveLength(0)

    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "小" }))
    terminalInstances[0].emitData("小")

    const frame = decodeFrame(socket.sent[0])
    expect(frame.command).toBe(0)
    expect(frame.text).toBe("小")
})

test("XtermComponent anchors IME helper elements to the xterm cursor during composition", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const textarea = terminalInstances[0].textarea!
    const compositionView = terminalInstances[0].compositionView!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    textarea.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "ni" }))

    expect(textarea.style.left).toBe("70px")
    expect(textarea.style.top).toBe("60px")
    expect(textarea.style.width).toBe("10px")
    expect(textarea.style.height).toBe("20px")
    expect(textarea.style.lineHeight).toBe("20px")
    expect(compositionView.style.left).toBe("70px")
    expect(compositionView.style.top).toBe("60px")
    expect(compositionView.style.height).toBe("20px")
    expect(compositionView.style.lineHeight).toBe("20px")
    expect(compositionView.className).not.toContain("opacity-0")
})

test("XtermComponent anchors IME composition to Claude Code input row instead of footer row", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const terminal = terminalInstances[0]
    terminal.buffer.active.cursorX = 31
    terminal.buffer.active.cursorY = 22
    terminal.buffer.active.lines[21] = '> Try "edit <filepath> to..."'
    terminal.buffer.active.lines[22] = "? for shortcuts · ← for agents"

    const textarea = terminal.textarea!
    const compositionView = terminal.compositionView!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    textarea.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "ni" }))

    expect(textarea.style.left).toBe("20px")
    expect(textarea.style.top).toBe("420px")
    expect(compositionView.style.left).toBe("20px")
    expect(compositionView.style.top).toBe("420px")
})

test("XtermComponent anchors Claude Code IME to the visible input prompt when xterm cursor is elsewhere", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const terminal = terminalInstances[0]
    terminal.buffer.active.cursorX = 79
    terminal.buffer.active.cursorY = 16
    terminal.buffer.active.lines[2] = "Claude Code v2.1.150"
    terminal.buffer.active.lines[14] = "> 宣布搜"
    terminal.buffer.active.lines[16] = ""

    const textarea = terminal.textarea!
    const compositionView = terminal.compositionView!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    textarea.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "pi" }))

    expect(textarea.style.left).toBe("80px")
    expect(textarea.style.top).toBe("280px")
    expect(compositionView.style.left).toBe("80px")
    expect(compositionView.style.top).toBe("280px")
})

test("XtermComponent anchors Claude Code IME to the wrapped continuation input row", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const terminal = terminalInstances[0]
    terminal.buffer.active.cursorX = 79
    terminal.buffer.active.cursorY = 15
    terminal.buffer.active.lines[2] = "Claude Code v2.1.150"
    terminal.buffer.active.lines[14] =
        "> 好惊快i就偶是继续哦你你挨个下个啊hi好多次哦还很低慈爱"
    terminal.buffer.active.lines[15] = "库存盘点库存课程"
    terminal.buffer.active.wrappedLines.add(15)

    const textarea = terminal.textarea!
    const compositionView = terminal.compositionView!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    textarea.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "di" }))

    expect(textarea.style.left).toBe("160px")
    expect(textarea.style.top).toBe("300px")
    expect(compositionView.style.left).toBe("160px")
    expect(compositionView.style.top).toBe("300px")
})

test("XtermComponent restores the Claude Code IME anchor when xterm rewrites helper styles", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const terminal = terminalInstances[0]
    terminal.buffer.active.cursorX = 79
    terminal.buffer.active.cursorY = 16
    terminal.buffer.active.lines[2] = "Claude Code v2.1.150"
    terminal.buffer.active.lines[14] = "> 宣布搜"
    terminal.buffer.active.lines[16] = ""

    const textarea = terminal.textarea!
    const compositionView = terminal.compositionView!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    textarea.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true, data: "pi" }))

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    await new Promise((resolve) => window.requestAnimationFrame(resolve))

    textarea.style.left = "790px"
    textarea.style.top = "320px"
    compositionView.style.left = "790px"
    compositionView.style.top = "320px"

    await Promise.resolve()

    expect(textarea.style.left).toBe("80px")
    expect(textarea.style.top).toBe("280px")
    expect(compositionView.style.left).toBe("80px")
    expect(compositionView.style.top).toBe("280px")
})

test("XtermComponent resets horizontal scroll while IME composition is active", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const container = screen.getByTestId("terminal-viewport")
    const terminal = terminalInstances[0]
    const textarea = terminal.textarea!
    container.scrollLeft = 320
    terminal.xterm!.scrollLeft = 240
    terminal.screen!.scrollLeft = 160
    terminal.viewport!.scrollLeft = 80

    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))

    expect(container.scrollLeft).toBe(0)
    expect(terminal.xterm!.scrollLeft).toBe(0)
    expect(terminal.screen!.scrollLeft).toBe(0)
    expect(terminal.viewport!.scrollLeft).toBe(0)
})

test("XtermComponent lets xterm ignore IME keyboard events during composition", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const textarea = terminalInstances[0].textarea!
    const handler = terminalInstances[0].customKeyEventHandler!
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))

    expect(handler(new KeyboardEvent("keydown", { key: "a" }))).toBe(false)

    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "小" }))

    const pendingImeKeyDown = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Process",
    })
    Object.defineProperties(pendingImeKeyDown, {
        keyCode: { value: 229 },
        which: { value: 229 },
    })

    expect(handler(pendingImeKeyDown)).toBe(false)
    expect(handler(new KeyboardEvent("keydown", { key: "a" }))).toBe(true)
})

test("XtermComponent forwards binary xterm input as terminal input frames", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const socket = FakeWebSocket.instances[0]
    socket.open()

    await waitFor(() => {
        expect(socket.sent).toHaveLength(1)
    })

    socket.sent = []
    terminalInstances[0].emitBinary("\xff")

    const frame = decodeFrame(socket.sent[0])
    expect(frame.command).toBe(0)
    expect(frame.payload).toEqual(new Uint8Array([255]))
})

test("XtermComponent writes WebSocket messages into xterm", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    const socket = FakeWebSocket.instances[0]
    socket.message("server output")

    expect(terminalInstances[0].writeCalls[0]).toBe("server output")

    const binaryOutput = new Uint8Array([27, 91, 65])
    socket.message(binaryOutput.buffer)

    expect(terminalInstances[0].writeCalls[1]).toEqual(binaryOutput)
})

test("TerminalPage renders as a standalone mac style terminal window", async () => {
    const { TerminalPage } = await import("../components/terminal")

    render(<TerminalPage />)

    expect(screen.getByTestId("mac-terminal-page")).toBeTruthy()
    expect(screen.getByTestId("mac-terminal-window")).toBeTruthy()
    expect(screen.getByText("Terminal (2)")).toBeTruthy()
    expect(screen.getByLabelText("Close window")).toBeTruthy()
    expect(screen.getByLabelText("Minimize window")).toBeTruthy()
    expect(screen.getByLabelText("Zoom window")).toBeTruthy()
})

test("TerminalPage bounds the terminal window to the first viewport", async () => {
    const { TerminalPage } = await import("../components/terminal")

    render(<TerminalPage />)

    expect(screen.getByTestId("mac-terminal-page").className).toContain("h-[100dvh]")
    expect(screen.getByTestId("mac-terminal-window").className).toContain("h-full")
    expect(screen.getByTestId("terminal-viewport").className).toContain("min-h-0")
    expect(screen.getByTestId("terminal-viewport").className).toContain("h-full")
    expect(screen.getByTestId("terminal-viewport").className).not.toContain("xterm-ime-stable")
    expect(screen.getByTestId("terminal-viewport").className).not.toContain(
        "[&_.composition-view]:!opacity-0",
    )
})

test("TerminalPage lets users change xterm font size from the title bar", async () => {
    const { TerminalPage } = await import("../components/terminal")

    render(<TerminalPage />)

    expect(screen.getByTestId("terminal-font-size").textContent).toBe("16")
    expect(terminalInstances[0].options.fontSize).toBe(16)

    fireEvent.click(screen.getByLabelText("Increase terminal font size"))

    expect(screen.getByTestId("terminal-font-size").textContent).toBe("17")
    expect(terminalInstances[0].options.fontSize).toBe(17)

    fireEvent.click(screen.getByLabelText("Decrease terminal font size"))

    expect(screen.getByTestId("terminal-font-size").textContent).toBe("16")
    expect(terminalInstances[0].options.fontSize).toBe(16)
})
