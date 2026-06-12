import { swrFetcher } from "@/api/api"
import {
    createVPNPolicy,
    deleteVPNPolicy,
    refreshVPNSessionStatus,
    restartVPNSession,
    startVPNSession,
    stopVPNSession,
    updateVPNPolicy,
} from "@/api/vpn"
import { AuditTab } from "@/components/vpn/audit-tab"
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
    buttonVariants,
    SessionTab,
} from "@/components/vpn/session-tab"
import {
    copyTextToClipboard,
    normalizePolicyForm,
    policyToForm,
    validatePolicyFormClient,
} from "@/components/vpn/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    set_system_proxy: false,
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
    const [activeTab, setActiveTab] = useState("overview")
    const [sessionFilters, setSessionFilters] = useState({
        state: "all",
        entry: "all",
        exit: "all",
    })
    const [stopSessionID, setStopSessionID] = useState("")
    const [restartSessionID, setRestartSessionID] = useState("")

    const serverNameByID = useMemo(
        () => new Map(servers.map((server) => [server.id, server.name])),
        [servers],
    )
    const notifierNameByID = useMemo(
        () => new Map(notifierGroup.map((item) => [item.group.id, item.group.name])),
        [notifierGroup],
    )
    const serverName = useCallback(
        (id?: number) => serverNameByID.get(id ?? 0) ?? `#${id || "-"}`,
        [serverNameByID],
    )
    const notifierName = useCallback(
        (id?: number) => notifierNameByID.get(id ?? 0) ?? (id ? `#${id}` : "-"),
        [notifierNameByID],
    )

    const { data: policies = [], mutate: mutatePolicies } = useSWR<ModelAgentVPNPolicy[]>(
        "/api/v1/vpn/policy",
        swrFetcher,
    )
    const { data: sessions = [], mutate: mutateSessions } = useSWR<ModelAgentVPNSession[]>(
        "/api/v1/vpn/session",
        swrFetcher,
    )

    const activeSessions = sessions.filter((session) => session.state === "running")
    const overviewTopologySession = activeSessions[0] ?? sessions[0]
    const overviewTopologyPolicy = overviewTopologySession
        ? policies.find((policy) => policy.id === overviewTopologySession.policy_id)
        : policies.find((policy) => policy.id === editingPolicyID) ?? policies[0]
    const overviewTopologyEntryID =
        overviewTopologySession?.entry_server_id ??
        overviewTopologyPolicy?.entry_server_id ??
        form.entry_server_id
    const overviewTopologyExitID =
        overviewTopologySession?.exit_server_id ??
        overviewTopologyPolicy?.exit_server_id ??
        form.exit_server_id
    const overviewTopologyMode =
        overviewTopologySession?.mode ?? overviewTopologyPolicy?.mode ?? form.mode

    async function handleSavePolicy() {
        if ((form.mode === "tun_split" || form.mode === "tun_global") && !tunRiskConfirmed) {
            toast(t("Error"), { description: t("VPN.TunRiskRequired") })
            return
        }
        try {
            const payload = normalizePolicyForm(form)
            const validationError = validatePolicyFormClient(payload)
            if (validationError) {
                toast(t("Error"), { description: t(validationError) })
                return
            }
            if (editingPolicyID) {
                await updateVPNPolicy(editingPolicyID, payload)
            } else {
                await createVPNPolicy(payload)
            }
            toast(t("Success"))
            await mutatePolicies()
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
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
    }

    function handleEditPolicy(policy: ModelAgentVPNPolicy) {
        setEditingPolicyID(policy.id)
        setForm(policyToForm(policy))
        setTunRiskConfirmed(policy.mode !== "tun_split" && policy.mode !== "tun_global")
        setActiveTab("policy")
    }

    function handleCopyPolicy(policy: ModelAgentVPNPolicy) {
        setEditingPolicyID(null)
        setForm({
            ...policyToForm(policy),
            name: `${policy.name} copy`,
        })
        setTunRiskConfirmed(policy.mode !== "tun_split" && policy.mode !== "tun_global")
        setActiveTab("policy")
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

    async function handleStopSession(sessionID: string) {
        try {
            await stopVPNSession(sessionID)
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

    function handleViewSessionLog() {
        setActiveTab("overview")
    }

    async function handleCopySessionProxy(session: ModelAgentVPNSession) {
        const policy = policies.find((p) => p.id === session.policy_id)
        const proxy =
            session.local_socks ||
            session.local_http ||
            policy?.listen_socks ||
            policy?.listen_http ||
            ""
        if (!proxy) return
        try {
            await copyTextToClipboard(proxy)
            toast(t("CopiedToClipboard"))
        } catch (error) {
            toast(t("Error"), { description: errorMessage(error) })
        }
    }

    function handleFormChange<K extends keyof ModelAgentVPNPolicyForm>(
        key: K,
        value: ModelAgentVPNPolicyForm[K],
    ) {
        setForm((current) => ({ ...current, [key]: value }))
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
                <TabsList className="grid h-auto w-full grid-cols-4">
                    <TabsTrigger value="overview">{t("VPN.Overview")}</TabsTrigger>
                    <TabsTrigger value="policy">{t("VPN.Policy")}</TabsTrigger>
                    <TabsTrigger value="session">{t("VPN.Session")}</TabsTrigger>
                    <TabsTrigger value="audit">{t("VPN.Audit")}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <OverviewTab
                        servers={servers}
                        entryID={overviewTopologyEntryID}
                        exitID={overviewTopologyExitID}
                        mode={overviewTopologyMode}
                        serverName={serverName}
                    />
                </TabsContent>

                <TabsContent value="policy" className="space-y-4">
                    <PolicyTab
                        policies={policies}
                        serverName={serverName}
                        notifierName={notifierName}
                        onNew={handleNewPolicy}
                        onEdit={handleEditPolicy}
                        onCopy={handleCopyPolicy}
                        onStart={(id) => void handleStartPolicy(id)}
                        onDelete={(id) => void handleDeletePolicy(id)}
                    />
                    <PolicyForm
                        form={form}
                        editingPolicyID={editingPolicyID}
                        tunRiskConfirmed={tunRiskConfirmed}
                        servers={servers}
                        notifierGroups={notifierGroup}
                        onFormChange={handleFormChange}
                        onTunRiskChange={setTunRiskConfirmed}
                        onSave={() => void handleSavePolicy()}
                        onStart={() => {
                            if (editingPolicyID !== null) void handleStartPolicy(editingPolicyID)
                        }}
                    />
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
                        onViewLog={handleViewSessionLog}
                        onCopyProxy={(session) => void handleCopySessionProxy(session)}
                        onStop={(id) => setStopSessionID(id)}
                        onRestart={(id) => setRestartSessionID(id)}
                        onRefreshStatus={(id) => void handleRefreshSession(id)}
                    />

                    <AlertDialog
                        open={Boolean(stopSessionID)}
                        onOpenChange={(open) => {
                            if (!open) setStopSessionID("")
                        }}
                    >
                        <AlertDialogContent className="sm:max-w-lg">
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t("VPN.ConfirmStopSession")}</AlertDialogTitle>
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
                                        const sessionID = stopSessionID
                                        setStopSessionID("")
                                        if (sessionID) void handleStopSession(sessionID)
                                    }}
                                >
                                    {t("Confirm")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog
                        open={Boolean(restartSessionID)}
                        onOpenChange={(open) => {
                            if (!open) setRestartSessionID("")
                        }}
                    >
                        <AlertDialogContent className="sm:max-w-lg">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {t("VPN.ConfirmRestartSession")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t("Results.ThisOperationIsUnrecoverable")}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        const sessionID = restartSessionID
                                        setRestartSessionID("")
                                        if (sessionID) void handleRestartSession(sessionID)
                                    }}
                                >
                                    {t("Confirm")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TabsContent>

                <TabsContent value="audit">
                    <AuditTab servers={servers} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
