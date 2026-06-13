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
import { Copy, Eye, FileText, MoreHorizontal, Play, RotateCw, Square } from "lucide-react"
import { useTranslation } from "react-i18next"

interface SessionTabProps {
    sessions: ModelAgentVPNSession[]
    policies: ModelAgentVPNPolicy[]
    servers: ServerIdentifierType[]
    filters: { state: string; entry: string; exit: string }
    serverName: (id?: number) => string
    onFilterChange: (key: string, value: string) => void
    onRefresh: () => void
    onViewLog: (sessionID: string) => void
    onCopyProxy: (session: ModelAgentVPNSession) => void
    onStop: (sessionID: string) => void
    onRestart: (sessionID: string) => void
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
    onViewLog,
    onCopyProxy,
    onStop,
    onRestart,
    onRefreshStatus,
}: SessionTabProps) {
    const { t } = useTranslation()

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
                                const canStop = ["running", "starting", "stopping"].includes(
                                    session.state,
                                )
                                const canRestart = [
                                    "running",
                                    "failed",
                                    "lost",
                                    "unknown",
                                    "stopped",
                                ].includes(session.state)
                                const proxyAddr = getSessionProxyAddress(session, policies)

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
                                                            onClick={() =>
                                                                onViewLog(session.session_id)
                                                            }
                                                            aria-label={`${t("VPN.ViewSessionLog")} ${session.session_id}`}
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            <span>{t("VPN.ViewSessionLog")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            disabled={!proxyAddr}
                                                            onClick={() => onCopyProxy(session)}
                                                            aria-label={`${t("VPN.CopyProxy")} ${session.session_id}`}
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                            <span>{t("VPN.CopyProxy")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            disabled={!canStop}
                                                            className="text-destructive focus:text-destructive"
                                                            onSelect={(e) => e.preventDefault()}
                                                            onClick={() =>
                                                                onStop(session.session_id)
                                                            }
                                                            aria-label={`${t("VPN.StopSession")} ${session.session_id}`}
                                                        >
                                                            <Square className="h-4 w-4" />
                                                            <span>{t("VPN.StopSession")}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            disabled={!canRestart}
                                                            onClick={() =>
                                                                onRestart(session.session_id)
                                                            }
                                                            aria-label={`${t("VPN.RestartSession")} ${session.session_id}`}
                                                        >
                                                            <Play className="h-4 w-4" />
                                                            <span>{t("VPN.RestartSession")}</span>
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
        </div>
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
    const policy = policies.find((p) => p.id === session.policy_id)
    return (
        session.local_socks ||
        session.local_http ||
        policy?.listen_socks ||
        policy?.listen_http ||
        ""
    )
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
