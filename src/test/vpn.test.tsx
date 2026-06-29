import Header from "@/components/header"
import enTranslation from "@/locales/en/translation.json"
import zhCNTranslation from "@/locales/zh-CN/translation.json"
import zhTWTranslation from "@/locales/zh-TW/translation.json"
import VPNPage from "@/routes/vpn"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, test, vi } from "vitest"

const createVPNPolicy = vi.fn()
const updateVPNPolicy = vi.fn()
const deleteVPNPolicy = vi.fn()
const startVPNSession = vi.fn()
const stopVPNSession = vi.fn()
const deleteVPNSession = vi.fn()
const restartVPNSession = vi.fn()
const refreshVPNSessionStatus = vi.fn()
const toastMock = vi.fn()
const validSHA256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

class MockVPNWebSocket {
    static instances: MockVPNWebSocket[] = []

    url: string
    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    closed = false

    constructor(url: string) {
        this.url = url
        MockVPNWebSocket.instances.push(this)
    }

    close() {
        this.closed = true
    }

    sendFrame(frame: unknown) {
        this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent<string>)
    }

    disconnect() {
        this.onclose?.()
    }
}

vi.mock("@/api/vpn", () => ({
    createVPNPolicy: (...args: unknown[]) => createVPNPolicy(...args),
    updateVPNPolicy: (...args: unknown[]) => updateVPNPolicy(...args),
    deleteVPNPolicy: (...args: unknown[]) => deleteVPNPolicy(...args),
    startVPNSession: (...args: unknown[]) => startVPNSession(...args),
    stopVPNSession: (...args: unknown[]) => stopVPNSession(...args),
    deleteVPNSession: (...args: unknown[]) => deleteVPNSession(...args),
    restartVPNSession: (...args: unknown[]) => restartVPNSession(...args),
    refreshVPNSessionStatus: (...args: unknown[]) => refreshVPNSessionStatus(...args),
}))

vi.mock("@/api/api", () => ({
    swrFetcher: vi.fn(),
}))

vi.mock("@/hooks/useServer", () => ({
    useServer: () => ({
        servers: [
            {
                id: 1,
                name: "entry-cn",
                last_active: new Date().toISOString(),
                host: {
                    platform: "linux",
                    arch: "amd64",
                    vpn_enabled: true,
                    vpn_allow_system_proxy: true,
                    vpn_allow_tun: true,
                    vpn_core_version: "1.12.0",
                    vpn_last_error: "",
                },
            },
            {
                id: 2,
                name: "exit-jp",
                last_active: "2026-06-08T00:00:00Z",
                host: {
                    platform: "windows",
                    arch: "amd64",
                    vpn_enabled: true,
                    vpn_allow_system_proxy: true,
                    vpn_allow_tun: false,
                    vpn_core_version: "",
                    vpn_last_error: "Core not installed",
                },
            },
        ],
    }),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({
        notifierGroup: [
            {
                group: { id: 9, name: "vpn-notify" },
                notifications: [1],
            },
        ],
    }),
}))

vi.mock("sonner", () => ({
    toast: (...args: unknown[]) => toastMock(...args),
}))

vi.mock("swr", () => ({
    default: (key: string) => {
        const dataByKey: Record<string, unknown> = {
            "/api/v1/vpn/server": [
                {
                    id: 1,
                    name: "entry-cn",
                    owned: true,
                    shared: false,
                    online: true,
                    vpn_enabled: true,
                    vpn_allow_system_proxy: true,
                    vpn_allow_tun: true,
                    vpn_core_version: "1.12.0",
                    vpn_last_error: "",
                    vpn_direct_enabled: false,
                },
                {
                    id: 2,
                    name: "exit-jp",
                    owned: false,
                    shared: true,
                    online: false,
                    vpn_enabled: true,
                    vpn_allow_system_proxy: true,
                    vpn_allow_tun: false,
                    vpn_core_version: "",
                    vpn_last_error: "Core not installed",
                    vpn_direct_enabled: false,
                    owner: { id: 2, username: "owner" },
                },
            ],
            "/api/v1/vpn/policy": [
                {
                    id: 7,
                    name: "github split",
                    entry_server_id: 1,
                    exit_server_id: 2,
                    mode: "system_proxy",
                    rule_mode: "domain",
                    domains: ["github.com"],
                    cidrs: [],
                    direct_cidrs: [],
                    listen_socks: "127.0.0.1:1080",
                    listen_http: "",
                    expires_seconds: 3600,
                    max_upload_bytes: 1048576,
                    max_download_bytes: 2097152,
                    idle_timeout_seconds: 60,
                    notification_group_id: 9,
                    set_system_proxy: false,
                    egress_probe_url: "https://ifconfig.example/ip",
                    core_version: "1.12.0",
                    core_download_url: "https://download.example.com/sing-box.exe",
                    core_sha256: validSHA256,
                },
                {
                    id: 8,
                    name: "global tunnel",
                    entry_server_id: 2,
                    exit_server_id: 1,
                    mode: "tun_global",
                    rule_mode: "global",
                    domains: [],
                    cidrs: [],
                    direct_cidrs: ["10.0.0.0/8"],
                    listen_socks: "",
                    listen_http: "",
                    tun_name: "nezha-vpn",
                    dns_server: "https://1.1.1.1/dns-query",
                    expires_seconds: 7200,
                    notification_group_id: 0,
                    tun_health_url: "https://old.example.com/generate_204",
                    tun_health_timeout_seconds: 5,
                },
            ],
            "/api/v1/vpn/session": [
                {
                    id: 11,
                    policy_id: 7,
                    entry_server_id: 1,
                    exit_server_id: 2,
                    session_id: "vpn_session_1",
                    mode: "system_proxy",
                    state: "running",
                    entry_state: "running",
                    exit_state: "running",
                    upload_bytes: 123,
                    download_bytes: 456,
                },
                {
                    id: 12,
                    policy_id: 8,
                    entry_server_id: 2,
                    exit_server_id: 1,
                    session_id: "vpn_session_2",
                    mode: "tun_global",
                    state: "failed",
                    entry_state: "failed",
                    exit_state: "running",
                    upload_bytes: 789,
                    download_bytes: 1024,
                    active_connections: 3,
                    last_error: "tun preflight failed",
                    started_at: "2026-06-08T13:00:00+08:00",
                    expires_at: "2026-06-08T15:00:00+08:00",
                },
            ],
        }
        return {
            data: dataByKey[key],
            mutate: vi.fn(),
            error: undefined,
            isLoading: false,
        }
    },
}))

vi.mock("i18next", () => ({
    default: {
        t: (key: string) => key,
        use: vi.fn().mockReturnThis(),
        init: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        changeLanguage: vi.fn(),
    },
    t: (key: string) => key,
}))

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: { type: "3rdParty", init: () => undefined },
    Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}))

vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({
        logout: vi.fn(),
    }),
}))

vi.mock("@/hooks/useMainStore", () => ({
    useMainStore: (
        selector?: (store: { profile: { id: number; role: number; username: string } }) => unknown,
    ) => {
        const store = { profile: { id: 1, role: 0, username: "admin" } }
        return selector ? selector(store) : store
    },
}))

vi.mock("@/hooks/useMediaQuery", () => ({
    useMediaQuery: () => true,
}))

vi.mock("@/hooks/useSetting", () => ({
    default: () => ({
        data: {
            config: {
                site_name: "Nezha",
                vpn_debug: false,
            },
        },
        isLoading: false,
    }),
}))

beforeEach(() => {
    vi.useRealTimers()
    createVPNPolicy.mockReset()
    updateVPNPolicy.mockReset()
    deleteVPNPolicy.mockReset()
    startVPNSession.mockReset()
    stopVPNSession.mockReset()
    deleteVPNSession.mockReset()
    restartVPNSession.mockReset()
    refreshVPNSessionStatus.mockReset()
    toastMock.mockReset()
    createVPNPolicy.mockResolvedValue(8)
    updateVPNPolicy.mockResolvedValue(undefined)
    deleteVPNPolicy.mockResolvedValue(undefined)
    startVPNSession.mockResolvedValue({ session_id: "vpn_session_2" })
    stopVPNSession.mockResolvedValue({ session_id: "vpn_session_1", state: "stopped" })
    deleteVPNSession.mockResolvedValue(undefined)
    restartVPNSession.mockResolvedValue({ session_id: "vpn_session_3", state: "running" })
    refreshVPNSessionStatus.mockResolvedValue({ session_id: "vpn_session_1", state: "running" })
    MockVPNWebSocket.instances = []
    Reflect.deleteProperty(globalThis, "WebSocket")
})

function switchVPNTab(name: string) {
    fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false })
}

function openActionMenu(owner: string) {
    fireEvent.pointerDown(screen.getByRole("button", { name: `Actions ${owner}` }), {
        button: 0,
        ctrlKey: false,
    })
}

function clickActionMenuItem(action: string, owner: string) {
    openActionMenu(owner)
    fireEvent.click(screen.getByRole("menuitem", { name: `${action} ${owner}` }))
}

function clickVisibleCloseButton() {
    const button = screen
        .getAllByRole("button", { name: "Close" })
        .find((element) => element.textContent === "Close")
    if (!button) throw new Error("visible Close button not found")
    fireEvent.click(button)
}

test("Proxy Tunnel page exposes the planned dashboard tabs with debug hidden by default", () => {
    render(<VPNPage />)

    expect(screen.getByRole("heading", { name: "VPN.Title" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "VPN.Overview" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "VPN.Policy" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "VPN.Session" })).toBeTruthy()
    expect(screen.queryByRole("tab", { name: "VPN.Debug" })).toBeNull()
    expect(screen.queryByRole("tab", { name: "VPN.Audit" })).toBeNull()
})

test("Proxy Tunnel overview shows Proxy Tunnel-capable agent status", () => {
    render(<VPNPage />)

    expect(screen.getByRole("img", { name: "VPN.Topology" })).toBeTruthy()
    expect(screen.getByText("entry-cn")).toBeTruthy()
    expect(screen.getByText("exit-jp")).toBeTruthy()
    expect(screen.getByText("VPN.FlowRelay")).toBeTruthy()
    expect(screen.getAllByText("VPN.ActiveSessions").length).toBeGreaterThan(0)
})

test("Proxy Tunnel page renders API policies and sessions, and calls session actions", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    expect(screen.getByText("github split")).toBeTruthy()
    expect(screen.getAllByText("entry-cn").length).toBeGreaterThan(0)
    expect(screen.getAllByText("exit-jp").length).toBeGreaterThan(0)

    switchVPNTab("VPN.Session")
    expect(screen.getByText("vpn_session_1")).toBeTruthy()
    expect(screen.getByText("123 B / 456 B")).toBeTruthy()

    clickActionMenuItem("VPN.StopSession", "vpn_session_1")
    expect(stopVPNSession).not.toHaveBeenCalled()
    expect(screen.getByText("VPN.ConfirmStopSession")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() => {
        expect(stopVPNSession).toHaveBeenCalledWith("vpn_session_1")
    })

    clickActionMenuItem("VPN.RefreshSession", "vpn_session_1")
    await waitFor(() => {
        expect(refreshVPNSessionStatus).toHaveBeenCalledWith("vpn_session_1")
    })
})

test("Proxy Tunnel policy tab edits, deletes, and requires TUN risk confirmation", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.EditPolicy", "github split")
    fireEvent.change(screen.getByLabelText("Name"), {
        target: { value: "github split edited" },
    })
    fireEvent.change(screen.getByLabelText("VPN.DirectCIDRs"), {
        target: { value: "127.0.0.0/8\n10.0.0.0/8" },
    })
    fireEvent.change(screen.getByLabelText("VPN.MaxUpload"), {
        target: { value: "3145728" },
    })
    fireEvent.change(screen.getByLabelText("VPN.MaxDownload"), {
        target: { value: "4194304" },
    })
    fireEvent.change(screen.getByLabelText("VPN.IdleTimeout"), {
        target: { value: "120" },
    })
    expect((screen.getByLabelText("VPN.CoreVersion") as HTMLInputElement).value).toBe("1.12.0")
    fireEvent.change(screen.getByLabelText("VPN.CoreVersion"), {
        target: { value: " 1.13.0 " },
    })
    expect((screen.getByLabelText("VPN.CoreDownloadURL") as HTMLInputElement).value).toBe(
        "https://download.example.com/sing-box.exe",
    )
    fireEvent.change(screen.getByLabelText("VPN.CoreDownloadURL"), {
        target: { value: " https://cdn.example.com/sing-box.exe " },
    })
    expect((screen.getByLabelText("VPN.CoreSHA256") as HTMLInputElement).value).toBe(validSHA256)
    fireEvent.change(screen.getByLabelText("VPN.CoreSHA256"), {
        target: { value: ` ${validSHA256} ` },
    })
    fireEvent.click(screen.getByLabelText("VPN.SetSystemProxy"))
    expect((screen.getByLabelText("VPN.EgressProbeURL") as HTMLInputElement).value).toBe(
        "https://ifconfig.example/ip",
    )
    fireEvent.change(screen.getByLabelText("VPN.EgressProbeURL"), {
        target: { value: " https://ip.example.com/plain " },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    await waitFor(() => {
        expect(updateVPNPolicy).toHaveBeenCalledWith(
            7,
            expect.objectContaining({
                name: "github split edited",
                direct_cidrs: ["127.0.0.0/8", "10.0.0.0/8"],
                max_upload_bytes: 3145728,
                max_download_bytes: 4194304,
                idle_timeout_seconds: 120,
                core_version: "1.13.0",
                core_download_url: "https://cdn.example.com/sing-box.exe",
                core_sha256: validSHA256,
                set_system_proxy: true,
                egress_probe_url: "https://ip.example.com/plain",
            }),
        )
    })

    clickActionMenuItem("VPN.DeletePolicy", "github split")
    expect(deleteVPNPolicy).not.toHaveBeenCalled()
    expect(screen.getByText("ConfirmDeletion")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() => {
        expect(deleteVPNPolicy).toHaveBeenCalledWith([7])
    })
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })

    updateVPNPolicy.mockClear()
    clickActionMenuItem("VPN.EditPolicy", "global tunnel")
    expect((screen.getByLabelText("VPN.TunHealthURL") as HTMLInputElement).value).toBe(
        "https://old.example.com/generate_204",
    )
    fireEvent.change(screen.getByLabelText("VPN.TunHealthURL"), {
        target: { value: " https://connectivity.example.com/generate_204 " },
    })
    expect((screen.getByLabelText("VPN.TunName") as HTMLInputElement).value).toBe("nezha-vpn")
    fireEvent.change(screen.getByLabelText("VPN.TunName"), {
        target: { value: "nezha-vpn-custom" },
    })
    expect((screen.getByLabelText("VPN.DNSServer") as HTMLInputElement).value).toBe(
        "https://1.1.1.1/dns-query",
    )
    fireEvent.change(screen.getByLabelText("VPN.DNSServer"), {
        target: { value: " https://9.9.9.9/dns-query " },
    })
    fireEvent.change(screen.getByLabelText("VPN.TunHealthTimeout"), {
        target: { value: "7" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))
    expect(updateVPNPolicy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("VPN.TunRiskConfirm"))
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))
    await waitFor(() => {
        expect(updateVPNPolicy).toHaveBeenCalledWith(
            8,
            expect.objectContaining({
                mode: "tun_global",
                tun_name: "nezha-vpn-custom",
                dns_server: "https://9.9.9.9/dns-query",
                tun_health_url: "https://connectivity.example.com/generate_204",
                tun_health_timeout_seconds: 7,
            }),
        )
    })
})

test("Proxy Tunnel policy form validates listen addresses and CIDR before saving", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.EditPolicy", "github split")
    fireEvent.change(screen.getByLabelText("VPN.LocalSocks"), {
        target: { value: "0.0.0.0:1080" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationLoopbackListen" }),
    )

    toastMock.mockClear()
    fireEvent.change(screen.getByLabelText("VPN.LocalSocks"), {
        target: { value: "127.0.0.1:1080" },
    })
    fireEvent.change(screen.getByLabelText("VPN.DirectCIDRs"), {
        target: { value: "not-a-cidr" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationCIDRInvalid" }),
    )
})

test("Proxy Tunnel policy form validates URLs and SHA256 before saving", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.EditPolicy", "github split")
    fireEvent.change(screen.getByLabelText("VPN.CoreDownloadURL"), {
        target: { value: "file:///tmp/sing-box" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationHTTPURLInvalid" }),
    )

    toastMock.mockClear()
    fireEvent.change(screen.getByLabelText("VPN.CoreDownloadURL"), {
        target: { value: "https://cdn.example.com/sing-box.exe" },
    })
    fireEvent.change(screen.getByLabelText("VPN.CoreSHA256"), {
        target: { value: "sha256:abcdef" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationSHA256Invalid" }),
    )

    toastMock.mockClear()
    fireEvent.change(screen.getByLabelText("VPN.CoreSHA256"), {
        target: { value: `sha256:${validSHA256}` },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationSHA256Invalid" }),
    )

    toastMock.mockClear()
    fireEvent.change(screen.getByLabelText("VPN.CoreSHA256"), {
        target: { value: `SHA256:${validSHA256}` },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationSHA256Invalid" }),
    )

    toastMock.mockClear()
    fireEvent.change(screen.getByLabelText("VPN.CoreSHA256"), {
        target: { value: validSHA256 },
    })
    fireEvent.change(screen.getByLabelText("VPN.EgressProbeURL"), {
        target: { value: "ftp://ip.example.com/plain" },
    })
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationHTTPURLInvalid" }),
    )

    toastMock.mockClear()
    clickVisibleCloseButton()
    clickActionMenuItem("VPN.EditPolicy", "global tunnel")
    fireEvent.change(screen.getByLabelText("VPN.TunHealthURL"), {
        target: { value: "file:///tmp/health" },
    })
    fireEvent.click(screen.getByLabelText("VPN.TunRiskConfirm"))
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    expect(updateVPNPolicy).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(
        "Error",
        expect.objectContaining({ description: "VPN.ValidationHTTPURLInvalid" }),
    )
})

test("Proxy Tunnel policy tab copies a saved policy into a new form", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.CopyPolicy", "github split")

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("github split copy")
    fireEvent.click(screen.getByRole("button", { name: "VPN.SavePolicy" }))

    await waitFor(() => {
        expect(createVPNPolicy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "github split copy",
                entry_server_id: 1,
                exit_server_id: 2,
                mode: "system_proxy",
                domains: ["github.com"],
            }),
        )
    })
    expect(updateVPNPolicy).not.toHaveBeenCalled()
})

test("Proxy Tunnel policy form start button is disabled when the policy has a session", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.EditPolicy", "global tunnel")

    const formStartButton = screen.getByRole("button", {
        name: "VPN.StartSession",
    }) as HTMLButtonElement
    expect(formStartButton.disabled).toBe(true)
    fireEvent.click(formStartButton)
    expect(startVPNSession).not.toHaveBeenCalled()
})

test("Proxy Tunnel new policy button resets the form into create mode", () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    clickActionMenuItem("VPN.EditPolicy", "global tunnel")

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("global tunnel")
    expect(
        (screen.getByRole("button", { name: "VPN.StartSession" }) as HTMLButtonElement).disabled,
    ).toBe(true)

    clickVisibleCloseButton()
    fireEvent.click(screen.getByRole("button", { name: "VPN.NewPolicy" }))

    expect(screen.getByRole("dialog", { name: "VPN.PolicyForm" })).toBeTruthy()
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("")
    expect(
        (screen.getByRole("button", { name: "VPN.StartSession" }) as HTMLButtonElement).disabled,
    ).toBe(true)
})

test("Proxy Tunnel policy start is blocked when a policy already has a session", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    openActionMenu("github split")
    expect(
        screen
            .getByRole("menuitem", { name: "VPN.StartSession github split" })
            .getAttribute("aria-disabled"),
    ).toBe("true")

    expect(startVPNSession).not.toHaveBeenCalled()
})

test("Proxy Tunnel session tab starts inactive sessions from the primary action", async () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Session")
    clickActionMenuItem("VPN.StartSession", "vpn_session_2")

    await waitFor(() => {
        expect(restartVPNSession).toHaveBeenCalledWith("vpn_session_2")
    })
})

test("Proxy Tunnel session actions are gated by session state", () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Session")

    expect(
        screen
            .getByRole("button", { name: "Actions vpn_session_1" })
            .getAttribute("data-disabled"),
    ).toBeNull()
    expect(
        screen
            .getByRole("button", { name: "Actions vpn_session_2" })
            .getAttribute("data-disabled"),
    ).toBeNull()

    openActionMenu("vpn_session_1")
    expect(
        (
            screen.getByRole("menuitem", {
                name: "VPN.StopSession vpn_session_1",
            }) as HTMLElement
        ).getAttribute("aria-disabled"),
    ).toBeNull()
    expect(
        (
            screen.getByRole("menuitem", {
                name: "VPN.RefreshSession vpn_session_1",
            }) as HTMLElement
        ).getAttribute("aria-disabled"),
    ).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })

    openActionMenu("vpn_session_2")
    expect(
        (
            screen.getByRole("menuitem", {
                name: "VPN.StartSession vpn_session_2",
            }) as HTMLElement
        ).getAttribute("aria-disabled"),
    ).toBeNull()
    expect(
        (
            screen.getByRole("menuitem", {
                name: "VPN.RefreshSession vpn_session_2",
            }) as HTMLElement
        ).getAttribute("aria-disabled"),
    ).toBeNull()
    expect(
        (
            screen.getByRole("menuitem", {
                name: "VPN.DeleteSession vpn_session_2",
            }) as HTMLElement
        ).getAttribute("aria-disabled"),
    ).toBeNull()
})

test("Proxy Tunnel session tab filters sessions by state and entry or exit node", () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Session")
    expect(screen.getByRole("row", { name: /vpn_session_1/ })).toBeTruthy()
    expect(screen.getByRole("row", { name: /vpn_session_2/ })).toBeTruthy()

    fireEvent.change(screen.getByLabelText("VPN.SessionStateFilter"), {
        target: { value: "failed" },
    })
    expect(screen.queryByRole("row", { name: /vpn_session_1/ })).toBeNull()
    expect(screen.getByRole("row", { name: /vpn_session_2/ })).toBeTruthy()

    fireEvent.change(screen.getByLabelText("VPN.SessionEntryFilter"), {
        target: { value: "1" },
    })
    expect(screen.queryByRole("row", { name: /vpn_session_1/ })).toBeNull()
    expect(screen.queryByRole("row", { name: /vpn_session_2/ })).toBeNull()
    expect(screen.getByText("NoResults")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("VPN.SessionEntryFilter"), {
        target: { value: "all" },
    })
    fireEvent.change(screen.getByLabelText("VPN.SessionExitFilter"), {
        target: { value: "1" },
    })
    expect(screen.queryByRole("row", { name: /vpn_session_1/ })).toBeNull()
    expect(screen.getByRole("row", { name: /vpn_session_2/ })).toBeTruthy()
})

test("Proxy Tunnel table action buttons include visible text labels", () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Policy")
    openActionMenu("github split")
    expect(screen.getByRole("menuitem", { name: "VPN.StartSession github split" }).textContent)
        .toContain("VPN.StartSession")
    expect(screen.getByRole("menuitem", { name: "VPN.DeletePolicy github split" }).textContent)
        .toContain("VPN.DeletePolicy")
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })

    switchVPNTab("VPN.Session")
    openActionMenu("vpn_session_1")
    expect(screen.getByRole("menuitem", { name: "VPN.StopSession vpn_session_1" }).textContent)
        .toContain("VPN.StopSession")
    expect(screen.getByRole("menuitem", { name: "VPN.RefreshSession vpn_session_1" }).textContent)
        .toContain("VPN.RefreshSession")
    expect(screen.getByRole("menuitem", { name: "VPN.ViewSessionLog vpn_session_1" }).textContent)
        .toContain("VPN.ViewSessionLog")
    expect(screen.getByRole("menuitem", { name: "VPN.DeleteSession vpn_session_1" }).textContent)
        .toContain("VPN.DeleteSession")
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })

    openActionMenu("vpn_session_2")
    expect(screen.getByRole("menuitem", { name: "VPN.StartSession vpn_session_2" }).textContent)
        .toContain("VPN.StartSession")
})

test("Proxy Tunnel session tab opens a per-session log dialog", async () => {
    vi.stubGlobal("WebSocket", MockVPNWebSocket)

    render(<VPNPage />)

    switchVPNTab("VPN.Session")
    clickActionMenuItem("VPN.ViewSessionLog", "vpn_session_2")

    await waitFor(() => {
        expect(MockVPNWebSocket.instances.length).toBe(1)
    })
    expect(MockVPNWebSocket.instances[0].url).toContain("/api/v1/ws/vpn/session/vpn_session_2")

    act(() => {
        MockVPNWebSocket.instances[0].sendFrame({
            session: { session_id: "vpn_session_2", entry_state: "failed", exit_state: "running" },
            logs: ["session failed"],
        })
    })

    expect(screen.getByText(/session failed/)).toBeTruthy()
})

test("Proxy Tunnel session log stream appends, caps logs, and reconnects", async () => {
    vi.stubGlobal("WebSocket", MockVPNWebSocket)

    render(<VPNPage />)

    switchVPNTab("VPN.Session")
    clickActionMenuItem("VPN.ViewSessionLog", "vpn_session_1")

    await waitFor(() => {
        expect(MockVPNWebSocket.instances.length).toBe(1)
    })
    expect(MockVPNWebSocket.instances[0].url).toContain("/api/v1/ws/vpn/session/vpn_session_1")

    const lines = Array.from({ length: 1005 }, (_, index) => `line-${index}`)
    act(() => {
        MockVPNWebSocket.instances[0].sendFrame({
            session: { session_id: "vpn_session_1", state: "running" },
            logs: lines,
        })
    })

    expect(screen.queryByText(/line-0/)).toBeNull()
    expect(screen.getByText(/line-1004/)).toBeTruthy()

    vi.useFakeTimers()
    try {
        act(() => {
            MockVPNWebSocket.instances[0].disconnect()
        })
        expect(screen.getByText("VPN.LogReconnecting")).toBeTruthy()

        await act(async () => {
            vi.advanceTimersByTime(1000)
        })
        expect(MockVPNWebSocket.instances.length).toBe(2)
        expect(MockVPNWebSocket.instances[1].url).toContain("/api/v1/ws/vpn/session/vpn_session_1")
    } finally {
        vi.useRealTimers()
    }
})

test("Proxy Tunnel session log stream displays server-provided log lines", async () => {
    vi.stubGlobal("WebSocket", MockVPNWebSocket)

    render(<VPNPage />)

    switchVPNTab("VPN.Session")
    clickActionMenuItem("VPN.ViewSessionLog", "vpn_session_1")

    await waitFor(() => {
        expect(MockVPNWebSocket.instances.length).toBe(1)
    })

    act(() => {
        MockVPNWebSocket.instances[0].sendFrame({
            session: {
                session_id: "vpn_session_1",
                entry_state: "running",
                exit_state: "running",
            },
            logs: ["[08:00:01] sidecar accepted connection"],
        })
    })

    expect(screen.getByText("[08:00:01] sidecar accepted connection")).toBeTruthy()
})

test("Proxy Tunnel session tab keeps detailed fields in the detail dialog", () => {
    render(<VPNPage />)

    switchVPNTab("VPN.Session")

    expect(screen.getByRole("columnheader", { name: "Session" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "VPN.Traffic" })).toBeTruthy()
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy()
    expect(screen.queryByRole("columnheader", { name: "VPN.PolicyName" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.Mode" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.ActiveConnections" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.LocalProxy" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.TunName" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.StartedAt" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.ExpiresAt" })).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "VPN.LastError" })).toBeNull()

    expect(screen.queryByText("global tunnel")).toBeNull()
    expect(screen.queryByText("VPN.ModeTunGlobal")).toBeNull()
    expect(screen.queryByText("nezha-vpn")).toBeNull()
    expect(screen.queryByText("tun preflight failed")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "VPN.Detail vpn_session_2" }))

    expect(screen.getByText("global tunnel")).toBeTruthy()
    expect(screen.getByText("VPN.ModeTunGlobal")).toBeTruthy()
    expect(screen.getByText("nezha-vpn")).toBeTruthy()
    expect(screen.getByText("3")).toBeTruthy()
    expect(screen.getByText("2026-06-08T13:00:00+08:00")).toBeTruthy()
    expect(screen.getByText("2026-06-08T15:00:00+08:00")).toBeTruthy()
    expect(screen.getByText("tun preflight failed")).toBeTruthy()
})

test("header exposes Proxy Tunnel navigation entry", () => {
    render(
        <MemoryRouter initialEntries={["/dashboard"]}>
            <Header />
        </MemoryRouter>,
    )

    const links = screen.getAllByRole("link", { name: "VPN.Nav" })
    expect(links.some((link) => link.getAttribute("href") === "/dashboard/vpn")).toBe(true)
})

test("Proxy Tunnel detail label is present in all locale files", () => {
    expect(zhCNTranslation.VPN.Detail).toBe("详情")
    expect(zhTWTranslation.VPN.Detail).toBe("詳情")
    expect(enTranslation.VPN.Detail).toBe("Detail")
})

test("Proxy Tunnel action labels are present in all locale files", () => {
    const expectedActionLabels = [
        "ActionCreatePolicy",
        "ActionUpdatePolicy",
        "ActionDeletePolicy",
        "ActionStartSession",
        "ActionStopSession",
        "ActionRestartSession",
        "ActionStatusSession",
    ]

    for (const key of expectedActionLabels) {
        expect(zhCNTranslation.VPN[key as keyof typeof zhCNTranslation.VPN]).toBeTruthy()
        expect(zhTWTranslation.VPN[key as keyof typeof zhTWTranslation.VPN]).toBeTruthy()
        expect(enTranslation.VPN[key as keyof typeof enTranslation.VPN]).toBeTruthy()
    }

    expect(zhCNTranslation.VPN.ConfirmStopSession).toBeTruthy()
    expect(zhTWTranslation.VPN.ConfirmStopSession).toBeTruthy()
    expect(enTranslation.VPN.ConfirmStopSession).toBeTruthy()
    expect(zhCNTranslation.VPN.ConfirmDeleteSession).toBeTruthy()
    expect(zhTWTranslation.VPN.ConfirmDeleteSession).toBeTruthy()
    expect(enTranslation.VPN.ConfirmDeleteSession).toBeTruthy()
    expect(zhCNTranslation.VPN.ConfirmRestartSession).toBeTruthy()
    expect(zhTWTranslation.VPN.ConfirmRestartSession).toBeTruthy()
    expect(enTranslation.VPN.ConfirmRestartSession).toBeTruthy()
    expect(zhCNTranslation.VPN.NewPolicy).toBeTruthy()
    expect(zhTWTranslation.VPN.NewPolicy).toBeTruthy()
    expect(enTranslation.VPN.NewPolicy).toBeTruthy()
    expect(zhCNTranslation.VPN.SessionStateFilter).toBeTruthy()
    expect(zhTWTranslation.VPN.SessionStateFilter).toBeTruthy()
    expect(enTranslation.VPN.SessionStateFilter).toBeTruthy()
    expect(zhCNTranslation.VPN.SessionEntryFilter).toBeTruthy()
    expect(zhTWTranslation.VPN.SessionEntryFilter).toBeTruthy()
    expect(enTranslation.VPN.SessionEntryFilter).toBeTruthy()
    expect(zhCNTranslation.VPN.SessionExitFilter).toBeTruthy()
    expect(zhTWTranslation.VPN.SessionExitFilter).toBeTruthy()
    expect(enTranslation.VPN.SessionExitFilter).toBeTruthy()
    expect(zhCNTranslation.VPN.LogConnecting).toBeTruthy()
    expect(zhTWTranslation.VPN.LogConnecting).toBeTruthy()
    expect(enTranslation.VPN.LogConnecting).toBeTruthy()
    expect(zhCNTranslation.VPN.LogReconnecting).toBeTruthy()
    expect(zhTWTranslation.VPN.LogReconnecting).toBeTruthy()
    expect(enTranslation.VPN.LogReconnecting).toBeTruthy()
    expect(zhCNTranslation.VPN.TunName).toBeTruthy()
    expect(zhTWTranslation.VPN.TunName).toBeTruthy()
    expect(enTranslation.VPN.TunName).toBeTruthy()
})
