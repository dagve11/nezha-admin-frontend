import { swrFetcher } from "@/api/api"
import {
    cleanupVPNPolicyCore,
    createVPNPolicy,
    deleteVPNPolicy,
    deleteVPNSession,
    prepareVPNPolicyCore,
    refreshVPNSessionStatus,
    restartVPNSession,
    startVPNSession,
    stopVPNSession,
    updateVPNPolicy,
} from "@/api/vpn"
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
import { ModelAgentVPNPolicy, ModelAgentVPNPolicyForm, ModelAgentVPNSession } from "@/types"
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
                        onDelete={(id) => void handleDeletePolicy(id)}
                    />
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
