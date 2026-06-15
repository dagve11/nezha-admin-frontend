import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModelAgentVPNDebugResult } from "@/types"
import { Bug, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

interface DebugTabProps {
    results: ModelAgentVPNDebugResult[]
    loading?: boolean
    serverName: (id?: number) => string
    onRefresh: () => void
}

export function DebugTab({ results, loading, serverName, onRefresh }: DebugTabProps) {
    const { t } = useTranslation()

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Bug className="h-5 w-5" />
                            {t("VPN.Debug")}
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={loading}
                            onClick={onRefresh}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            {t("VPN.Refresh")}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {results.length === 0 && (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                            {loading ? t("Loading") : t("VPN.DebugEmpty")}
                        </div>
                    )}
                    {results.map((entry) => (
                        <AgentResultCard
                            key={entry.id}
                            entry={entry}
                            serverName={serverName}
                            t={t}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

function AgentResultCard({
    entry,
    serverName,
    t,
}: {
    entry: ModelAgentVPNDebugResult
    serverName: (id?: number) => string
    t: (key: string) => string
}) {
    const logs = entry.result.logs ?? []
    const reporter = entry.reporter_server_name || serverName(entry.reporter_server_id)

    return (
        <div className="min-w-0 rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="break-words font-medium">
                            {reporter} · #{entry.reporter_server_id}
                        </span>
                        <Badge variant="outline">#{entry.id}</Badge>
                    </div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                        {entry.session_id || "-"}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{entry.action || "-"}</Badge>
                    <Badge variant="secondary">{entry.role || "-"}</Badge>
                    <Badge variant={stateBadgeVariant(entry.state)}>{entry.state || "-"}</Badge>
                </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <DebugLine label={t("VPN.ReportedAt")} value={formatDebugTime(entry.reported_at)} />
                <DebugLine label={t("VPN.CheckID")} value={entry.result.check_id || "-"} />
                <DebugLine label={t("VPN.CoreStatus")} value={entry.result.core_status || "-"} />
                <DebugLine label={t("VPN.RuleSetStatus")} value={entry.result.rules_status || "-"} />
                <DebugLine label={t("VPN.LocalHTTP")} value={entry.result.local_http || "-"} />
                <DebugLine label={t("VPN.LocalSocks")} value={entry.result.local_socks || "-"} />
            </div>

            {entry.last_error && (
                <div className="mt-3 min-w-0 whitespace-pre-wrap break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {entry.last_error}
                </div>
            )}

            {logs.length > 0 && (
                <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{t("VPN.AgentLogs")}</div>
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md bg-muted/40 p-3">
                        {logs.map((line, index) => (
                            <div
                                key={`${entry.id}-${index}`}
                                className="min-w-0 whitespace-pre-wrap break-all font-mono text-xs"
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <details className="mt-3 min-w-0">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
                    {t("VPN.RawResult")}
                </summary>
                <pre className="mt-2 max-h-80 min-w-0 overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 text-xs">
                    {JSON.stringify(entry.result, null, 2)}
                </pre>
            </details>
        </div>
    )
}

function DebugLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-md bg-muted/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="min-w-0 break-all font-mono text-xs">{value}</div>
        </div>
    )
}

function stateBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
    if (state === "failed") return "destructive"
    if (state === "running" || state === "prepared") return "default"
    if (state === "stopped") return "secondary"
    return "outline"
}

function formatDebugTime(value?: string): string {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}
