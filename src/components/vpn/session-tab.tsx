import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ModelAgentVPNPolicy,
    ModelAgentVPNSession,
    ModelAgentVPNSessionControlForm,
    ModelVPNDiagnostic,
    ServerIdentifierType,
} from "@/types"
import {
    Eye,
    FileText,
    Globe2,
    MoreHorizontal,
    Network,
    Play,
    RotateCw,
    SlidersHorizontal,
    Square,
    Trash2,
} from "lucide-react"
import type { ReactNode } from "react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface SessionTabProps {
    sessions: ModelAgentVPNSession[]
    policies: ModelAgentVPNPolicy[]
    servers: ServerIdentifierType[]
    filters: { state: string; entry: string; exit: string }
    serverName: (id?: number) => string
    onFilterChange: (key: string, value: string) => void
    onRefresh: () => void
    onStop: (sessionID: string) => void
    onStart: (sessionID: string) => void
    onDelete: (sessionID: string) => void
    onRefreshStatus: (sessionID: string) => void
    onControl: (sessionID: string, form: ModelAgentVPNSessionControlForm) => void
}

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

const maxSessionLogLines = 1000

export const SessionTab = memo(function SessionTab({
    sessions,
    policies,
    servers,
    filters,
    serverName,
    onFilterChange,
    onRefresh,
    onStop,
    onStart,
    onDelete,
    onRefreshStatus,
    onControl,
}: SessionTabProps) {
    const { t } = useTranslation()
    const [logSession, setLogSession] = useState<ModelAgentVPNSession | null>(null)
    const [controlSessionID, setControlSessionID] = useState<string | null>(null)

    const filteredSessions = useMemo(
        () =>
            sessions.filter(
                (session) =>
                    (filters.state === "all" || session.state === filters.state) &&
                    (filters.entry === "all" ||
                        String(session.entry_server_id) === filters.entry) &&
                    (filters.exit === "all" || String(session.exit_server_id) === filters.exit),
            ),
        [filters.entry, filters.exit, filters.state, sessions],
    )
    const controlSession = useMemo(
        () => sessions.find((session) => session.session_id === controlSessionID) ?? null,
        [controlSessionID, sessions],
    )

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                        <NativeField
                            label={t("VPN.SessionStateFilter")}
                            id="vpn-session-state-filter"
                        >
                            <select
                                id="vpn-session-state-filter"
                                className="h-10 rounded-md border bg-background px-3 text-sm"
                                value={filters.state}
                                onChange={(e) => onFilterChange("state", e.target.value)}
                            >
                                <option value="all">{t("VPN.FilterAll")}</option>
                                {vpnSessionStates.map((state) => (
                                    <option key={state} value={state}>
                                        {state}
                                    </option>
                                ))}
                            </select>
                        </NativeField>
                        <NativeField
                            label={t("VPN.SessionEntryFilter")}
                            id="vpn-session-entry-filter"
                        >
                            <select
                                id="vpn-session-entry-filter"
                                className="h-10 rounded-md border bg-background px-3 text-sm"
                                value={filters.entry}
                                onChange={(e) => onFilterChange("entry", e.target.value)}
                            >
                                <option value="all">{t("VPN.FilterAll")}</option>
                                {servers.map((server) => (
                                    <option key={server.id} value={String(server.id)}>
                                        {server.name}
                                    </option>
                                ))}
                            </select>
                        </NativeField>
                        <NativeField
                            label={t("VPN.SessionExitFilter")}
                            id="vpn-session-exit-filter"
                        >
                            <select
                                id="vpn-session-exit-filter"
                                className="h-10 rounded-md border bg-background px-3 text-sm"
                                value={filters.exit}
                                onChange={(e) => onFilterChange("exit", e.target.value)}
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
                                className="group w-full gap-1.5 whitespace-nowrap"
                                onClick={onRefresh}
                            >
                                <RotateCw className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-180" />
                                <span>{t("VPN.Refresh")}</span>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[12rem]">Session</TableHead>
                                <TableHead>{t("Status")}</TableHead>
                                <TableHead>{t("VPN.Traffic")}</TableHead>
                                <TableHead className="w-24 text-right">{t("Actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSessions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredSessions.map((session) => {
                                const isActiveSession = [
                                    "running",
                                    "starting",
                                    "stopping",
                                ].includes(session.state)
                                const canStart = [
                                    "stopped",
                                    "failed",
                                    "lost",
                                    "unknown",
                                    "expired",
                                    "limited",
                                ].includes(session.state)
                                const canDelete = [
                                    "running",
                                    "starting",
                                    "stopping",
                                    "failed",
                                    "lost",
                                    "unknown",
                                    "stopped",
                                    "expired",
                                    "limited",
                                ].includes(session.state)

                                return (
                                    <TableRow
                                        key={session.session_id}
                                        className="transition-colors duration-200 ease-out hover:bg-muted/40"
                                    >
                                        <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                                            {session.session_id}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge
                                                    variant={
                                                        session.state === "running"
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                >
                                                    {session.state}
                                                </Badge>
                                                {session.recovery_state &&
                                                    session.recovery_state !== "idle" && (
                                                    <Badge variant="outline">
                                                        {session.recovery_state}
                                                    </Badge>
                                                )}
                                                {hasActionableDiagnostics(session) && (
                                                    <Badge variant="destructive">
                                                        {t("VPN.Diagnostics")}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatBytes(session.upload_bytes)} /{" "}
                                            {formatBytes(session.download_bytes)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <SessionDetailDialog
                                                    session={session}
                                                    policies={policies}
                                                    serverName={serverName}
                                                    t={t}
                                                />
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="group"
                                                            aria-label={`${t("Actions")} ${session.session_id}`}
                                                        >
                                                            <MoreHorizontal className="h-4 w-4 transition-transform duration-150 ease-out group-hover:scale-110" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-48"
                                                    >
                                                        <DropdownMenuItem
                                                            disabled={
                                                                isActiveSession ? false : !canStart
                                                            }
                                                            onClick={() =>
                                                                isActiveSession
                                                                    ? onStop(session.session_id)
                                                                    : onStart(session.session_id)
                                                            }
                                                            aria-label={`${
                                                                isActiveSession
                                                                    ? t("VPN.StopSession")
                                                                    : t("VPN.StartSession")
                                                            } ${session.session_id}`}
                                                        >
                                                            {isActiveSession ? (
                                                                <Square className="h-4 w-4" />
                                                            ) : (
                                                                <Play className="h-4 w-4" />
                                                            )}
                                                            <span>
                                                                {isActiveSession
                                                                    ? t("VPN.StopSession")
                                                                    : t("VPN.StartSession")}
                                                            </span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => setLogSession(session)}
                                                            aria-label={`${t("VPN.ViewSessionLog")} ${session.session_id}`}
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            <span>{t("VPN.ViewSessionLog")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setControlSessionID(
                                                                    session.session_id,
                                                                )
                                                                onRefreshStatus(session.session_id)
                                                            }}
                                                            aria-label={`${t("VPN.SessionControl")} ${session.session_id}`}
                                                        >
                                                            <SlidersHorizontal className="h-4 w-4" />
                                                            <span>{t("VPN.SessionControl")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                onRefreshStatus(session.session_id)
                                                            }
                                                            aria-label={`${t("VPN.RefreshSession")} ${session.session_id}`}
                                                        >
                                                            <RotateCw className="h-4 w-4" />
                                                            <span>{t("VPN.RefreshSession")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            disabled={!canDelete}
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() =>
                                                                onDelete(session.session_id)
                                                            }
                                                            aria-label={`${t("VPN.DeleteSession")} ${session.session_id}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span>{t("VPN.DeleteSession")}</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <SessionLogDialog
                session={logSession}
                open={Boolean(logSession)}
                onOpenChange={(open) => {
                    if (!open) setLogSession(null)
                }}
                t={t}
            />
            <SessionControlDialog
                session={controlSession}
                policies={policies}
                open={Boolean(controlSessionID)}
                onOpenChange={(open) => {
                    if (!open) setControlSessionID(null)
                }}
                onControl={onControl}
                t={t}
            />
        </div>
    )
})

function SessionControlDialog({
    session,
    policies,
    open,
    onOpenChange,
    onControl,
    t,
}: {
    session: ModelAgentVPNSession | null
    policies: ModelAgentVPNPolicy[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onControl: (sessionID: string, form: ModelAgentVPNSessionControlForm) => void
    t: (key: string) => string
}) {
    const policy = session ? policies.find((p) => p.id === session.policy_id) : undefined
    const [ruleMode, setRuleMode] = useState("domain")
    const [virtualNIC, setVirtualNIC] = useState(false)
    const [setSystemProxy, setSetSystemProxy] = useState(false)

    useEffect(() => {
        if (!open || !session) return
        const nextRuleMode = session.rule_mode || policy?.rule_mode || "domain"
        setRuleMode(nextRuleMode)
        setVirtualNIC(isVPNTunMode(session.mode || policy?.mode || "system_proxy"))
        setSetSystemProxy(sessionSystemProxyApplied(session, policy))
    }, [open, session, policy])

    if (!session) return null

    const handleVirtualNICChange = (checked: boolean) => {
        setVirtualNIC(checked)
        if (checked) setSetSystemProxy(false)
    }

    const handleApply = () => {
        const mode = virtualNIC
            ? ruleMode === "global"
                ? "tun_global"
                : "tun_split"
            : "system_proxy"
        onControl(session.session_id, {
            mode,
            rule_mode: ruleMode,
            set_system_proxy: !virtualNIC && setSystemProxy,
        })
        onOpenChange(false)
    }

    const handleClearProxy = () => {
        onControl(session.session_id, {
            mode: "system_proxy",
            rule_mode: ruleMode,
            set_system_proxy: false,
        })
        onOpenChange(false)
    }

    const proxyCleared = !virtualNIC && !setSystemProxy
    const actualMode = session.mode_status || session.mode || policy?.mode || "system_proxy"
    const actualRuleMode = session.rule_mode_status || session.rule_mode || policy?.rule_mode || ""
    const tunName = session.tun_interface || session.tun_name || policy?.tun_name || "nezha-vpn"
    const systemProxyStatus =
        session.system_proxy_status ||
        (session.system_proxy_applied === true
            ? "applied"
            : session.system_proxy_applied === false
                ? "disabled"
                : "unknown")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto duration-300 ease-out sm:max-w-lg">
                <DialogHeader>
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle>{t("VPN.SessionControl")}</DialogTitle>
                        {proxyCleared && <Badge variant="secondary">{t("VPN.ProxyCleared")}</Badge>}
                    </div>
                    <DialogDescription className="break-all font-mono text-xs">
                        {session.session_id}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                        <ControlStatusItem
                            label={t("VPN.RuntimeStatus")}
                            value={runtimeStatusLabel(t, session.runtime_status)}
                        />
                        <ControlStatusItem label={t("VPN.Mode")} value={modeLabel(t, actualMode)} />
                        <ControlStatusItem
                            label={t("VPN.RuleMode")}
                            value={ruleModeLabel(t, actualRuleMode)}
                        />
                        <ControlStatusItem
                            label={t("VPN.CoreStatus")}
                            value={genericStatusLabel(t, session.core_status)}
                        />
                        <ControlStatusItem
                            label={t("VPN.RuleSetStatus")}
                            value={genericStatusLabel(t, session.rules_status)}
                        />
                        <ControlStatusItem
                            label={t("VPN.SystemProxyControl")}
                            value={systemProxyStatusLabel(t, systemProxyStatus)}
                        />
                        <ControlStatusItem
                            label={t("VPN.LocalHTTP")}
                            value={session.local_http || policy?.listen_http || "-"}
                        />
                        <ControlStatusItem
                            label={t("VPN.LocalSocks")}
                            value={session.local_socks || policy?.listen_socks || "-"}
                        />
                        <ControlStatusItem
                            label={t("VPN.VirtualNIC")}
                            value={tunStatusLabel(t, session.tun_status)}
                        />
                        <ControlStatusItem label={t("VPN.TunName")} value={tunName} />
                        {session.system_proxy_current && (
                            <ControlStatusItem
                                className="sm:col-span-2"
                                label={t("VPN.Current")}
                                value={session.system_proxy_current}
                            />
                        )}
                        {session.system_proxy_expected && (
                            <ControlStatusItem
                                className="sm:col-span-2"
                                label={t("VPN.Expected")}
                                value={session.system_proxy_expected}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-1">
                        {["domain", "global", "direct"].map((mode) => (
                            <Button
                                key={mode}
                                type="button"
                                variant={ruleMode === mode ? "default" : "ghost"}
                                className="h-10"
                                onClick={() => setRuleMode(mode)}
                            >
                                {ruleModeLabel(t, mode)}
                            </Button>
                        ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-muted/20 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 font-medium">
                                    <Globe2 className="h-5 w-5" />
                                    <span>{t("VPN.SystemProxyControl")}</span>
                                </div>
                                <Switch
                                    checked={!virtualNIC && setSystemProxy}
                                    onCheckedChange={(checked) => {
                                        setVirtualNIC(false)
                                        setSetSystemProxy(checked)
                                    }}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {session.local_http || policy?.listen_http || "-"}
                            </div>
                        </div>

                        <div className="rounded-md border bg-muted/20 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 font-medium">
                                    <Network className="h-5 w-5" />
                                    <span>{t("VPN.VirtualNIC")}</span>
                                </div>
                                <Switch
                                    checked={virtualNIC}
                                    onCheckedChange={handleVirtualNICChange}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {session.tun_name || policy?.tun_name || "nezha-vpn"}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" onClick={handleClearProxy}>
                            {t("VPN.ClearSessionProxy")}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {t("Cancel")}
                        </Button>
                        <Button onClick={handleApply}>{t("VPN.ApplySessionControl")}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SessionLogDialog({
    session,
    open,
    onOpenChange,
    t,
}: {
    session: ModelAgentVPNSession | null
    open: boolean
    onOpenChange: (open: boolean) => void
    t: (key: string) => string
}) {
    const [logs, setLogs] = useState<string[]>([])
    const [status, setStatus] = useState("")
    const [streamSession, setStreamSession] = useState<ModelAgentVPNSession | null>(null)
    const retryTimerRef = useRef<number | undefined>(undefined)
    const socketRef = useRef<WebSocket | null>(null)
    const pendingLogUpdateRef = useRef<((current: string[]) => string[]) | null>(null)
    const logFlushTimerRef = useRef<number | undefined>(undefined)

    const flushPendingLogUpdate = useCallback(() => {
        const nextUpdate = pendingLogUpdateRef.current
        pendingLogUpdateRef.current = null
        if (!nextUpdate) return
        setLogs((current) => nextUpdate(current))
        setStatus("")
    }, [])

    const queueLogUpdate = useCallback(
        (updater: (current: string[]) => string[]) => {
            if (logFlushTimerRef.current === undefined && !pendingLogUpdateRef.current) {
                setLogs((current) => updater(current))
                setStatus("")
                logFlushTimerRef.current = window.setTimeout(() => {
                    logFlushTimerRef.current = undefined
                    flushPendingLogUpdate()
                }, 16)
                return
            }

            const pending = pendingLogUpdateRef.current
            pendingLogUpdateRef.current = pending ? (current) => updater(pending(current)) : updater
        },
        [flushPendingLogUpdate],
    )

    useEffect(() => {
        if (!open || !session) return

        let closed = false
        let retryCount = 0
        pendingLogUpdateRef.current = null
        window.clearTimeout(logFlushTimerRef.current)
        logFlushTimerRef.current = undefined
        setLogs([])
        setStreamSession(session)
        setStatus(t("VPN.LogConnecting"))

        const connect = () => {
            if (closed) return
            if (typeof WebSocket === "undefined") {
                setStatus(t("VPN.LogUnavailable"))
                return
            }

            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
            const socket = new WebSocket(
                `${protocol}//${window.location.host}/api/v1/ws/vpn/session/${encodeURIComponent(
                    session.session_id,
                )}`,
            )
            socketRef.current = socket
            setStatus(retryCount > 0 ? t("VPN.LogReconnecting") : t("VPN.LogConnecting"))

            socket.onmessage = (event) => {
                try {
                    const frame = JSON.parse(event.data) as {
                        session?: ModelAgentVPNSession
                        logs?: string[]
                    }
                    if (
                        frame.session?.session_id &&
                        frame.session.session_id !== session.session_id
                    ) {
                        return
                    }
                    if (frame.session) {
                        setStreamSession(frame.session)
                    }
                    if (!frame.logs?.length) return
                    const nextLines = frame.logs.map((line) => String(line))
                    queueLogUpdate(() => nextLines.slice(-maxSessionLogLines))
                } catch {
                    queueLogUpdate((current) =>
                        [...current, String(event.data)].slice(-maxSessionLogLines),
                    )
                }
            }

            socket.onerror = () => {
                socket.close()
            }
            socket.onclose = () => {
                if (closed) return
                retryCount += 1
                setStatus(t("VPN.LogReconnecting"))
                retryTimerRef.current = window.setTimeout(connect, 1000)
            }
        }

        connect()

        return () => {
            closed = true
            window.clearTimeout(retryTimerRef.current)
            pendingLogUpdateRef.current = null
            window.clearTimeout(logFlushTimerRef.current)
            logFlushTimerRef.current = undefined
            socketRef.current?.close()
            socketRef.current = null
        }
    }, [open, queueLogUpdate, session, t])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto duration-300 ease-out sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t("VPN.SessionLog")}</DialogTitle>
                    <DialogDescription className="break-all font-mono text-xs">
                        {session?.session_id || "-"}
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border bg-muted/20">
                    <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                        {status || `${logs.length} lines`}
                    </div>
                    <VPNLogInsights logs={logs} session={streamSession ?? session} t={t} />
                    <pre className="max-h-[60vh] scroll-smooth overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">
                        {logs.length > 0 ? logs.join("\n") : t("VPN.LogIdle")}
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SessionDetailDialog({
    session,
    policies,
    serverName,
    t,
}: {
    session: ModelAgentVPNSession
    policies: ModelAgentVPNPolicy[]
    serverName: (id?: number) => string
    t: (key: string) => string
}) {
    const policy = policies.find((p) => p.id === session.policy_id)

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="group"
                    aria-label={`${t("VPN.Detail")} ${session.session_id}`}
                >
                    <Eye className="h-4 w-4 transition-transform duration-150 ease-out group-hover:scale-110" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto duration-300 ease-out sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t("VPN.Detail")}</DialogTitle>
                    <DialogDescription className="break-all font-mono text-xs">
                        {session.session_id}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Session" value={session.session_id} />
                    <DetailItem
                        label={t("VPN.PolicyName")}
                        value={policy?.name || `#${session.policy_id}`}
                    />
                    <DetailItem
                        label={t("VPN.EntryServer")}
                        value={serverName(session.entry_server_id)}
                    />
                    <DetailItem
                        label={t("VPN.ExitServer")}
                        value={serverName(session.exit_server_id)}
                    />
                    <DetailItem
                        label={t("VPN.Mode")}
                        value={sessionModeLabel(t, session, policy)}
                    />
                    <DetailItem
                        label={t("VPN.RuleMode")}
                        value={ruleModeLabel(t, session.rule_mode || policy?.rule_mode || "")}
                    />
                    <DetailItem
                        label={t("VPN.SystemProxyControl")}
                        value={
                            sessionSystemProxyApplied(session, policy)
                                ? t("VPN.ControlEnabled")
                                : t("VPN.ControlDisabled")
                        }
                    />
                    <DetailItem
                        label={t("Status")}
                        value={
                            <div className="flex flex-wrap gap-1.5">
                                <Badge
                                    variant={session.state === "running" ? "default" : "secondary"}
                                >
                                    {session.state}
                                </Badge>
                                {session.recovery_state && session.recovery_state !== "idle" && (
                                    <Badge variant="outline">{session.recovery_state}</Badge>
                                )}
                            </div>
                        }
                    />
                    <DetailItem
                        label={t("VPN.RuntimeInstance")}
                        value={session.runtime_instance_id || "-"}
                    />
                    <DetailItem
                        label={t("VPN.RecoveryAttempt")}
                        value={String(session.recovery_attempt ?? 0)}
                    />
                    <DetailItem
                        label={t("VPN.RecoveryStartedAt")}
                        value={session.recovery_started_at || "-"}
                    />
                    <DetailItem
                        label={t("VPN.RecoveryNextAt")}
                        value={session.recovery_next_at || "-"}
                    />
                    <DetailItem
                        label={t("VPN.RecoveryReason")}
                        value={session.recovery_reason || "-"}
                    />
                    <DetailItem
                        label={t("VPN.RecoveryLastError")}
                        value={<VPNReadableError value={session.recovery_last_error} t={t} />}
                    />
                    <DetailItem
                        label={t("VPN.Traffic")}
                        value={`${formatBytes(session.upload_bytes)} / ${formatBytes(session.download_bytes)}`}
                    />
                    <DetailItem
                        label={t("VPN.ActiveConnections")}
                        value={String(session.active_connections ?? 0)}
                    />
                    <DetailItem
                        label={t("VPN.LocalProxy")}
                        value={
                            session.mode === "system_proxy" &&
                            sessionSystemProxyApplied(session, policy)
                                ? session.local_socks ||
                                  session.local_http ||
                                  policy?.listen_socks ||
                                  policy?.listen_http ||
                                  "-"
                                : "-"
                        }
                    />
                    <DetailItem
                        label={t("VPN.TunName")}
                        value={
                            session.mode === "tun_split" || session.mode === "tun_global"
                                ? session.tun_name || policy?.tun_name || "-"
                                : "-"
                        }
                    />
                    <DetailItem label={t("VPN.StartedAt")} value={session.started_at || "-"} />
                    <DetailItem label={t("VPN.ExpiresAt")} value={session.expires_at || "-"} />
                    <DetailItem
                        className="sm:col-span-2"
                        label={t("VPN.LastError")}
                        value={<VPNReadableError value={session.last_error} t={t} />}
                    />
                    {session.diagnostics?.length ? (
                        <DetailItem
                            className="sm:col-span-2"
                            label={t("VPN.Diagnostics")}
                            value={<VPNSessionDiagnostics diagnostics={session.diagnostics} t={t} />}
                        />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function VPNLogInsights({
    logs,
    session,
    t,
}: {
    logs: string[]
    session: ModelAgentVPNSession | null
    t: (key: string) => string
}) {
    const insights = useMemo(() => {
        const seen = new Set<string>()
        const items: VPNReadableIssue[] = []
        for (const diagnostic of session?.diagnostics ?? []) {
            const issue = issueFromVPNDiagnostic(diagnostic)
            if (!issue || seen.has(issue.titleKey)) continue
            seen.add(issue.titleKey)
            items.push(issue)
            if (items.length >= 4) break
        }
        if (items.length > 0) return items

        const recentLogs = logs.slice(-120)
        for (const line of recentLogs.slice().reverse()) {
            const issue = explainVPNLogText(line)
            if (!issue || seen.has(issue.titleKey)) continue
            if (session?.state === "running" && issue.level === "notice") continue
            seen.add(issue.titleKey)
            items.push(issue)
            if (items.length >= 4) break
        }
        return items.reverse()
    }, [logs, session?.diagnostics, session?.state])

    if (insights.length === 0) return null

    return (
        <div className="border-b bg-background/70 px-3 py-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
                {t("VPN.LogInsights")}
            </div>
            <div className="space-y-2">
                {insights.map((issue) => (
                    <VPNReadableIssueCard key={issue.titleKey} issue={issue} t={t} />
                ))}
            </div>
        </div>
    )
}

function VPNReadableError({
    value,
    t,
}: {
    value?: string
    t: (key: string) => string
}) {
    const raw = value?.trim()
    if (!raw) return <>-</>

    const issue = explainVPNLogText(raw)
    if (!issue) {
        return (
            <div className="space-y-2">
                <div className="break-words font-mono text-xs text-muted-foreground">{raw}</div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <VPNReadableIssueCard issue={issue} t={t} />
            <details className="rounded-md border bg-background/70 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    {t("VPN.RawLog")}
                </summary>
                <div className="mt-2 break-words font-mono text-xs text-muted-foreground">
                    {raw}
                </div>
            </details>
        </div>
    )
}

function VPNReadableIssueCard({
    issue,
    t,
}: {
    issue: VPNReadableIssue
    t: (key: string) => string
}) {
    const toneClass =
        issue.level === "critical"
            ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            : issue.level === "notice"
                ? "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    const adviceClass =
        issue.level === "critical"
            ? "text-red-800 dark:text-red-300"
            : issue.level === "notice"
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-amber-800 dark:text-amber-300"

    return (
        <div className={`rounded-md border px-3 py-2 text-left ${toneClass}`}>
            <div className="text-sm font-semibold">{t(issue.titleKey)}</div>
            <div className="mt-1 text-xs leading-relaxed">{t(issue.detailKey)}</div>
            <div className={`mt-1 text-xs leading-relaxed ${adviceClass}`}>{t(issue.adviceKey)}</div>
        </div>
    )
}

function VPNSessionDiagnostics({
    diagnostics,
    t,
}: {
    diagnostics: ModelVPNDiagnostic[]
    t: (key: string) => string
}) {
    return (
        <div className="space-y-2">
            {diagnostics.map((diagnostic) => {
                const issue = issueFromVPNDiagnostic(diagnostic)
                if (!issue) return null
                return (
                    <div key={`${diagnostic.code}-${diagnostic.source ?? ""}`} className="space-y-2">
                        <VPNReadableIssueCard issue={issue} t={t} />
                        {diagnostic.message && (
                            <div className="break-words rounded-md border bg-background/70 px-3 py-2 font-mono text-xs text-muted-foreground">
                                {diagnostic.message}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

interface VPNReadableIssue {
    titleKey: string
    detailKey: string
    adviceKey: string
    level: "critical" | "warning" | "notice"
}

function issueFromVPNDiagnostic(diagnostic: ModelVPNDiagnostic): VPNReadableIssue | null {
    if (!diagnostic.code) return null
    const severity =
        diagnostic.severity === "critical"
            ? "critical"
            : diagnostic.severity === "notice"
                ? "notice"
                : "warning"
    return vpnIssue(diagnostic.code, severity)
}

function explainVPNLogText(value?: string): VPNReadableIssue | null {
    const text = value?.toLowerCase() ?? ""
    if (!text.trim()) return null

    if (
        text.includes("fatal") &&
        (text.includes("decode config") ||
            text.includes("legacy inbound fields") ||
            text.includes("removed in sing-box"))
    ) {
        return vpnIssue("CoreConfigIncompatible", "critical")
    }
    if (
        text.includes("direct websocket dial failed") &&
        (text.includes("404") || text.includes("not found") || text.includes("bad handshake"))
    ) {
        return vpnIssue("WSSRouteNotFound")
    }
    if (
        text.includes("websocket: close 1006") ||
        text.includes("unexpected eof") ||
        text.includes("websocket bad handshake")
    ) {
        return vpnIssue("WSSHandshakeClosed")
    }
    if (text.includes("handshake timestamp expired") || text.includes("local cmos clock")) {
        return vpnIssue("ClockNotSynced")
    }
    if (text.includes("heartbeat_timeout") || text.includes("heartbeat timeout")) {
        return vpnIssue("HeartbeatTimeout")
    }
    if (
        text.includes("connection: open connection to") &&
        (text.includes("i/o timeout") ||
            text.includes("context deadline exceeded") ||
            text.includes("did not properly respond"))
    ) {
        return vpnIssue("DestinationTimeout", "notice")
    }
    if (
        text.includes("i/o timeout") ||
        text.includes("did not properly respond") ||
        text.includes("context deadline exceeded")
    ) {
        return vpnIssue("ConnectTimeout")
    }
    if (text.includes("network is unreachable") || text.includes("no route to host")) {
        return vpnIssue("RouteUnavailable")
    }
    if (
        text.includes("failed to receive handshake") ||
        text.includes("connection was reset") ||
        text.includes("connection reset") ||
        text.includes("recv failure")
    ) {
        return vpnIssue("TLSConnectionReset")
    }
    if (
        text.includes("connection upload closed") ||
        text.includes("connection download closed") ||
        text.includes("forcibly closed by the remote host")
    ) {
        return vpnIssue("RemoteClosed", "notice")
    }
    if (
        text.includes("lookup ") &&
        (text.includes("nxdomain") || text.includes("empty result") || text.includes("no such host"))
    ) {
        return vpnIssue("DNSFailed", "notice")
    }
    if (text.includes("socks5: request rejected")) {
        return vpnIssue("SocksRejected")
    }
    if (text.includes("address already in use") || text.includes("bind:")) {
        return vpnIssue("PortInUse")
    }
    if (text.includes("actively refused") || text.includes("connection refused")) {
        return vpnIssue("LocalServiceRefused")
    }
    if (text.includes("missing default interface")) {
        return vpnIssue("MissingDefaultInterface")
    }
    if (text.includes("legacy inbound fields") || text.includes("legacy domain strategy")) {
        return vpnIssue("SingBoxConfigDeprecated", "notice")
    }
    if (
        text.includes("certificate") ||
        text.includes("unknown authority") ||
        text.includes("fingerprint mismatch") ||
        text.includes("direct_cert_sha256 is required")
    ) {
        return vpnIssue("CertificateProblem")
    }
    if (
        text.includes("unknown vpn direct session") ||
        text.includes("invalid vpn direct session token") ||
        text.includes("unknown or invalid vpn direct session")
    ) {
        return vpnIssue("DirectSessionMismatch")
    }
    if (
        text.includes("system proxy") ||
        text.includes("proxyserver") ||
        text.includes("proxyoverride") ||
        text.includes("reg delete")
    ) {
        return vpnIssue("SystemProxyCleanup")
    }
    if (
        text.includes("state=kept-for-restore-retry") ||
        text.includes("sidecar_pid") && text.includes("kill=failed") ||
        text.includes("access is denied")
    ) {
        return vpnIssue("CleanupRetry", "notice")
    }
    if (text.includes("agent is offline") || text.includes("server ") && text.includes(" is offline")) {
        return vpnIssue("AgentOffline")
    }
    if (text.includes("using outbound/direct[direct]")) {
        return vpnIssue("DirectOutboundUsed", "notice")
    }

    return null
}

function hasActionableDiagnostics(session: ModelAgentVPNSession): boolean {
    return Boolean(
        session.diagnostics?.some(
            (diagnostic) =>
                diagnostic.severity === "critical" || diagnostic.severity === "warning",
        ),
    )
}

function vpnIssue(key: string, level: VPNReadableIssue["level"] = "warning"): VPNReadableIssue {
    return {
        titleKey: `VPN.LogIssue.${key}.Title`,
        detailKey: `VPN.LogIssue.${key}.Detail`,
        adviceKey: `VPN.LogIssue.${key}.Advice`,
        level,
    }
}

function DetailItem({
    className,
    label,
    value,
}: {
    className?: string
    label: string
    value: ReactNode
}) {
    return (
        <div className={`space-y-1 rounded-md border bg-muted/20 p-3 ${className ?? ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="break-all text-sm font-medium">{value}</div>
        </div>
    )
}

function ControlStatusItem({
    className,
    label,
    value,
}: {
    className?: string
    label: string
    value: ReactNode
}) {
    return (
        <div className={`min-w-0 space-y-1 ${className ?? ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="break-all text-sm font-medium">{value || "-"}</div>
        </div>
    )
}

function NativeField({ children, id, label }: { children: ReactNode; id: string; label: string }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex flex-col">{children}</div>
        </div>
    )
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

function sessionModeLabel(
    t: (key: string) => string,
    session: ModelAgentVPNSession,
    policy?: ModelAgentVPNPolicy,
): string {
    if (session.mode === "system_proxy" && !sessionSystemProxyApplied(session, policy)) {
        return t("VPN.ProxyCleared")
    }
    return modeLabel(t, session.mode)
}

function ruleModeLabel(t: (key: string) => string, mode: string): string {
    if (mode === "global") return t("VPN.RuleModeGlobal")
    if (mode === "direct") return t("VPN.RuleModeDirect")
    if (mode === "ip") return t("VPN.RuleModeIP")
    if (mode === "custom") return t("VPN.StatusCustom")
    if (mode === "unknown") return t("VPN.StatusUnknown")
    return t("VPN.RuleModeDomain")
}

function genericStatusLabel(t: (key: string) => string, status?: string): string {
    if (status === "ready") return t("VPN.StatusReady")
    if (status === "missing") return t("VPN.StatusMissing")
    if (status === "error") return t("VPN.StatusError")
    if (status === "custom") return t("VPN.StatusCustom")
    return t("VPN.StatusUnknown")
}

function runtimeStatusLabel(t: (key: string) => string, status?: string): string {
    if (status === "available") return t("VPN.RuntimeAvailable")
    if (status === "inactive") return t("VPN.RuntimeInactive")
    if (status === "unavailable") return t("VPN.RuntimeUnavailable")
    return t("VPN.StatusUnknown")
}

function systemProxyStatusLabel(t: (key: string) => string, status?: string): string {
    if (status === "applied") return t("VPN.SystemProxyApplied")
    if (status === "disabled") return t("VPN.SystemProxyDisabled")
    if (status === "overridden") return t("VPN.SystemProxyOverridden")
    if (status === "cleared") return t("VPN.SystemProxyCleared")
    if (status === "inactive") return t("VPN.SystemProxyInactive")
    return t("VPN.SystemProxyUnknown")
}

function tunStatusLabel(t: (key: string) => string, status?: string): string {
    if (status === "present") return t("VPN.TunPresent")
    if (status === "missing") return t("VPN.TunMissing")
    if (status === "inactive") return t("VPN.TunInactive")
    return t("VPN.TunUnknown")
}

function isVPNTunMode(mode: string): boolean {
    return mode === "tun_split" || mode === "tun_global"
}

function sessionSystemProxyApplied(
    session: ModelAgentVPNSession,
    policy?: ModelAgentVPNPolicy,
): boolean {
    if (session.system_proxy_applied !== undefined) {
        return session.system_proxy_applied
    }
    return Boolean(session.set_system_proxy ?? policy?.set_system_proxy ?? false)
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    buttonVariants,
}
