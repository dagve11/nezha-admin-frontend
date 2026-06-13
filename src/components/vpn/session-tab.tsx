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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ModelAgentVPNPolicy, ModelAgentVPNSession, ServerIdentifierType } from "@/types"
import { Eye, FileText, MoreHorizontal, Play, RotateCw, Square, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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

export function SessionTab({
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
}: SessionTabProps) {
    const { t } = useTranslation()
    const [logSession, setLogSession] = useState<ModelAgentVPNSession | null>(null)

    const filteredSessions = sessions.filter(
        (session) =>
            (filters.state === "all" || session.state === filters.state) &&
            (filters.entry === "all" || String(session.entry_server_id) === filters.entry) &&
            (filters.exit === "all" || String(session.exit_server_id) === filters.exit),
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
                                className="w-full gap-1.5 whitespace-nowrap"
                                onClick={onRefresh}
                            >
                                <RotateCw className="h-4 w-4" />
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
                                    <TableRow key={session.session_id}>
                                        <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                                            {session.session_id}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    session.state === "running"
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {session.state}
                                            </Badge>
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
                                                            aria-label={`${t("Actions")} ${session.session_id}`}
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
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
                serverName={serverName}
                open={Boolean(logSession)}
                onOpenChange={(open) => {
                    if (!open) setLogSession(null)
                }}
                t={t}
            />
        </div>
    )
}

function SessionLogDialog({
    session,
    serverName,
    open,
    onOpenChange,
    t,
}: {
    session: ModelAgentVPNSession | null
    serverName: (id?: number) => string
    open: boolean
    onOpenChange: (open: boolean) => void
    t: (key: string) => string
}) {
    const [logs, setLogs] = useState<string[]>([])
    const [status, setStatus] = useState("")
    const retryTimerRef = useRef<number | undefined>(undefined)
    const socketRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!open || !session) return

        let closed = false
        let retryCount = 0
        setLogs([])
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
                    if (!frame.logs?.length) return
                    const contextSession = { ...session, ...frame.session }
                    const nextLines = frame.logs.map((line) =>
                        formatSessionLogLine(line, contextSession, serverName),
                    )
                    setLogs(nextLines.slice(-1000))
                    setStatus("")
                } catch {
                    setLogs((current) => [...current, String(event.data)].slice(-1000))
                    setStatus("")
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
            socketRef.current?.close()
            socketRef.current = null
        }
    }, [open, session, serverName, t])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
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
                    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">
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
                    aria-label={`${t("VPN.Detail")} ${session.session_id}`}
                >
                    <Eye className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
                    <DetailItem label={t("VPN.Mode")} value={modeLabel(t, session.mode)} />
                    <DetailItem
                        label={t("Status")}
                        value={
                            <Badge variant={session.state === "running" ? "default" : "secondary"}>
                                {session.state}
                            </Badge>
                        }
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
                            session.mode === "system_proxy"
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
                        value={session.last_error || "-"}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DetailItem({
    className,
    label,
    value,
}: {
    className?: string
    label: string
    value: React.ReactNode
}) {
    return (
        <div className={`space-y-1 rounded-md border bg-muted/20 p-3 ${className ?? ""}`}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="break-all text-sm font-medium">{value}</div>
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

function formatSessionLogLine(
    line: string,
    session: ModelAgentVPNSession,
    serverName: (id?: number) => string,
): string {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false })
    const entryState = session.entry_state || "-"
    const exitState = session.exit_state || "-"
    const route = `${serverName(session.entry_server_id)} -> ${serverName(session.exit_server_id)}`
    return `[${timestamp}] [${session.session_id}] [entry:${entryState}/exit:${exitState}] [${route}] ${line}`
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
