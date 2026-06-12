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
import { ModelAgentVPNPolicy } from "@/types"
import { ClipboardList, Copy, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

interface PolicyTabProps {
    policies: ModelAgentVPNPolicy[]
    serverName: (id?: number) => string
    notifierName: (id?: number) => string
    onNew: () => void
    onEdit: (policy: ModelAgentVPNPolicy) => void
    onCopy: (policy: ModelAgentVPNPolicy) => void
    onStart: (policyID: number) => void
    onDelete: (policyID: number) => void
}

export function PolicyTab({
    policies,
    serverName,
    notifierName,
    onNew,
    onEdit,
    onCopy,
    onStart,
    onDelete,
}: PolicyTabProps) {
    const { t } = useTranslation()

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
                            <TableHead>ID</TableHead>
                            <TableHead>{t("Name")}</TableHead>
                            <TableHead>{t("VPN.EntryServer")}</TableHead>
                            <TableHead>{t("VPN.ExitServer")}</TableHead>
                            <TableHead>{t("VPN.Mode")}</TableHead>
                            <TableHead>{t("VPN.NotificationGroup")}</TableHead>
                            <TableHead className="w-16 text-right">{t("Actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {policies.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    {t("NoResults")}
                                </TableCell>
                            </TableRow>
                        )}
                        {policies.map((policy) => (
                            <TableRow key={policy.id}>
                                <TableCell>{policy.id}</TableCell>
                                <TableCell className="font-medium">{policy.name}</TableCell>
                                <TableCell>{serverName(policy.entry_server_id)}</TableCell>
                                <TableCell>{serverName(policy.exit_server_id)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{modeLabel(t, policy.mode)}</Badge>
                                </TableCell>
                                <TableCell>{notifierName(policy.notification_group_id)}</TableCell>
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
                                                onClick={() => onCopy(policy)}
                                                aria-label={`${t("VPN.CopyPolicy")} ${policy.name}`}
                                            >
                                                <Copy className="h-4 w-4" />
                                                <span>{t("VPN.CopyPolicy")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => onStart(policy.id)}
                                                aria-label={`${t("VPN.StartSession")} ${policy.name}`}
                                            >
                                                <Play className="h-4 w-4" />
                                                <span>{t("VPN.StartSession")}</span>
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

function modeLabel(t: (key: string) => string, mode: string): string {
    if (mode === "tun_split") return t("VPN.ModeTunSplit")
    if (mode === "tun_global") return t("VPN.ModeTunGlobal")
    return t("VPN.ModeSystemProxy")
}
