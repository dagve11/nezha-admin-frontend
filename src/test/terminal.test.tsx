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

vi.mock("@/hooks/useTerminal", () => ({
    default: () => ({ session_id: "session-1" }),
}))

vi.mock("@/lib/utils", () => ({
    sleep: () => Promise.resolve(),
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}))

const attachAddonInstances: { ws: WebSocket }[] = []
const terminalInstances: {
    options: { fontSize?: number }
    focusCalls: number
    textarea?: HTMLTextAreaElement
    screen?: HTMLElement
    buffer: { active: { cursorX: number; cursorY: number } }
    cols: number
    rows: number
}[] = []
vi.mock("@xterm/addon-attach", () => ({
    AttachAddon: class {
        ws: WebSocket
        constructor(ws: WebSocket) {
            this.ws = ws
            attachAddonInstances.push(this)
        }
        activate() {}
        dispose() {}
    },
}))

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
        cols = 80
        rows = 24
        buffer = { active: { cursorX: 7, cursorY: 3 } }
        textarea?: HTMLTextAreaElement
        screen?: HTMLElement
        constructor(options: { fontSize?: number } = {}) {
            this.options = { ...options }
            terminalInstances.push(this)
        }
        loadAddon() {}
        open(container: HTMLElement) {
            const xterm = document.createElement("div")
            xterm.className = "xterm"
            const screen = document.createElement("div")
            screen.className = "xterm-screen"
            Object.defineProperty(screen, "clientWidth", { configurable: true, value: 800 })
            Object.defineProperty(screen, "clientHeight", { configurable: true, value: 480 })
            const helpers = document.createElement("div")
            helpers.className = "xterm-helpers"
            const textarea = document.createElement("textarea")
            textarea.className = "xterm-helper-textarea"
            const compositionView = document.createElement("div")
            compositionView.className = "composition-view"

            helpers.append(textarea, compositionView)
            screen.append(helpers)
            xterm.append(screen)
            container.append(xterm)
            this.textarea = textarea
            this.screen = screen
        }
        focus() {
            this.focusCalls += 1
        }
        dispose() {}
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

beforeEach(() => {
    FakeWebSocket.instances = []
    attachAddonInstances.length = 0
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

test("XtermComponent closes the previous WebSocket and re-attaches xterm when wsUrl changes", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    const { rerender } = render(
        <XtermComponent wsUrl="/api/v1/ws/terminal/session-1" setClose={noop} />,
    )

    expect(FakeWebSocket.instances).toHaveLength(1)
    const firstSocket = FakeWebSocket.instances[0]
    expect(attachAddonInstances).toHaveLength(1)
    expect(attachAddonInstances[0].ws).toBe(firstSocket as unknown as WebSocket)

    rerender(<XtermComponent wsUrl="/api/v1/ws/terminal/session-2" setClose={noop} />)

    expect(FakeWebSocket.instances).toHaveLength(2)
    const secondSocket = FakeWebSocket.instances[1]
    expect(firstSocket.closeCalls).toBeGreaterThanOrEqual(1)
    expect(attachAddonInstances).toHaveLength(2)
    expect(attachAddonInstances[1].ws).toBe(secondSocket as unknown as WebSocket)
})

test("XtermComponent does not send resize frames before WebSocket opens", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    expect(() => {
        render(<XtermComponent wsUrl="/api/v1/ws/terminal/session-1" setClose={noop} />)
    }).not.toThrow()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].readyState).toBe(0)
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

test("XtermComponent anchors the IME textarea to the xterm cursor before composition", async () => {
    const { XtermComponent } = await import("../components/terminal")
    const noop = () => undefined

    render(
        <XtermComponent
            data-testid="terminal-viewport"
            wsUrl="/api/v1/ws/terminal/session-1"
            setClose={noop}
        />,
    )

    fireEvent.compositionStart(screen.getByTestId("terminal-viewport"))

    const textarea = terminalInstances[0].textarea
    expect(textarea?.style.left).toBe("70px")
    expect(textarea?.style.top).toBe("60px")
    expect(textarea?.style.width).toBe("10px")
    expect(textarea?.style.height).toBe("20px")
    expect(textarea?.style.lineHeight).toBe("20px")
    expect(textarea?.style.zIndex).toBe("1000")
})

test("XtermComponent keeps IME composition keystrokes away from xterm input handlers", async () => {
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
    const targetHandlers = {
        compositionstart: vi.fn(),
        compositionend: vi.fn(),
        keydown: vi.fn(),
        input: vi.fn(),
    }
    textarea.addEventListener("compositionstart", targetHandlers.compositionstart)
    textarea.addEventListener("compositionend", targetHandlers.compositionend)
    textarea.addEventListener("keydown", targetHandlers.keydown)
    textarea.addEventListener("input", targetHandlers.input)

    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))

    const composingKeyDown = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "x",
    })
    Object.defineProperty(composingKeyDown, "isComposing", { value: true })
    textarea.dispatchEvent(composingKeyDown)

    textarea.dispatchEvent(
        new InputEvent("input", {
            bubbles: true,
            data: "x",
            inputType: "insertCompositionText",
            isComposing: true,
        }),
    )

    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "小" }))
    textarea.dispatchEvent(
        new InputEvent("input", {
            bubbles: true,
            data: "小",
            inputType: "insertText",
        }),
    )

    expect(targetHandlers.compositionstart).toHaveBeenCalledTimes(1)
    expect(targetHandlers.compositionend).toHaveBeenCalledTimes(1)
    expect(targetHandlers.keydown).not.toHaveBeenCalled()
    expect(targetHandlers.input).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 0))

    textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }))
    textarea.dispatchEvent(
        new InputEvent("input", {
            bubbles: true,
            data: "a",
            inputType: "insertText",
        }),
    )

    expect(targetHandlers.keydown).toHaveBeenCalledTimes(1)
    expect(targetHandlers.input).toHaveBeenCalledTimes(1)
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
    expect(screen.getByTestId("terminal-viewport").className).toContain("xterm-ime-stable")
    expect(screen.getByTestId("terminal-viewport").className).toContain(
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
