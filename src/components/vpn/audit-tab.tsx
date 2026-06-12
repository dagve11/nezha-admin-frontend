import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ModelAgentVPNAuditLog, ServerIdentifierType } from "@/types"
import { ClipboardList, RotateCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import useSWR from "swr"
import { swrFetcher } from "@/api/api"

interface AuditTabProps {
    servers: ServerIdentifierType[]
}

export function AuditTab({ servers }: AuditTabProps) {
    const { t } = useTranslation()
    const [filters, setFilters] = useState({
        action: "",
        result: "",
        user: "",
        entry: "",
        exit: "",
        from: "",
        to: "",
    })

    const queryParams = new URLSearchParams()
    if (filters.action) queryParams.set("action", filters.action)
    if (filters.result) queryParams.set("result", filters.result)
    if (filters.user) queryParams.set("user", filters.user)
    if (filters.entry) queryParams.set("entry", filters.entry)
    if (filters.exit) queryParams.set("exit", filters.exit)
    if (filters.from) queryParams.set("from", filters.from)
    if (filters.to) queryParams.set("to", filters.to)

    const queryString = queryParams.toString()
    const { data: audits = [], mutate } = useSWR<ModelAgentVPNAuditLog[]>(
        `/api/v1/vpn/audit${queryString ? `?${queryString}` : ""}`,
        swrFetcher,
    )

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    {t("VPN.Audit")}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <NativeField label={t("VPN.AuditActionFilter")} id="vpn-audit-action-filter">
                        <Input
                            id="vpn-audit-action-filter"
                            value={filters.action}
                            onChange={(e) => handleFilterChange("action", e.target.value)}
                            placeholder="start, stop, delete..."
                        />
                    </NativeField>
                    <NativeField label={t("VPN.AuditResultFilter")} id="vpn-audit-result-filter">
                        <select
                            id="vpn-audit-result-filter"
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={filters.result}
                            onChange={(e) => handleFilterChange("result", e.target.value)}
                        >
                            <option value="">{t("VPN.FilterAll")}</option>
                            <option value="success">Success</option>
                            <option value="failure">Failure</option>
                        </select>
                    </NativeField>
                    <NativeField label={t("VPN.AuditUserFilter")} id="vpn-audit-user-filter">
                        <Input
                            id="vpn-audit-user-filter"
                            value={filters.user}
                            onChange={(e) => handleFilterChange("user", e.target.value)}
                            placeholder="User ID"
                        />
                    </NativeField>
                    <NativeField label={t("VPN.AuditEntryFilter")} id="vpn-audit-entry-filter">
                        <select
                            id="vpn-audit-entry-filter"
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={filters.entry}
                            onChange={(e) => handleFilterChange("entry", e.target.value)}
                        >
                            <option value="">{t("VPN.FilterAll")}</option>
                            {servers.map((server) => (
                                <option key={server.id} value={String(server.id)}>
                                    {server.name}
                                </option>
                            ))}
                        </select>
                    </NativeField>
                    <NativeField label={t("VPN.AuditExitFilter")} id="vpn-audit-exit-filter">
                        <select
                            id="vpn-audit-exit-filter"
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={filters.exit}
                            onChange={(e) => handleFilterChange("exit", e.target.value)}
                        >
                            <option value="">{t("VPN.FilterAll")}</option>
                            {servers.map((server) => (
                                <option key={server.id} value={String(server.id)}>
                                    {server.name}
                                </option>
                            ))}
                        </select>
                    </NativeField>
                    <NativeField label={t("VPN.AuditFromFilter")} id="vpn-audit-from-filter">
                        <Input
                            id="vpn-audit-from-filter"
                            type="datetime-local"
                            value={filters.from}
                            onChange={(e) => handleFilterChange("from", e.target.value)}
                        />
                    </NativeField>
                    <NativeField label={t("VPN.AuditToFilter")} id="vpn-audit-to-filter">
                        <Input
                            id="vpn-audit-to-filter"
                            type="datetime-local"
                            value={filters.to}
                            onChange={(e) => handleFilterChange("to", e.target.value)}
                        />
                    </NativeField>
                    <div className="flex items-end">
                        <Button
                            variant="outline"
                            className="w-full gap-1.5"
                            onClick={() => void mutate()}
                        >
                            <RotateCw className="h-4 w-4" />
                            <span>{t("VPN.Refresh")}</span>
                        </Button>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Session</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>{t("VPN.Detail")}</TableHead>
                            <TableHead>Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {audits.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    {t("NoResults")}
                                </TableCell>
                            </TableRow>
                        )}
                        {audits.map((audit) => (
                            <TableRow key={audit.id}>
                                <TableCell>{audit.id}</TableCell>
                                <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                                    {audit.session_id || "-"}
                                </TableCell>
                                <TableCell>{audit.user_id || "-"}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{actionLabel(t, audit.action)}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={audit.success ? "default" : "destructive"}>
                                        {audit.success ? "Success" : "Failure"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="max-w-[16rem] truncate">
                                    {audit.message || "-"}
                                </TableCell>
                                <TableCell>
                                    {audit.detail && Object.keys(audit.detail).length > 0 ? (
                                        <div className="max-w-[20rem] space-y-1 text-xs">
                                            {Object.entries(audit.detail).map(([key, value]) => (
                                                <div key={key} className="truncate">
                                                    <span className="font-medium">{key}</span>:{" "}
                                                    {value}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        "-"
                                    )}
                                </TableCell>
                                <TableCell className="text-xs">{audit.created_at || "-"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
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

function actionLabel(t: (key: string) => string, action: string): string {
    const actionMap: Record<string, string> = {
        create_policy: t("VPN.ActionCreatePolicy"),
        update_policy: t("VPN.ActionUpdatePolicy"),
        delete_policy: t("VPN.ActionDeletePolicy"),
        start_session: t("VPN.ActionStartSession"),
        stop_session: t("VPN.ActionStopSession"),
        restart_session: t("VPN.ActionRestartSession"),
        status_session: t("VPN.ActionStatusSession"),
    }
    return actionMap[action] || action
}
