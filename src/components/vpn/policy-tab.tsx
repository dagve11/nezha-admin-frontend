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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ModelAgentVPNPolicy, ServerIdentifierType } from "@/types"
import { ClipboardList, Download, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

interface PolicyTabProps {
    policies: ModelAgentVPNPolicy[]
    servers: ServerIdentifierType[]
    serverName: (id?: number) => string
    onNew: () => void
    onEdit: (policy: ModelAgentVPNPolicy) => void
    onStart: (policyID: number) => void
    onPrepareCore: (policyID: number) => void
    onCleanupCore: (policyID: number) => void
    onDelete: (policyID: number) => void
}

export function PolicyTab({
    policies,
    servers,
    serverName,
    onNew,
    onEdit,
    onStart,
    onPrepareCore,
    onCleanupCore,
    onDelete,
}: PolicyTabProps) {
    const { t } = useTranslation()
    const serverByID = new Map(servers.map((server) => [server.id, server]))

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        {t("VPN.Policy")}
                    </CardTitle>
                    <Button onClick={onNew} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("VPN.NewPolicy")}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("Name")}</TableHead>
                            <TableHead>{t("VPN.EntryServer")}</TableHead>
                            <TableHead>{t("VPN.ExitServer")}</TableHead>
                            <TableHead>{t("VPN.Mode")}</TableHead>
                            <TableHead>{t("VPN.CoreStatus")}</TableHead>
                            <TableHead className="w-16 text-right">{t("Actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {policies.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    {t("NoResults")}
                                </TableCell>
                            </TableRow>
                        )}
                        {policies.map((policy) => (
                            <TableRow key={policy.id}>
                                <TableCell className="font-medium">{policy.name}</TableCell>
                                <TableCell>{serverName(policy.entry_server_id)}</TableCell>
                                <TableCell>{serverName(policy.exit_server_id)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{modeLabel(t, policy.mode)}</Badge>
                                </TableCell>
                                <TableCell>
                                    <CoreStatus
                                        entry={serverByID.get(policy.entry_server_id)}
                                        exit={serverByID.get(policy.exit_server_id)}
                                        t={t}
                                    />
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`${t("Actions")} ${policy.name}`}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem
                                                onClick={() => onEdit(policy)}
                                                aria-label={`${t("VPN.EditPolicy")} ${policy.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                <span>{t("VPN.EditPolicy")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onStart(policy.id)}
                                                aria-label={`${t("VPN.StartSession")} ${policy.name}`}
                                            >
                                                <Play className="h-4 w-4" />
                                                <span>{t("VPN.StartSession")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onPrepareCore(policy.id)}
                                                aria-label={`${t("VPN.PrepareCore")} ${policy.name}`}
                                            >
                                                <Download className="h-4 w-4" />
                                                <span>{t("VPN.PrepareCore")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onCleanupCore(policy.id)}
                                                aria-label={`${t("VPN.CleanupCore")} ${policy.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span>{t("VPN.CleanupCore")}</span>
                                            </DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onSelect={(e) => e.preventDefault()}
                                                        aria-label={`${t("VPN.DeletePolicy")} ${policy.name}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span>{t("VPN.DeletePolicy")}</span>
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            {t("ConfirmDeletion")}
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t("Results.ThisOperationIsUnrecoverable")}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className={buttonVariants({
                                                                variant: "destructive",
                                                            })}
                                                            onClick={() => onDelete(policy.id)}
                                                        >
                                                            {t("Confirm")}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function CoreStatus({
    entry,
    exit,
    t,
}: {
    entry?: ServerIdentifierType
    exit?: ServerIdentifierType
    t: (key: string) => string
}) {
    return (
        <div className="flex flex-col gap-1">
            <CoreStatusLine label={t("VPN.EntryServer")} server={entry} t={t} />
            <CoreStatusLine label={t("VPN.ExitServer")} server={exit} t={t} />
        </div>
    )
}

function CoreStatusLine({
    label,
    server,
    t,
}: {
    label: string
    server?: ServerIdentifierType
    t: (key: string) => string
}) {
    const version = server?.host?.vpn_core_version?.trim()
    const lastError = server?.host?.vpn_last_error?.trim()
    const text = version || lastError || t("VPN.CoreMissing")
    const variant = version ? "secondary" : lastError ? "destructive" : "outline"

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
            <Badge variant={variant}>{text}</Badge>
        </div>
    )
}

function modeLabel(t: (key: string) => string, mode: string): string {
    if (mode === "tun_split") return t("VPN.ModeTunSplit")
    if (mode === "tun_global") return t("VPN.ModeTunGlobal")
    return t("VPN.ModeSystemProxy")
}
