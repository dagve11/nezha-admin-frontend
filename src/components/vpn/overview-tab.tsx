import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ServerIdentifierType } from "@/types"
import { AlertCircle, CheckCircle, Server } from "lucide-react"
import { useTranslation } from "react-i18next"
import { TopologyDiagram } from "./topology-diagram"

interface OverviewTabProps {
    servers: ServerIdentifierType[]
    entryID?: number
    exitID?: number
    mode?: string
    serverName: (id?: number) => string
}

export function OverviewTab({ servers, entryID, exitID, mode, serverName }: OverviewTabProps) {
    const { t } = useTranslation()

    const vpnCapableServers = servers.filter((server) => {
        const host = server.host
        return Boolean(
            host?.vpn_enabled ||
                host?.vpn_allow_system_proxy ||
                host?.vpn_allow_tun ||
                host?.vpn_core_version ||
                host?.vpn_last_error,
        )
    })

    return (
        <div className="space-y-4">
            <TopologyDiagram
                entry={entryID ? serverName(entryID) : "-"}
                exit={exitID ? serverName(exitID) : "-"}
                mode={mode ? modeLabel(t, mode) : "-"}
                t={t}
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        {t("VPN.AgentCapability")}
                    </CardTitle>
                    <CardDescription>{t("VPN.PageHint")}</CardDescription>
                </CardHeader>
                <CardContent>
                    {vpnCapableServers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <AlertCircle className="mb-2 h-8 w-8" />
                            <p>{t("VPN.NoAvailableAgent")}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("Name")}</TableHead>
                                    <TableHead>{t("VPN.Platform")}</TableHead>
                                    <TableHead>{t("VPN.Capability")}</TableHead>
                                    <TableHead>{t("VPN.CoreVersion")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vpnCapableServers.map((server) => {
                                    const host = server.host
                                    const isOnline = server.last_active
                                        ? new Date().getTime() -
                                              new Date(server.last_active).getTime() <
                                          90000
                                        : false
                                    const capabilities = []
                                    if (host?.vpn_allow_system_proxy)
                                        capabilities.push(t("VPN.CapabilitySystemProxy"))
                                    if (host?.vpn_allow_tun) capabilities.push(t("VPN.CapabilityTun"))

                                    return (
                                        <TableRow key={server.id}>
                                            <TableCell className="font-medium">
                                                {server.name}
                                            </TableCell>
                                            <TableCell>
                                                {host?.platform || "-"}/{host?.arch || "-"}
                                            </TableCell>
                                            <TableCell>
                                                {capabilities.length > 0
                                                    ? capabilities.join(", ")
                                                    : t("VPN.CapabilityNone")}
                                            </TableCell>
                                            <TableCell>
                                                {host?.vpn_core_version || (
                                                    <span className="text-muted-foreground">
                                                        {t("VPN.CoreMissing")}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {isOnline ? (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                            <span className="text-sm">
                                                                {t("VPN.Online")}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm text-muted-foreground">
                                                                {t("VPN.Offline")}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                {host?.vpn_last_error && (
                                                    <div className="mt-1 text-xs text-destructive">
                                                        {host.vpn_last_error}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function modeLabel(t: (key: string) => string, mode: string): string {
    if (mode === "tun_split") return t("VPN.ModeTunSplit")
    if (mode === "tun_global") return t("VPN.ModeTunGlobal")
    return t("VPN.ModeSystemProxy")
}
