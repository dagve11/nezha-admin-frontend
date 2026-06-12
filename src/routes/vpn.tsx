import { swrFetcher } from "@/api/api"
import {
    createVPNPolicy,
    deleteVPNPolicy,
    refreshVPNSessionStatus,
    restartVPNSession,
    startVPNSession,
    stopVPNSession,
    updateVPNPolicy,
} from "@/api/vpn"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useNotification } from "@/hooks/useNotfication"
import { useServer } from "@/hooks/useServer"
import {
    ModelAgentVPNPolicy,
    ModelAgentVPNPolicyForm,
    ModelAgentVPNSession,
    ModelVPNSessionStreamFrame,
    ServerIdentifierType,
} from "@/types"
import {
    Activity,
    ArrowRight,
    ClipboardList,
    Copy,
    FileClock,
    FileText,
    Globe2,
    Pencil,
    Network,
    Play,
    RotateCw,
    Server,
    ShieldCheck,
    Square,
    Trash2,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

const initialForm: ModelAgentVPNPolicyForm = {
    name: "",
    entry_server_id: 0,
    exit_server_id: 0,
    mode: "system_proxy",
    rule_mode: "domain",
    domains: [],
    cidrs: [],
    direct_cidrs: [],
    listen_http: "127.0.0.1:8088",
    listen_socks: "127.0.0.1:1080",
    tun_name: "nezha-vpn",
    dns_server: "https://1.1.1.1/dns-query",
    expires_seconds: 3600,
    max_upload_bytes: 0,
    max_download_bytes: 0,
    max_connections: 128,
    idle_timeout_seconds: 0,
    notification_group_id: 0,
    auto_restart: true,
    set_system_proxy: false,
    tun_health_url: "",
    tun_health_timeout_seconds: 10,
    egress_probe_url: "",
    core_version: "",
    core_download_url: "",
    core_sha256: "",
}

const newInitialForm = (): ModelAgentVPNPolicyForm => ({
    ...initialForm,
    domains: [],
    cidrs: [],
    direct_cidrs: [],
})

const maxVPNLogLines = 1000
const vpnSessionStates = [
    "starting",
    "running",
    "stopping",
    "stopped",
    "failed",
    "limited",
    "expired",
    "lost",
    "unknown",
]

export default function VPNPage() {
    const { t } = useTranslation()
    const { servers = [] } = useServer()
    const { notifierGroup = [] } = useNotification()
    const [form, setForm] = useState<ModelAgentVPNPolicyForm>(() => newInitialForm())
    const [editingPolicyID, setEditingPolicyID] = useState<number | null>(null)
    const [tunRiskConfirmed, setTunRiskConfirmed] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")
    const [selectedSessionID, setSelectedSessionID] = useState("")
    const [sessionFilters, setSessionFilters] = useState({
        state: "all",
        entry: "all",
        exit: "all",
    })
    const [sessionLogs, setSessionLogs] = useState<string[]>([
        "[vpn] dashboard control plane ready",
        "[vpn] relay stream: waiting for session",
    ])
    const [logAutoScroll, setLogAutoScroll] = useState(true)
    const logRef = useRef<HTMLPreElement>(null)
    const serverNameByID = useMemo(
        () => new Map(servers.map((server) => [server.id, server.name])),
        [servers],
    )
    const notifierNameByID = useMemo(
        () => new Map(notifierGroup.map((item) => [item.group.id, item.group.name])),
        [notifierGroup],
    )
    const serverName = useCallback(
        (id?: number) => serverNameByID.get(id ?? 0) ?? `#${id || "-"}`,
        [serverNameByID],
    )
    const notifierName = useCallback(
        (id?: number) => notifierNameByID.get(id ?? 0) ?? (id ? `#${id}` : "-"),
        [notifierNameByID],
    )
    const serverNameRef = useRef(serverName)

    const {
        data: policies = [],
        mutate: mutatePolicies,
    } = useSWR<ModelAgentVPNPolicy[]>("/api/v1/vpn/policy", swrFetcher)
    const {
        data: sessions = [],
        mutate: mutateSessions,
    } = useSWR<ModelAgentVPNSession[]>("/api/v1/vpn/session", swrFetcher)
    const sessionsRef = useRef(sessions)
    const mutateSessionsRef = useRef(mutateSessions)
    const selectedSessionLogRef = useRef("")
    const selectedSessionRawLogsRef = useRef<string[]>([])

    useEffect(() => {
        sessionsRef.current = sessions
    }, [sessions])

    useEffect(() => {
        mutateSessionsRef.current = mutateSessions
    }, [mutateSessions])

    useEffect(() => {
        serverNameRef.current = serverName
    }, [serverName])

    useEffect(() => {
        if (!selectedSessionID && sessions.length > 0) {
            setSelectedSessionID(sessions[0].session_id)
        }
    }, [selectedSessionID, sessions])

    useEffect(() => {
        if (!selectedSessionID) return
        if (selectedSessionLogRef.current !== selectedSessionID) {
            selectedSessionLogRef.current = selectedSessionID
            selectedSessionRawLogsRef.current = []
            setSessionLogs([`[dashboard] opening VPN log stream for ${selectedSessionID}`])
        }
        if (typeof WebSocket === "undefined") {
            const current = sessionsRef.current.find((session) => session.session_id === selectedSessionID)
            const lastError = current?.last_error
            if (lastError) {
                setSessionLogs((logs) => appendSessionLogLines(logs, [lastError]))
            }
            return
        }
        const scheme = window.location.protocol === "https:" ? "wss" : "ws"
        let ws: WebSocket | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let closedByEffect = false

        const connect = (attempt: number) => {
            ws = new WebSocket(
                `${scheme}://${window.location.host}/api/v1/ws/vpn/session/${selectedSessionID}`,
            )
            ws.onmessage = (event) => {
                try {
                    const frame = JSON.parse(event.data) as ModelVPNSessionStreamFrame
                    if (frame.session?.session_id) {
                        void mutateSessionsRef.current((current = []) =>
                            upsertSession(current, frame.session),
                        false)
                    }
                    if (frame.logs?.length) {
                        const rawLogs = normalizeSessionLogLines(frame.logs)
                        const newLogs = diffSessionLogSnapshot(selectedSessionRawLogsRef.current, rawLogs)
                        selectedSessionRawLogsRef.current = rawLogs
                        if (newLogs.length === 0) return
                        const currentSession = mergeSessionSnapshot(
                            sessionsRef.current,
                            frame.session,
                            selectedSessionID,
                        )
                        setSessionLogs((logs) =>
                            appendSessionLogLines(
                                logs,
                                formatVPNSessionLogLines(newLogs, currentSession, serverNameRef.current),
                            ),
                        )
                    } else if (frame.session?.last_error) {
                        setSessionLogs((logs) =>
                            appendSessionLogLines(
                                logs,
                                formatVPNSessionLogLines(
                                    [frame.session.last_error ?? ""],
                                    frame.session,
                                    serverNameRef.current,
                                ),
                            ),
                        )
                    }
                } catch (error) {
                    setSessionLogs((logs) => appendSessionLogLines(logs, [String(error)]))
                }
            }
            ws.onclose = () => {
                if (closedByEffect) return
                const delay = Math.min(1000 * 2 ** attempt, 10000)
                setSessionLogs((logs) =>
                    appendSessionLogLines(logs, [
                        `[dashboard] reconnecting VPN log stream in ${Math.round(delay / 1000)}s`,
                    ]),
                )
                reconnectTimer = setTimeout(() => connect(attempt + 1), delay)
            }
            ws.onerror = () => {
                ws?.close()
            }
        }

        connect(0)

        return () => {
            closedByEffect = true
            if (reconnectTimer) clearTimeout(reconnectTimer)
            ws?.close()
        }
    }, [selectedSessionID])

    function selectSessionLog(sessionID: string, initialLine?: string) {
        selectedSessionLogRef.current = sessionID
        selectedSessionRawLogsRef.current = []
        setSelectedSessionID(sessionID)
        setActiveTab("session")
        setLogAutoScroll(true)
        setSessionLogs([initialLine || `[dashboard] opening VPN log stream for ${sessionID}`])
    }

    useEffect(() => {
        if (!logRef.current || !logAutoScroll) return
        logRef.current.scrollTop = logRef.current.scrollHeight
    }, [logAutoScroll, sessionLogs])

    const handleLogScroll = () => {
        const logElement = logRef.current
        if (!logElement) return
        const distanceToBottom = logElement.scrollHeight - logElement.scrollTop - logElement.clientHeight
        setLogAutoScroll(distanceToBottom <= 8)
    }

    const activeSessions = sessions.filter((session) => session.state === "running")
    const abnormalSessions = sessions.filter((session) =>
        ["failed", "lost", "unknown"].includes(session.state),
    )
    const totalTraffic = sessions.reduce(
        (sum, session) => sum + (session.upload_bytes ?? 0) + (session.download_bytes ?? 0),
        0,
    )
    const vpnCapableServers = useMemo(
        () => servers.filter((server) => isVPNCapableServer(server)),
        [servers],
    )
    const topologyServers = useMemo(
        () =>
            servers.filter((server) =>
                isVPNCapableServer(server) ||
                server.id === form.entry_server_id ||
                server.id === form.exit_server_id,
            ),
        [form.entry_server_id, form.exit_server_id, servers],
    )
    const filteredSessions = useMemo(
        () => sessions.filter((session) =>
            (sessionFilters.state === "all" || session.state === sessionFilters.state) &&
            (sessionFilters.entry === "all" || String(session.entry_server_id) === sessionFilters.entry) &&
            (sessionFilters.exit === "all" || String(session.exit_server_id) === sessionFilters.exit),
        ),
        [sessionFilters.entry, sessionFilters.exit, sessionFilters.state, sessions],
    )
    const overviewItems = useMemo(
        () => [
            { key: "VPN.EntryReady", value: String(vpnCapableServers.length), icon: ShieldCheck },
            { key: "VPN.ExitReady", value: String(vpnCapableServers.length), icon: Server },
            { key: "VPN.ActiveSessions", value: String(activeSessions.length), icon: Activity },
            { key: "VPN.AbnormalSessions", value: String(abnormalSessions.length), icon: FileClock },
        ],
        [abnormalSessions.length, activeSessions.length, vpnCapableServers.length],
    )

    async function handleSavePolicy() {
        if (isTunMode(form.mode) && !tunRiskConfirmed) {
            toast(t("Error"), { description: t("VPN.TunRiskRequired") })
            return
        }
        try {
            const payload = normalizePolicyForm(form)
            const validationError = validatePolicyFormClient(payload)
            if (validationError) {
                toast(t("Error"), { description: t(validationError) })
                return
            }
            if (editingPolicyID) {
                await updateVPNPolicy(editingPolicyID, payload)
            } else {
                await createVPNPolicy(payload)
            }
            toast(t("Success"))
            await mutatePolicies()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleDeletePolicy(policyID: number) {
        try {
            await deleteVPNPolicy([policyID])
            if (editingPolicyID === policyID) {
                setEditingPolicyID(null)
                setForm(newInitialForm())
                setTunRiskConfirmed(false)
            }
            await mutatePolicies()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    function handleEditPolicy(policy: ModelAgentVPNPolicy) {
        setEditingPolicyID(policy.id)
        setForm(policyToForm(policy))
        setTunRiskConfirmed(!isTunMode(policy.mode))
    }

    function handleCopyPolicy(policy: ModelAgentVPNPolicy) {
        setEditingPolicyID(null)
        setForm({
            ...policyToForm(policy),
            name: `${policy.name} copy`,
        })
        setTunRiskConfirmed(!isTunMode(policy.mode))
        setActiveTab("policy")
    }

    async function handleStartPolicy(policyID: number) {
        try {
            const session = await startVPNSession(policyID)
            selectSessionLog(session.session_id, `[dashboard] start request submitted for policy ${policyID}`)
            setActiveTab("session")
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleStopSession(sessionID: string) {
        try {
            selectSessionLog(sessionID, `[dashboard] stop request submitted for ${sessionID}`)
            await stopVPNSession(sessionID)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleRestartSession(sessionID: string) {
        try {
            selectSessionLog(sessionID, `[dashboard] restart request submitted for ${sessionID}`)
            const session = await restartVPNSession(sessionID)
            selectedSessionLogRef.current = session.session_id
            setSelectedSessionID(session.session_id)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleRefreshSession(sessionID: string) {
        try {
            selectSessionLog(sessionID, `[dashboard] status request submitted for ${sessionID}`)
            const session = await refreshVPNSessionStatus(sessionID)
            await mutateSessions((current = []) => upsertSession(current, session), false)
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    function handleViewSessionLog(sessionID: string) {
        selectSessionLog(sessionID)
        setActiveTab("session")
    }

    async function handleCopySessionProxy(session: ModelAgentVPNSession) {
        const proxy = getSessionProxyAddress(session, policies)
        if (!proxy) return
        try {
            await copyTextToClipboard(proxy)
            toast(t("CopiedToClipboard"))
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    return (
        <div className="px-3">
            <div className="mt-6 mb-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{t("VPN.Title")}</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">{t("VPN.PageHint")}</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="overview" onClick={() => setActiveTab("overview")}>
                        {t("VPN.Overview")}
                    </TabsTrigger>
                    <TabsTrigger value="policy" onClick={() => setActiveTab("policy")}>
                        {t("VPN.Policy")}
                    </TabsTrigger>
                    <TabsTrigger value="session" onClick={() => setActiveTab("session")}>
                        {t("VPN.Session")}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                        {overviewItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <div
                                    key={item.key}
                                    className="rounded-md border bg-card p-4 text-card-foreground"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            {t(item.key)}
                                        </span>
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="mt-3 text-2xl font-semibold">{item.value}</div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                        <section className="rounded-md border p-4">
                            <div className="flex items-center gap-2">
                                <Network className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">{t("VPN.FlowTitle")}</h2>
                            </div>
                            <div className="mt-4 grid gap-2 text-sm">
                                <FlowStep label={t("VPN.FlowEntry")} value={form.listen_socks || "-"} />
                                <FlowStep label={t("VPN.FlowRelay")} value="Dashboard Relay" />
                                <FlowStep label={t("VPN.FlowExit")} value={serverName(form.exit_server_id)} />
                                <FlowStep label={t("VPN.FlowTarget")} value="Internet" />
                            </div>
                        </section>

                        <LogPanel
                            badge={selectedSessionID ? selectedSessionID : t("VPN.LogIdle")}
                            label={t("VPN.LiveLog")}
                            logs={sessionLogs}
                            refEl={logRef}
                            onScroll={handleLogScroll}
                        />
                    </div>

                    <section className="rounded-md border p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <h2 className="text-base font-semibold">{t("VPN.AgentCapability")}</h2>
                            </div>
                            <Badge variant="outline">{formatBytes(totalTraffic)}</Badge>
                        </div>
                        {vpnCapableServers.length === 0 ? (
                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                {t("VPN.NoAvailableAgent")}
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("Server")}</TableHead>
                                        <TableHead>{t("Status")}</TableHead>
                                        <TableHead>{t("VPN.Platform")}</TableHead>
                                        <TableHead>{t("VPN.Capability")}</TableHead>
                                        <TableHead>{t("VPN.CoreVersion")}</TableHead>
                                        <TableHead>{t("VPN.LastError")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vpnCapableServers.map((server) => (
                                        <TableRow key={server.id}>
                                            <TableCell className="font-medium">{server.name}</TableCell>
                                            <TableCell>{vpnAgentStatusLabel(t, server)}</TableCell>
                                            <TableCell>{vpnAgentPlatform(server)}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {vpnAgentCapabilityBadges(t, server).map((label) => (
                                                        <Badge key={label} variant="secondary">
                                                            {label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>{vpnAgentCoreVersion(t, server)}</TableCell>
                                            <TableCell className="max-w-72 break-words">
                                                {server.host?.vpn_last_error || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </section>
                </TabsContent>

                <TabsContent value="policy" className="space-y-4">
                    <section className="rounded-md border p-4">
                        <div className="mb-4 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold">{t("VPN.PolicyForm")}</h2>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                            <div className="relative overflow-hidden rounded-md border bg-zinc-950 p-4 text-zinc-50">
                                <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:18px_18px]" />
                                <div className="relative mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold">{t("VPN.Topology")}</h3>
                                        <p className="mt-1 text-xs text-zinc-400">{t("VPN.TopologyHint")}</p>
                                    </div>
                                    <Badge variant="outline" className="border-zinc-700 bg-zinc-900/80 text-zinc-200">
                                        {modeLabel(t, form.mode)}
                                    </Badge>
                                </div>
                                <div className="relative grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,0.8fr)]">
                                    <TopologyNode
                                        icon={<Server className="h-5 w-5" />}
                                        label={t("VPN.EntryServer")}
                                        value={
                                            form.entry_server_id
                                                ? serverName(form.entry_server_id)
                                                : t("VPN.SelectAgent")
                                        }
                                    >
                                        <Select
                                            value={String(form.entry_server_id)}
                                            onValueChange={(value) =>
                                                setFormValue(setForm, "entry_server_id", Number(value))
                                            }
                                        >
                                            <SelectTrigger id="vpn-entry-server" className="bg-zinc-950/80 text-zinc-50">
                                                <SelectValue placeholder={t("VPN.EntryServer")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0" disabled>
                                                    {t("VPN.SelectAgent")}
                                                </SelectItem>
                                                {topologyServers.map((server) => (
                                                    <SelectItem key={server.id} value={String(server.id)}>
                                                        {server.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TopologyNode>
                                    <TopologyConnector />
                                    <TopologyNode
                                        icon={<Network className="h-5 w-5" />}
                                        label={t("VPN.FlowRelay")}
                                        value="Dashboard Relay"
                                    />
                                    <TopologyConnector />
                                    <TopologyNode
                                        icon={<Server className="h-5 w-5" />}
                                        label={t("VPN.ExitServer")}
                                        value={
                                            form.exit_server_id
                                                ? serverName(form.exit_server_id)
                                                : t("VPN.SelectAgent")
                                        }
                                    >
                                        <Select
                                            value={String(form.exit_server_id)}
                                            onValueChange={(value) =>
                                                setFormValue(setForm, "exit_server_id", Number(value))
                                            }
                                        >
                                            <SelectTrigger id="vpn-exit-server" className="bg-zinc-950/80 text-zinc-50">
                                                <SelectValue placeholder={t("VPN.ExitServer")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0" disabled>
                                                    {t("VPN.SelectAgent")}
                                                </SelectItem>
                                                {topologyServers.map((server) => (
                                                    <SelectItem key={server.id} value={String(server.id)}>
                                                        {server.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TopologyNode>
                                    <TopologyConnector />
                                    <TopologyNode
                                        icon={<Globe2 className="h-5 w-5" />}
                                        label={t("VPN.FlowTarget")}
                                        value="Internet"
                                    />
                                </div>
                            </div>
                            <div className="rounded-md border p-4">
                                <h3 className="mb-4 text-sm font-semibold">{t("VPN.BasicSettings")}</h3>
                                <div className="space-y-4">
                                    <Field label={t("Name")} id="vpn-policy-name">
                                        <Input
                                            id="vpn-policy-name"
                                            value={form.name}
                                            onChange={(event) => setFormValue(setForm, "name", event.target.value)}
                                            placeholder="GitHub Split"
                                        />
                                    </Field>
                                    <Field label={t("VPN.Mode")} id="vpn-policy-mode">
                                        <Select
                                            value={form.mode}
                                            onValueChange={(value) => {
                                                setFormValue(setForm, "mode", value)
                                                setTunRiskConfirmed(!isTunMode(value))
                                            }}
                                        >
                                            <SelectTrigger id="vpn-policy-mode">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="system_proxy">{t("VPN.ModeSystemProxy")}</SelectItem>
                                                <SelectItem value="tun_split">{t("VPN.ModeTunSplit")}</SelectItem>
                                                <SelectItem value="tun_global">{t("VPN.ModeTunGlobal")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label={t("VPN.RuleMode")} id="vpn-rule-mode">
                                        <Select
                                            value={form.rule_mode}
                                            onValueChange={(value) =>
                                                setFormValue(setForm, "rule_mode", value)
                                            }
                                        >
                                            <SelectTrigger id="vpn-rule-mode">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="global">{t("VPN.RuleModeGlobal")}</SelectItem>
                                                <SelectItem value="domain">{t("VPN.RuleModeDomain")}</SelectItem>
                                                <SelectItem value="ip">{t("VPN.RuleModeIP")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>
                            </div>
                        </div>
                        <details className="mt-4 rounded-md border bg-muted/20 p-4">
                            <summary className="cursor-pointer text-sm font-semibold">{t("VPN.AdvancedSettings")}</summary>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <Field label={t("VPN.LocalSocks")} id="vpn-local-socks">
                                    <Input
                                        id="vpn-local-socks"
                                        value={form.listen_socks}
                                        onChange={(event) =>
                                            setFormValue(setForm, "listen_socks", event.target.value)
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.LocalHTTP")} id="vpn-local-http">
                                    <Input
                                        id="vpn-local-http"
                                        value={form.listen_http}
                                        onChange={(event) =>
                                            setFormValue(setForm, "listen_http", event.target.value)
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.TunName")} id="vpn-tun-name">
                                    <Input
                                        id="vpn-tun-name"
                                        value={form.tun_name}
                                        onChange={(event) =>
                                            setFormValue(setForm, "tun_name", event.target.value)
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.DNSServer")} id="vpn-dns-server">
                                    <Input
                                        id="vpn-dns-server"
                                        value={form.dns_server}
                                        onChange={(event) =>
                                            setFormValue(setForm, "dns_server", event.target.value)
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.DomainRules")} id="vpn-domain-rules">
                                    <Textarea
                                        id="vpn-domain-rules"
                                        className="min-h-24"
                                        value={form.domains.join("\n")}
                                        onChange={(event) =>
                                            setFormValue(setForm, "domains", splitLines(event.target.value))
                                        }
                                        placeholder={"github.com\napi.github.com"}
                                    />
                                </Field>
                                <Field label={t("VPN.CIDRRules")} id="vpn-cidr-rules">
                                    <Textarea
                                        id="vpn-cidr-rules"
                                        className="min-h-24"
                                        value={form.cidrs.join("\n")}
                                        onChange={(event) =>
                                            setFormValue(setForm, "cidrs", splitLines(event.target.value))
                                        }
                                        placeholder={"140.82.112.0/20\n20.205.243.0/24"}
                                    />
                                </Field>
                                <Field label={t("VPN.DirectCIDRs")} id="vpn-direct-cidrs">
                                    <Textarea
                                        id="vpn-direct-cidrs"
                                        className="min-h-24"
                                        value={form.direct_cidrs.join("\n")}
                                        onChange={(event) =>
                                            setFormValue(setForm, "direct_cidrs", splitLines(event.target.value))
                                        }
                                        placeholder={"127.0.0.0/8\n10.0.0.0/8"}
                                    />
                                </Field>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                                <Field label={t("VPN.Expires")} id="vpn-expires">
                                    <Input
                                        id="vpn-expires"
                                        type="number"
                                        value={form.expires_seconds}
                                        onChange={(event) =>
                                            setFormValue(setForm, "expires_seconds", Number(event.target.value))
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.MaxUpload")} id="vpn-max-upload">
                                    <Input
                                        id="vpn-max-upload"
                                        type="number"
                                        min={0}
                                        value={form.max_upload_bytes}
                                        onChange={(event) =>
                                            setFormValue(setForm, "max_upload_bytes", Number(event.target.value))
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.MaxDownload")} id="vpn-max-download">
                                    <Input
                                        id="vpn-max-download"
                                        type="number"
                                        min={0}
                                        value={form.max_download_bytes}
                                        onChange={(event) =>
                                            setFormValue(setForm, "max_download_bytes", Number(event.target.value))
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.MaxConnections")} id="vpn-max-connections">
                                    <Input
                                        id="vpn-max-connections"
                                        type="number"
                                        value={form.max_connections}
                                        onChange={(event) =>
                                            setFormValue(setForm, "max_connections", Number(event.target.value))
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.IdleTimeout")} id="vpn-idle-timeout">
                                    <Input
                                        id="vpn-idle-timeout"
                                        type="number"
                                        min={0}
                                        value={form.idle_timeout_seconds}
                                        onChange={(event) =>
                                            setFormValue(setForm, "idle_timeout_seconds", Number(event.target.value))
                                        }
                                    />
                                </Field>
                                <Field label={t("VPN.NotificationGroup")} id="vpn-notify-group">
                                    <Select
                                        value={String(form.notification_group_id)}
                                        onValueChange={(value) =>
                                            setFormValue(setForm, "notification_group_id", Number(value))
                                        }
                                    >
                                        <SelectTrigger id="vpn-notify-group">
                                            <SelectValue placeholder={t("VPN.NotificationGroup")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">-</SelectItem>
                                            {notifierGroup.map((item) => (
                                                <SelectItem key={item.group.id} value={String(item.group.id)}>
                                                    {item.group.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            </div>
                            <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 p-3">
                                <Label htmlFor="vpn-auto-restore">{t("VPN.AutoRestore")}</Label>
                                <Switch
                                    id="vpn-auto-restore"
                                    checked={form.auto_restart}
                                    onCheckedChange={(checked) =>
                                        setFormValue(setForm, "auto_restart", checked)
                                    }
                                />
                            </div>
                            <div className="mt-4 grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[12rem_1fr] xl:grid-cols-[12rem_1fr_1fr]">
                                <Field label={t("VPN.CoreVersion")} id="vpn-core-version">
                                    <Input
                                        id="vpn-core-version"
                                        value={form.core_version}
                                        onChange={(event) =>
                                            setFormValue(setForm, "core_version", event.target.value)
                                        }
                                        placeholder="1.12.0"
                                    />
                                </Field>
                                <Field label={t("VPN.CoreDownloadURL")} id="vpn-core-download-url">
                                    <Input
                                        id="vpn-core-download-url"
                                        value={form.core_download_url}
                                        onChange={(event) =>
                                            setFormValue(setForm, "core_download_url", event.target.value)
                                        }
                                        placeholder="https://example.com/sing-box.exe"
                                    />
                                </Field>
                                <Field label={t("VPN.CoreSHA256")} id="vpn-core-sha256">
                                    <Input
                                        id="vpn-core-sha256"
                                        value={form.core_sha256}
                                        onChange={(event) =>
                                            setFormValue(setForm, "core_sha256", event.target.value)
                                        }
                                        placeholder="0123456789abcdef..."
                                    />
                                </Field>
                            </div>
                            {form.mode === "system_proxy" && (
                                <div className="mt-4 grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[12rem_1fr]">
                                    <div className="flex items-center justify-between md:col-span-2">
                                        <Label htmlFor="vpn-set-system-proxy">{t("VPN.SetSystemProxy")}</Label>
                                        <Switch
                                            id="vpn-set-system-proxy"
                                            checked={form.set_system_proxy}
                                            onCheckedChange={(checked) =>
                                                setFormValue(setForm, "set_system_proxy", checked)
                                            }
                                        />
                                    </div>
                                    <Field label={t("VPN.EgressProbeURL")} id="vpn-egress-probe-url">
                                        <Input
                                            id="vpn-egress-probe-url"
                                            value={form.egress_probe_url}
                                            onChange={(event) =>
                                                setFormValue(setForm, "egress_probe_url", event.target.value)
                                            }
                                            placeholder="https://ifconfig.me/ip"
                                        />
                                    </Field>
                                </div>
                            )}
                            {isTunMode(form.mode) && (
                                <div className="mt-4 grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[1fr_12rem]">
                                    <Field label={t("VPN.TunHealthURL")} id="vpn-tun-health-url">
                                        <Input
                                            id="vpn-tun-health-url"
                                            value={form.tun_health_url}
                                            onChange={(event) =>
                                                setFormValue(setForm, "tun_health_url", event.target.value)
                                            }
                                            placeholder="https://connectivitycheck.gstatic.com/generate_204"
                                        />
                                    </Field>
                                    <Field label={t("VPN.TunHealthTimeout")} id="vpn-tun-health-timeout">
                                        <Input
                                            id="vpn-tun-health-timeout"
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={form.tun_health_timeout_seconds}
                                            onChange={(event) =>
                                                setFormValue(
                                                    setForm,
                                                    "tun_health_timeout_seconds",
                                                    Number(event.target.value),
                                                )
                                            }
                                        />
                                    </Field>
                                </div>
                            )}
                            {isTunMode(form.mode) && (
                                <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                                    <label
                                        htmlFor="vpn-tun-risk-confirm"
                                        className="flex items-start gap-3 text-sm"
                                    >
                                        <input
                                            id="vpn-tun-risk-confirm"
                                            type="checkbox"
                                            aria-label={t("VPN.TunRiskConfirm")}
                                            checked={tunRiskConfirmed}
                                            onChange={(event) =>
                                                setTunRiskConfirmed(event.target.checked)
                                            }
                                            className="mt-1 h-4 w-4"
                                        />
                                        <span>
                                            <span className="block font-medium">
                                                {t("VPN.TunRiskConfirm")}
                                            </span>
                                            <span className="mt-1 block text-muted-foreground">
                                                {t("VPN.TunRiskHint")}
                                            </span>
                                        </span>
                                    </label>
                                </div>
                            )}
                        </details>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => void handleSavePolicy()}>
                                {t("VPN.SavePolicy")}
                            </Button>
                            <Button
                                disabled={editingPolicyID === null}
                                onClick={() => {
                                    if (editingPolicyID !== null) void handleStartPolicy(editingPolicyID)
                                }}
                            >
                                <Play className="mr-2 h-4 w-4" />
                                {t("VPN.StartSession")}
                            </Button>
                        </div>
                    </section>

                    <section className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>{t("Name")}</TableHead>
                                    <TableHead>{t("VPN.EntryServer")}</TableHead>
                                    <TableHead>{t("VPN.ExitServer")}</TableHead>
                                    <TableHead>{t("VPN.Mode")}</TableHead>
                                    <TableHead>{t("VPN.NotificationGroup")}</TableHead>
                                    <TableHead>{t("Actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {policies.map((policy) => (
                                    <TableRow key={policy.id}>
                                        <TableCell>{policy.id}</TableCell>
                                        <TableCell>{policy.name}</TableCell>
                                        <TableCell>{serverName(policy.entry_server_id)}</TableCell>
                                        <TableCell>{serverName(policy.exit_server_id)}</TableCell>
                                        <TableCell>{modeLabel(t, policy.mode)}</TableCell>
                                        <TableCell>{notifierName(policy.notification_group_id)}</TableCell>
                                        <TableCell className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 whitespace-nowrap"
                                                aria-label={`${t("VPN.EditPolicy")} ${policy.name}`}
                                                onClick={() => handleEditPolicy(policy)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                <span>{t("VPN.EditPolicy")}</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 whitespace-nowrap"
                                                aria-label={`${t("VPN.CopyPolicy")} ${policy.name}`}
                                                onClick={() => handleCopyPolicy(policy)}
                                            >
                                                <Copy className="h-4 w-4" />
                                                <span>{t("VPN.CopyPolicy")}</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-1.5 whitespace-nowrap"
                                                aria-label={`${t("VPN.StartSession")} ${policy.name}`}
                                                onClick={() => void handleStartPolicy(policy.id)}
                                            >
                                                <Play className="h-4 w-4" />
                                                <span>{t("VPN.StartSession")}</span>
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="gap-1.5 whitespace-nowrap text-white"
                                                        aria-label={`${t("VPN.DeletePolicy")} ${policy.name}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span>{t("VPN.DeletePolicy")}</span>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="sm:max-w-lg">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t("ConfirmDeletion")}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t("Results.ThisOperationIsUnrecoverable")}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className={buttonVariants({
                                                                variant: "destructive",
                                                                className: "text-white",
                                                            })}
                                                            onClick={() => void handleDeletePolicy(policy.id)}
                                                        >
                                                            {t("Confirm")}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                </TabsContent>

                <TabsContent value="session" className="space-y-4">
                    <section className="rounded-md border p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                            <NativeField label={t("VPN.SessionStateFilter")} id="vpn-session-state-filter">
                                <select
                                    id="vpn-session-state-filter"
                                    className="h-10 rounded-md border bg-background px-3 text-sm"
                                    value={sessionFilters.state}
                                    onChange={(event) =>
                                        setSessionFilter(setSessionFilters, "state", event.target.value)
                                    }
                                >
                                    <option value="all">{t("VPN.FilterAll")}</option>
                                    {vpnSessionStates.map((state) => (
                                        <option key={state} value={state}>
                                            {state}
                                        </option>
                                    ))}
                                </select>
                            </NativeField>
                            <NativeField label={t("VPN.SessionEntryFilter")} id="vpn-session-entry-filter">
                                <select
                                    id="vpn-session-entry-filter"
                                    className="h-10 rounded-md border bg-background px-3 text-sm"
                                    value={sessionFilters.entry}
                                    onChange={(event) =>
                                        setSessionFilter(setSessionFilters, "entry", event.target.value)
                                    }
                                >
                                    <option value="all">{t("VPN.FilterAll")}</option>
                                    {servers.map((server) => (
                                        <option key={server.id} value={String(server.id)}>
                                            {server.name}
                                        </option>
                                    ))}
                                </select>
                            </NativeField>
                            <NativeField label={t("VPN.SessionExitFilter")} id="vpn-session-exit-filter">
                                <select
                                    id="vpn-session-exit-filter"
                                    className="h-10 rounded-md border bg-background px-3 text-sm"
                                    value={sessionFilters.exit}
                                    onChange={(event) =>
                                        setSessionFilter(setSessionFilters, "exit", event.target.value)
                                    }
                                >
                                    <option value="all">{t("VPN.FilterAll")}</option>
                                    {servers.map((server) => (
                                        <option key={server.id} value={String(server.id)}>
                                            {server.name}
                                        </option>
                                    ))}
                                </select>
                            </NativeField>
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    className="w-full gap-1.5 whitespace-nowrap"
                                    onClick={() => void mutateSessions()}
                                >
                                    <RotateCw className="h-4 w-4" />
                                    <span>{t("VPN.Refresh")}</span>
                                </Button>
                            </div>
                        </div>
                    </section>
                    <section className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Session</TableHead>
                                    <TableHead>{t("VPN.PolicyName")}</TableHead>
                                    <TableHead>{t("VPN.EntryServer")}</TableHead>
                                    <TableHead>{t("VPN.ExitServer")}</TableHead>
                                    <TableHead>{t("VPN.Mode")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                    <TableHead>{t("VPN.Traffic")}</TableHead>
                                    <TableHead>{t("VPN.ActiveConnections")}</TableHead>
                                    <TableHead>{t("VPN.LocalProxy")}</TableHead>
                                    <TableHead>{t("VPN.TunName")}</TableHead>
                                    <TableHead>{t("VPN.StartedAt")}</TableHead>
                                    <TableHead>{t("VPN.ExpiresAt")}</TableHead>
                                    <TableHead>{t("VPN.LastError")}</TableHead>
                                    <TableHead>{t("Actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSessions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={14} className="h-24 text-center">
                                            {t("NoResults")}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredSessions.map((session) => {
                                    const canStop = canStopVPNSession(session)
                                    const canRestart = canRestartVPNSession(session)
                                    const canRefresh = canRefreshVPNSession(session)
                                    return (
                                        <TableRow key={session.session_id}>
                                            <TableCell>{session.session_id}</TableCell>
                                            <TableCell>{sessionPolicyName(session, policies)}</TableCell>
                                            <TableCell>{serverName(session.entry_server_id)}</TableCell>
                                            <TableCell>{serverName(session.exit_server_id)}</TableCell>
                                            <TableCell>{modeLabel(t, session.mode)}</TableCell>
                                            <TableCell>
                                                <Badge variant={session.state === "running" ? "default" : "secondary"}>
                                                    {session.state}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {formatBytes(session.upload_bytes)} /{" "}
                                                {formatBytes(session.download_bytes)}
                                            </TableCell>
                                            <TableCell>{session.active_connections ?? 0}</TableCell>
                                            <TableCell>{sessionLocalProxy(session, policies)}</TableCell>
                                            <TableCell>{sessionTunName(session, policies)}</TableCell>
                                            <TableCell>{session.started_at || "-"}</TableCell>
                                            <TableCell>{session.expires_at || "-"}</TableCell>
                                            <TableCell>{session.last_error || "-"}</TableCell>
                                            <TableCell className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5 whitespace-nowrap"
                                                    aria-label={`${t("VPN.ViewSessionLog")} ${session.session_id}`}
                                                    onClick={() => handleViewSessionLog(session.session_id)}
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    <span>{t("VPN.ViewSessionLog")}</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5 whitespace-nowrap"
                                                    aria-label={`${t("VPN.CopyProxy")} ${session.session_id}`}
                                                    disabled={!getSessionProxyAddress(session, policies)}
                                                    onClick={() => void handleCopySessionProxy(session)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    <span>{t("VPN.CopyProxy")}</span>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="gap-1.5 whitespace-nowrap text-white"
                                                            aria-label={`${t("VPN.StopSession")} ${session.session_id}`}
                                                            disabled={!canStop}
                                                        >
                                                            <Square className="h-4 w-4" />
                                                            <span>{t("VPN.StopSession")}</span>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="sm:max-w-lg">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>{t("VPN.ConfirmStopSession")}</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {t("Results.ThisOperationIsUnrecoverable")}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                className={buttonVariants({
                                                                    variant: "destructive",
                                                                    className: "text-white",
                                                                })}
                                                                onClick={() => void handleStopSession(session.session_id)}
                                                            >
                                                                {t("Confirm")}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5 whitespace-nowrap"
                                                            aria-label={`${t("VPN.RestartSession")} ${session.session_id}`}
                                                            disabled={!canRestart}
                                                        >
                                                            <Play className="h-4 w-4" />
                                                            <span>{t("VPN.RestartSession")}</span>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="sm:max-w-lg">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>{t("VPN.ConfirmRestartSession")}</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {t("Results.ThisOperationIsUnrecoverable")}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => void handleRestartSession(session.session_id)}
                                                            >
                                                                {t("Confirm")}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5 whitespace-nowrap"
                                                    aria-label={`${t("VPN.RefreshSession")} ${session.session_id}`}
                                                    disabled={!canRefresh}
                                                    onClick={() => void handleRefreshSession(session.session_id)}
                                                >
                                                    <RotateCw className="h-4 w-4" />
                                                    <span>{t("VPN.RefreshSession")}</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </section>

                    <LogPanel
                        badge={selectedSessionID ? selectedSessionID : t("VPN.LogIdle")}
                        label={t("VPN.SessionLog")}
                        logs={sessionLogs}
                        refEl={logRef}
                        onScroll={handleLogScroll}
                    />
                </TabsContent>

            </Tabs>
        </div>
    )
}

function Field({
    children,
    id,
    label,
}: {
    children: React.ReactNode
    id: string
    label: string
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {children}
        </div>
    )
}

function NativeField({
    children,
    id,
    label,
}: {
    children: React.ReactNode
    id: string
    label: string
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex flex-col">{children}</div>
        </div>
    )
}

function FlowStep({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="break-all font-medium">{value}</span>
        </div>
    )
}

function TopologyNode({
    children,
    icon,
    label,
    value,
}: {
    children?: React.ReactNode
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex min-h-36 flex-col justify-between rounded-md border border-zinc-700 bg-zinc-900/95 p-4 text-zinc-50 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-1 truncate text-xs text-zinc-400">{value || "-"}</div>
                </div>
            </div>
            {children ? <div className="mt-4">{children}</div> : null}
        </div>
    )
}

function TopologyConnector() {
    return (
        <div className="flex min-h-8 items-center justify-center text-zinc-400">
            <div className="hidden w-full items-center lg:flex">
                <div className="h-px flex-1 bg-zinc-600" />
                <ArrowRight className="mx-1 h-4 w-4" />
                <div className="h-px flex-1 bg-zinc-600" />
            </div>
            <div className="h-8 w-px bg-zinc-600 lg:hidden" />
        </div>
    )
}

function LogPanel({
    badge,
    label,
    logs,
    refEl,
    onScroll,
}: {
    badge: string
    label: string
    logs: string[]
    refEl: React.RefObject<HTMLPreElement | null>
    onScroll: React.UIEventHandler<HTMLPreElement>
}) {
    return (
        <section className="rounded-md border bg-black p-4 text-green-100">
            <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-100">{label}</span>
                <Badge variant="outline" className="border-zinc-700 text-zinc-200">
                    {badge}
                </Badge>
            </div>
            <pre
                ref={refEl}
                className="min-h-56 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6"
                role="log"
                aria-label={label}
                onScroll={onScroll}
            >
                {logs.join("\n")}
            </pre>
        </section>
    )
}

function splitLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
}

function appendSessionLogLines(current: string[], incoming: string[]): string[] {
    const next = [
        ...current,
        ...incoming.map((line) => line.trimEnd()).filter(Boolean),
    ]
    if (next.length <= maxVPNLogLines) return next
    return next.slice(next.length - maxVPNLogLines)
}

function normalizeSessionLogLines(lines: string[]): string[] {
    return lines.map((line) => line.trimEnd()).filter(Boolean)
}

function diffSessionLogSnapshot(previous: string[], incoming: string[]): string[] {
    if (previous.length === 0) return incoming
    const maxOverlap = Math.min(previous.length, incoming.length)
    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
        if (arraysEqual(previous.slice(previous.length - overlap), incoming.slice(0, overlap))) {
            return incoming.slice(overlap)
        }
    }
    return incoming
}

function arraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false
    return left.every((item, index) => item === right[index])
}

async function copyTextToClipboard(value: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return
    }
    const textarea = document.createElement("textarea")
    textarea.value = value
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    textarea.style.top = "0"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
        if (!document.execCommand("copy")) {
            throw new Error("copy command failed")
        }
    } finally {
        document.body.removeChild(textarea)
    }
}

function formatVPNSessionLogLines(
    lines: string[],
    session: ModelAgentVPNSession | undefined,
    serverName: (id?: number) => string,
): string[] {
    return lines.map((line) => {
        const message = line.trimEnd()
        if (!message || message.startsWith("[")) return message
        const sessionID = session?.session_id ?? "-"
        const roleState = `entry:${session?.entry_state ?? "-"}/exit:${session?.exit_state ?? "-"}`
        const path = `${serverName(session?.entry_server_id)} -> ${serverName(session?.exit_server_id)}`
        return `[${formatLogTime(new Date())}] [${sessionID}] [${roleState}] [${path}] ${message}`
    })
}

function mergeSessionSnapshot(
    sessions: ModelAgentVPNSession[],
    incoming: ModelAgentVPNSession | undefined,
    selectedSessionID: string,
): ModelAgentVPNSession | undefined {
    const base = sessions.find((session) =>
        session.session_id === (incoming?.session_id || selectedSessionID),
    )
    if (!incoming) return base
    return { ...base, ...incoming }
}

function formatLogTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

function setFormValue<K extends keyof ModelAgentVPNPolicyForm>(
    setForm: React.Dispatch<React.SetStateAction<ModelAgentVPNPolicyForm>>,
    key: K,
    value: ModelAgentVPNPolicyForm[K],
) {
    setForm((current) => ({ ...current, [key]: value }))
}

function normalizePolicyForm(form: ModelAgentVPNPolicyForm): ModelAgentVPNPolicyForm {
    return {
        ...form,
        name: form.name.trim() || "Agent VPN",
        domains: form.domains.filter(Boolean),
        cidrs: form.cidrs.filter(Boolean),
        direct_cidrs: form.direct_cidrs.filter(Boolean),
        dns_server: form.dns_server.trim(),
        idle_timeout_seconds: Math.max(form.idle_timeout_seconds || 0, 0),
        tun_health_url: form.tun_health_url.trim(),
        tun_health_timeout_seconds: Math.min(Math.max(form.tun_health_timeout_seconds || 10, 1), 60),
        egress_probe_url: form.egress_probe_url.trim(),
        core_version: form.core_version.trim(),
        core_download_url: form.core_download_url.trim(),
        core_sha256: form.core_sha256.trim(),
    }
}

function validatePolicyFormClient(form: ModelAgentVPNPolicyForm): string | null {
    if (form.entry_server_id === 0 || form.exit_server_id === 0) return "VPN.ValidationServerRequired"
    if (form.entry_server_id === form.exit_server_id) return "VPN.ValidationSameServer"
    if (form.mode === "system_proxy" && !form.listen_http && !form.listen_socks) {
        return "VPN.ValidationProxyListenRequired"
    }
    if (!validateListenAddress(form.listen_http) || !validateListenAddress(form.listen_socks)) {
        return "VPN.ValidationListenInvalid"
    }
    if (!isLoopbackListenAddress(form.listen_http) || !isLoopbackListenAddress(form.listen_socks)) {
        return "VPN.ValidationLoopbackListen"
    }
    if (form.rule_mode === "domain" && !form.domains.every(isValidDomain)) {
        return "VPN.ValidationDomainInvalid"
    }
    if (form.rule_mode === "ip" && !form.cidrs.every(isValidCIDR)) {
        return "VPN.ValidationCIDRInvalid"
    }
    if (!form.direct_cidrs.every(isValidCIDR)) {
        return "VPN.ValidationCIDRInvalid"
    }
    if (
        !isValidHTTPURL(form.core_download_url) ||
        !isValidHTTPURL(form.egress_probe_url) ||
        !isValidHTTPURL(form.tun_health_url)
    ) {
        return "VPN.ValidationHTTPURLInvalid"
    }
    if (!isValidSHA256(form.core_sha256)) {
        return "VPN.ValidationSHA256Invalid"
    }
    if (form.expires_seconds <= 0) return "VPN.ValidationExpiresRequired"
    return null
}

function validateListenAddress(value: string): boolean {
    if (!value) return true
    const parsed = parseListenAddress(value)
    return parsed !== null && parsed.port > 0 && parsed.port <= 65535
}

function isLoopbackListenAddress(value: string): boolean {
    if (!value) return true
    const parsed = parseListenAddress(value)
    return parsed !== null && isLoopbackHost(parsed.host)
}

function parseListenAddress(value: string): { host: string; port: number } | null {
    const match = value.match(/^\[([^\]]+)]:(\d+)$/) ?? value.match(/^([^:]+):(\d+)$/)
    if (!match) return null
    return {
        host: match[1],
        port: Number(match[2]),
    }
}

function isLoopbackHost(host: string): boolean {
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

function isValidCIDR(value: string): boolean {
    if (!value) return false
    const [ip, prefix] = value.split("/")
    if (!ip || !prefix || !/^\d+$/.test(prefix)) return false
    const prefixNumber = Number(prefix)
    if (isIPv4Address(ip)) return prefixNumber >= 0 && prefixNumber <= 32
    if (isIPv6Address(ip)) return prefixNumber >= 0 && prefixNumber <= 128
    return false
}

function isIPv4Address(value: string): boolean {
    const parts = value.split(".")
    return parts.length === 4 && parts.every((part) => {
        if (!/^\d+$/.test(part)) return false
        const number = Number(part)
        return number >= 0 && number <= 255 && String(number) === String(Number(part))
    })
}

function isIPv6Address(value: string): boolean {
    return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value)
}

function isValidHTTPURL(value: string): boolean {
    if (!value) return true
    try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

function isValidSHA256(value: string): boolean {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^[0-9a-fA-F]{64}$/.test(trimmed)
}

function isValidDomain(value: string): boolean {
    if (!value || value.trim() !== value || value.length > 253) return false
    return value.split(".").every((label) =>
        label.length > 0 &&
        label.length <= 63 &&
        !label.startsWith("-") &&
        !label.endsWith("-") &&
        /^[A-Za-z0-9-]+$/.test(label),
    )
}

function policyToForm(policy: ModelAgentVPNPolicy): ModelAgentVPNPolicyForm {
    return {
        name: policy.name,
        entry_server_id: policy.entry_server_id,
        exit_server_id: policy.exit_server_id,
        mode: policy.mode,
        rule_mode: policy.rule_mode,
        domains: policy.domains ?? [],
        cidrs: policy.cidrs ?? [],
        direct_cidrs: policy.direct_cidrs ?? [],
        listen_http: policy.listen_http ?? "",
        listen_socks: policy.listen_socks ?? "",
        tun_name: policy.tun_name ?? "nezha-vpn",
        dns_server: policy.dns_server ?? "https://1.1.1.1/dns-query",
        expires_seconds: policy.expires_seconds ?? 3600,
        max_upload_bytes: policy.max_upload_bytes ?? 0,
        max_download_bytes: policy.max_download_bytes ?? 0,
        max_connections: policy.max_connections ?? 128,
        idle_timeout_seconds: policy.idle_timeout_seconds ?? 0,
        notification_group_id: policy.notification_group_id ?? 0,
        auto_restart: policy.auto_restart ?? true,
        set_system_proxy: policy.set_system_proxy ?? false,
        tun_health_url: policy.tun_health_url ?? "",
        tun_health_timeout_seconds: policy.tun_health_timeout_seconds ?? 10,
        egress_probe_url: policy.egress_probe_url ?? "",
        core_version: policy.core_version ?? "",
        core_download_url: policy.core_download_url ?? "",
        core_sha256: policy.core_sha256 ?? "",
    }
}

function isTunMode(mode: string): boolean {
    return mode === "tun_split" || mode === "tun_global"
}

function isVPNCapableServer(server: ServerIdentifierType): boolean {
    const host = server.host
    return Boolean(host?.vpn_enabled || host?.vpn_allow_system_proxy || host?.vpn_allow_tun || host?.vpn_core_version || host?.vpn_last_error)
}

function vpnAgentStatusLabel(
    t: (key: string) => string,
    server: ServerIdentifierType,
): string {
    if (!server.last_active) return t("VPN.Offline")
    const lastActive = new Date(server.last_active).getTime()
    if (Number.isNaN(lastActive)) return t("VPN.Offline")
    return Date.now() - lastActive <= 10 * 60 * 1000 ? t("VPN.Online") : t("VPN.Offline")
}

function vpnAgentPlatform(server: ServerIdentifierType): string {
    const platform = server.host?.platform ?? ""
    const arch = server.host?.arch ?? ""
    if (platform && arch) return `${platform}/${arch}`
    return platform || arch || "-"
}

function vpnAgentCapabilityBadges(
    t: (key: string) => string,
    server: ServerIdentifierType,
): string[] {
    const capabilities: string[] = []
    if (server.host?.vpn_allow_system_proxy) {
        capabilities.push(t("VPN.CapabilitySystemProxy"))
    }
    if (server.host?.vpn_allow_tun) {
        capabilities.push(t("VPN.CapabilityTun"))
    }
    return capabilities.length > 0 ? capabilities : [t("VPN.CapabilityNone")]
}

function vpnAgentCoreVersion(
    t: (key: string) => string,
    server: ServerIdentifierType,
): string {
    return server.host?.vpn_core_version || t("VPN.CoreMissing")
}

function upsertSession(
    sessions: ModelAgentVPNSession[],
    session: ModelAgentVPNSession,
): ModelAgentVPNSession[] {
    const index = sessions.findIndex((item) => item.session_id === session.session_id)
    if (index === -1) return [session, ...sessions]
    const next = sessions.slice()
    next[index] = { ...next[index], ...session }
    return next
}

function formatBytes(value?: number): string {
    const bytes = value ?? 0
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function modeLabel(t: (key: string) => string, mode: string): string {
    if (mode === "tun_split") return t("VPN.ModeTunSplit")
    if (mode === "tun_global") return t("VPN.ModeTunGlobal")
    return t("VPN.ModeSystemProxy")
}

function getSessionProxyAddress(
    session: ModelAgentVPNSession,
    policies: ModelAgentVPNPolicy[],
): string {
    if (session.mode !== "system_proxy") return ""
    const policy = policies.find((item) => item.id === session.policy_id)
    return session.local_socks || session.local_http || policy?.listen_socks || policy?.listen_http || ""
}

function canStopVPNSession(session: ModelAgentVPNSession): boolean {
    return ["running", "starting", "stopping"].includes(session.state)
}

function canRestartVPNSession(session: ModelAgentVPNSession): boolean {
    return ["running", "failed", "lost", "unknown", "stopped"].includes(session.state)
}

function canRefreshVPNSession(session: ModelAgentVPNSession): boolean {
    return Boolean(session.session_id)
}

function sessionPolicyName(
    session: ModelAgentVPNSession,
    policies: ModelAgentVPNPolicy[],
): string {
    return policies.find((item) => item.id === session.policy_id)?.name ?? `#${session.policy_id}`
}

function sessionLocalProxy(
    session: ModelAgentVPNSession,
    policies: ModelAgentVPNPolicy[],
): string {
    if (session.mode !== "system_proxy") return "-"
    const policy = policies.find((item) => item.id === session.policy_id)
    return session.local_socks || session.local_http || policy?.listen_socks || policy?.listen_http || "-"
}

function sessionTunName(
    session: ModelAgentVPNSession,
    policies: ModelAgentVPNPolicy[],
): string {
    if (!isTunMode(session.mode)) return "-"
    return session.tun_name || policies.find((item) => item.id === session.policy_id)?.tun_name || "-"
}

type VPNSessionFilters = {
    state: string
    entry: string
    exit: string
}

function setSessionFilter<K extends keyof VPNSessionFilters>(
    setFilters: React.Dispatch<React.SetStateAction<VPNSessionFilters>>,
    key: K,
    value: VPNSessionFilters[K],
) {
    setFilters((current) => ({ ...current, [key]: value }))
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
