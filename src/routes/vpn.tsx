import { swrFetcher } from "@/api/api"
import {
    checkVPNPolicyStatus,
    cleanupVPNPolicyCore,
    cleanupVPNPolicyRules,
    createVPNPolicy,
    deleteVPNPolicy,
    deleteVPNSession,
    prepareVPNPolicyCore,
    prepareVPNPolicyRules,
    refreshVPNSessionStatus,
    restartVPNSession,
    startVPNSession,
    stopVPNSession,
    updateVPNPolicy,
} from "@/api/vpn"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OverviewTab } from "@/components/vpn/overview-tab"
import { PolicyForm } from "@/components/vpn/policy-form"
import { PolicyTab } from "@/components/vpn/policy-tab"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    SessionTab,
    buttonVariants,
} from "@/components/vpn/session-tab"
import { normalizePolicyForm, policyToForm, validatePolicyFormClient } from "@/components/vpn/utils"
import { useNotification } from "@/hooks/useNotfication"
import { useServer } from "@/hooks/useServer"
import {
    ModelAgentVPNPolicy,
    ModelAgentVPNPolicyForm,
    ModelAgentVPNPolicyStatusCheck,
    ModelAgentVPNSession,
} from "@/types"
import { useCallback, useMemo, useState } from "react"
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
    set_system_proxy: true,
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

export default function VPNPage() {
    const { t } = useTranslation()
    const { servers = [] } = useServer()
    const { notifierGroup = [] } = useNotification()
    const [form, setForm] = useState<ModelAgentVPNPolicyForm>(() => newInitialForm())
    const [editingPolicyID, setEditingPolicyID] = useState<number | null>(null)
    const [tunRiskConfirmed, setTunRiskConfirmed] = useState(false)
    const [policyFormOpen, setPolicyFormOpen] = useState(false)
    const [policyStatusOpen, setPolicyStatusOpen] = useState(false)
    const [policyStatusChecking, setPolicyStatusChecking] = useState(false)
    const [policyStatusResult, setPolicyStatusResult] =
        useState<ModelAgentVPNPolicyStatusCheck | null>(null)
    const [activeTab, setActiveTab] = useState("overview")
    const [sessionFilters, setSessionFilters] = useState({
        state: "all",
        entry: "all",
        exit: "all",
    })
    const [sessionAction, setSessionAction] = useState<{
        sessionID: string
        type: "stop" | "delete"
    } | null>(null)

    const serverNameByID = useMemo(
        () => new Map(servers.map((server) => [server.id, server.name])),
        [servers],
    )
    const serverName = useCallback(
        (id?: number) => serverNameByID.get(id ?? 0) ?? `#${id || "-"}`,
        [serverNameByID],
    )

    const { data: policies = [], mutate: mutatePolicies } = useSWR<ModelAgentVPNPolicy[]>(
        "/api/v1/vpn/policy",
        swrFetcher,
    )
    const { data: sessions = [], mutate: mutateSessions } = useSWR<ModelAgentVPNSession[]>(
        "/api/v1/vpn/session",
        swrFetcher,
    )

    async function handleSavePolicy(): Promise<boolean> {
        if ((form.mode === "tun_split" || form.mode === "tun_global") && !tunRiskConfirmed) {
            toast(t("Error"), { description: t("VPN.TunRiskRequired") })
            return false
        }
        try {
            const payload = normalizePolicyForm(form)
            const validationError = validatePolicyFormClient(payload)
            if (validationError) {
                toast(t("Error"), { description: t(validationError) })
                return false
            }
            if (editingPolicyID) {
                await updateVPNPolicy(editingPolicyID, payload)
            } else {
                await createVPNPolicy(payload)
            }
            toast(t("Success"))
            await mutatePolicies()
            return true
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
            return false
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

    function handleNewPolicy() {
        setEditingPolicyID(null)
        setForm(newInitialForm())
        setTunRiskConfirmed(false)
        setActiveTab("policy")
        setPolicyFormOpen(true)
    }

    function handleEditPolicy(policy: ModelAgentVPNPolicy) {
        setEditingPolicyID(policy.id)
        setForm(policyToForm(policy))
        setTunRiskConfirmed(policy.mode !== "tun_split" && policy.mode !== "tun_global")
        setActiveTab("policy")
        setPolicyFormOpen(true)
    }

    async function handleStartPolicy(policyID: number) {
        try {
            await startVPNSession(policyID)
            setActiveTab("session")
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handlePreparePolicyCore(policyID: number) {
        try {
            await prepareVPNPolicyCore(policyID)
            toast(t("Success"), { description: t("VPN.CorePrepareSent") })
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleCleanupPolicyCore(policyID: number) {
        try {
            await cleanupVPNPolicyCore(policyID)
            toast(t("Success"), { description: t("VPN.CoreCleanupSent") })
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handlePreparePolicyRules(policyID: number) {
        try {
            await prepareVPNPolicyRules(policyID)
            toast(t("Success"), { description: t("VPN.RulesPrepareSent") })
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleCleanupPolicyRules(policyID: number) {
        try {
            await cleanupVPNPolicyRules(policyID)
            toast(t("Success"), { description: t("VPN.RulesCleanupSent") })
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleCheckPolicyStatus(policyID: number) {
        setPolicyStatusOpen(true)
        setPolicyStatusChecking(true)
        setPolicyStatusResult(null)
        try {
            const result = await checkVPNPolicyStatus(policyID)
            setPolicyStatusResult(result)
        } catch (error) {
            setPolicyStatusOpen(false)
            toast(t("Error"), { description: errorMessage(error) })
        } finally {
            setPolicyStatusChecking(false)
        }
    }

    async function handleStopSession(sessionID: string) {
        try {
            await stopVPNSession(sessionID)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleDeleteSession(sessionID: string) {
        try {
            await deleteVPNSession(sessionID)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleRestartSession(sessionID: string) {
        try {
            await restartVPNSession(sessionID)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    async function handleRefreshSession(sessionID: string) {
        try {
            await refreshVPNSessionStatus(sessionID)
            await mutateSessions()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    function handleFormChange<K extends keyof ModelAgentVPNPolicyForm>(
        key: K,
        value: ModelAgentVPNPolicyForm[K],
    ) {
        setForm((current) => ({
            ...current,
            [key]: value,
            ...(key === "mode" && value === "system_proxy" ? { set_system_proxy: true } : {}),
        }))
    }

    function handleSessionFilterChange(key: string, value: string) {
        setSessionFilters((current) => ({ ...current, [key]: value }))
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
                    <TabsTrigger value="overview">{t("VPN.Overview")}</TabsTrigger>
                    <TabsTrigger value="policy">{t("VPN.Policy")}</TabsTrigger>
                    <TabsTrigger value="session">{t("VPN.Session")}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <OverviewTab servers={servers} sessions={sessions} serverName={serverName} />
                </TabsContent>

                <TabsContent value="policy" className="space-y-4">
                    <PolicyTab
                        policies={policies}
                        servers={servers}
                        serverName={serverName}
                        onNew={handleNewPolicy}
                        onEdit={handleEditPolicy}
                        onStart={(id) => void handleStartPolicy(id)}
                        onPrepareCore={(id) => void handlePreparePolicyCore(id)}
                        onCleanupCore={(id) => void handleCleanupPolicyCore(id)}
                        onPrepareRules={(id) => void handlePreparePolicyRules(id)}
                        onCleanupRules={(id) => void handleCleanupPolicyRules(id)}
                        onCheckStatus={(id) => void handleCheckPolicyStatus(id)}
                        onDelete={(id) => void handleDeletePolicy(id)}
                    />
                    <Dialog open={policyStatusOpen} onOpenChange={setPolicyStatusOpen}>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>{t("VPN.PolicyStatusTitle")}</DialogTitle>
                                <DialogDescription>{t("VPN.PolicyStatusHint")}</DialogDescription>
                            </DialogHeader>
                            {policyStatusChecking && (
                                <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                                    {t("VPN.PolicyStatusChecking")}
                                </div>
                            )}
                            {!policyStatusChecking && policyStatusResult && (
                                <PolicyStatusResult result={policyStatusResult} t={t} />
                            )}
                        </DialogContent>
                    </Dialog>
                    <Dialog open={policyFormOpen} onOpenChange={setPolicyFormOpen}>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                            <DialogHeader>
                                <DialogTitle>{t("VPN.PolicyForm")}</DialogTitle>
                                <DialogDescription>
                                    {editingPolicyID
                                        ? `${t("VPN.EditPolicy")} #${editingPolicyID}`
                                        : t("VPN.NewPolicy")}
                                </DialogDescription>
                            </DialogHeader>
                            <PolicyForm
                                form={form}
                                editingPolicyID={editingPolicyID}
                                tunRiskConfirmed={tunRiskConfirmed}
                                servers={servers}
                                notifierGroups={notifierGroup}
                                onFormChange={handleFormChange}
                                onTunRiskChange={setTunRiskConfirmed}
                                onCancel={() => setPolicyFormOpen(false)}
                                onSave={() => {
                                    void handleSavePolicy().then((saved) => {
                                        if (saved) setPolicyFormOpen(false)
                                    })
                                }}
                                onStart={() => {
                                    if (editingPolicyID !== null) {
                                        setPolicyFormOpen(false)
                                        void handleStartPolicy(editingPolicyID)
                                    }
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                <TabsContent value="session">
                    <SessionTab
                        sessions={sessions}
                        policies={policies}
                        servers={servers}
                        filters={sessionFilters}
                        serverName={serverName}
                        onFilterChange={handleSessionFilterChange}
                        onRefresh={() => void mutateSessions()}
                        onStop={(id) => setSessionAction({ sessionID: id, type: "stop" })}
                        onStart={(id) => void handleRestartSession(id)}
                        onDelete={(id) => setSessionAction({ sessionID: id, type: "delete" })}
                        onRefreshStatus={(id) => void handleRefreshSession(id)}
                    />

                    <AlertDialog
                        open={Boolean(sessionAction)}
                        onOpenChange={(open) => {
                            if (!open) setSessionAction(null)
                        }}
                    >
                        <AlertDialogContent className="sm:max-w-lg">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {sessionAction?.type === "delete"
                                        ? t("VPN.ConfirmDeleteSession")
                                        : t("VPN.ConfirmStopSession")}
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
                                        className: "text-white",
                                    })}
                                    onClick={() => {
                                        const sessionID = sessionAction?.sessionID
                                        const actionType = sessionAction?.type
                                        setSessionAction(null)
                                        if (!sessionID) return
                                        if (actionType === "delete") {
                                            void handleDeleteSession(sessionID)
                                        } else {
                                            void handleStopSession(sessionID)
                                        }
                                    }}
                                >
                                    {t("Confirm")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>
            </Tabs>
        </div>
    )
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function PolicyStatusResult({
    result,
    t,
}: {
    result: ModelAgentVPNPolicyStatusCheck
    t: (key: string) => string
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{result.policy_name || `#${result.policy_id}`}</span>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{formatVPNStatusTime(result.checked_at)}</span>
                    {result.timed_out && (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                            {t("VPN.StatusTimedOut")}
                        </Badge>
                    )}
                </div>
            </div>
            <div className="grid gap-3">
                {result.nodes.map((node) => (
                    <div key={`${node.role}-${node.server_id}`} className="rounded-md border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="font-medium">
                                    {roleLabel(t, node.role)} · {node.server_name || `#${node.server_id}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {node.responded ? t("VPN.StatusResponded") : t("VPN.StatusNoResponse")}
                                </div>
                            </div>
                            <Badge variant={node.online ? "default" : "secondary"}>
                                {node.online ? t("VPN.Online") : t("VPN.Offline")}
                            </Badge>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <PolicyStatusLine
                                label={t("VPN.CoreStatus")}
                                pathLabel={t("VPN.CorePath")}
                                status={node.core_status}
                                path={node.core_path}
                                version={node.core_version}
                                t={t}
                            />
                            <PolicyStatusLine
                                label={t("VPN.RuleSetStatus")}
                                pathLabel={t("VPN.RuleSetPath")}
                                status={node.rules_status}
                                path={node.rules_path}
                                version={node.rules_version}
                                t={t}
                            />
                        </div>
                        {node.last_error && (
                            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                {node.last_error}
                            </div>
                        )}
                        {node.logs && node.logs.length > 0 && (
                            <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-black p-3 text-xs leading-5 text-green-100">
                                {node.logs.join("\n")}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function PolicyStatusLine({
    label,
    pathLabel,
    status,
    path,
    version,
    t,
}: {
    label: string
    pathLabel: string
    status: string
    path?: string
    version?: string
    t: (key: string) => string
}) {
    return (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{label}</span>
                <Badge variant="outline" className={statusBadgeClassName(status)}>
                    {statusLabel(t, status)}
                </Badge>
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="break-all">
                    {pathLabel}: {path || "-"}
                </div>
                {version && (
                    <div className="break-all">
                        {t("VPN.Version")}: {version}
                    </div>
                )}
            </div>
        </div>
    )
}

function roleLabel(t: (key: string) => string, role: string): string {
    if (role === "entry") return t("VPN.EntryServer")
    if (role === "exit") return t("VPN.ExitServer")
    return role
}

function statusLabel(t: (key: string) => string, status: string): string {
    if (status === "ready") return t("VPN.StatusReady")
    if (status === "missing") return t("VPN.StatusMissing")
    if (status === "error") return t("VPN.StatusError")
    return t("VPN.StatusUnknown")
}

function statusBadgeClassName(status: string): string {
    if (status === "ready") return "border-emerald-300 text-emerald-700"
    if (status === "missing") return "border-amber-300 text-amber-700"
    if (status === "error") return "border-red-300 text-red-700"
    return "border-zinc-300 text-zinc-600"
}

function formatVPNStatusTime(value?: string): string {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}
