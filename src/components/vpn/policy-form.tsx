import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ModelAgentVPNPolicyForm, ServerIdentifierType } from "@/types"
import { Play } from "lucide-react"
import { useTranslation } from "react-i18next"

interface PolicyFormProps {
    form: ModelAgentVPNPolicyForm
    editingPolicyID: number | null
    tunRiskConfirmed: boolean
    servers: ServerIdentifierType[]
    notifierGroups: Array<{ group: { id: number; name: string } }>
    onFormChange: <K extends keyof ModelAgentVPNPolicyForm>(
        key: K,
        value: ModelAgentVPNPolicyForm[K],
    ) => void
    onTunRiskChange: (confirmed: boolean) => void
    onCancel: () => void
    onSave: () => void
    onStart: () => void
}

export function PolicyForm({
    form,
    editingPolicyID,
    tunRiskConfirmed,
    servers,
    notifierGroups,
    onFormChange,
    onTunRiskChange,
    onCancel,
    onSave,
    onStart,
}: PolicyFormProps) {
    const { t } = useTranslation()
    const isTunMode = form.mode === "tun_split" || form.mode === "tun_global"

    const vpnCapableServers = servers.filter(
        (server) =>
            server.host?.vpn_enabled ||
            server.host?.vpn_allow_system_proxy ||
            server.host?.vpn_allow_tun ||
            server.host?.vpn_core_version ||
            server.id === form.entry_server_id ||
            server.id === form.exit_server_id,
    )

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("VPN.BasicSettings")}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label={t("Name")} id="vpn-policy-name">
                        <Input
                            id="vpn-policy-name"
                            value={form.name}
                            onChange={(e) => onFormChange("name", e.target.value)}
                            placeholder="GitHub Split"
                        />
                    </Field>
                    <Field label={t("VPN.EntryServer")} id="vpn-entry-server">
                        <Select
                            value={String(form.entry_server_id)}
                            onValueChange={(value) =>
                                onFormChange("entry_server_id", Number(value))
                            }
                        >
                            <SelectTrigger id="vpn-entry-server">
                                <SelectValue placeholder={t("VPN.EntryServer")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0" disabled>
                                    {t("VPN.SelectAgent")}
                                </SelectItem>
                                {vpnCapableServers.map((server) => (
                                    <SelectItem key={server.id} value={String(server.id)}>
                                        {server.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t("VPN.ExitServer")} id="vpn-exit-server">
                        <Select
                            value={String(form.exit_server_id)}
                            onValueChange={(value) => onFormChange("exit_server_id", Number(value))}
                        >
                            <SelectTrigger id="vpn-exit-server">
                                <SelectValue placeholder={t("VPN.ExitServer")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0" disabled>
                                    {t("VPN.SelectAgent")}
                                </SelectItem>
                                {vpnCapableServers.map((server) => (
                                    <SelectItem key={server.id} value={String(server.id)}>
                                        {server.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t("VPN.Mode")} id="vpn-policy-mode">
                        <Select
                            value={form.mode}
                            onValueChange={(value) => {
                                onFormChange("mode", value)
                                onTunRiskChange(value !== "tun_split" && value !== "tun_global")
                            }}
                        >
                            <SelectTrigger id="vpn-policy-mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system_proxy">
                                    {t("VPN.ModeSystemProxy")}
                                </SelectItem>
                                <SelectItem value="tun_split">{t("VPN.ModeTunSplit")}</SelectItem>
                                <SelectItem value="tun_global">{t("VPN.ModeTunGlobal")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label={t("VPN.RuleMode")} id="vpn-rule-mode">
                        <Select
                            value={form.rule_mode}
                            onValueChange={(value) => onFormChange("rule_mode", value)}
                        >
                            <SelectTrigger id="vpn-rule-mode">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">{t("VPN.RuleModeGlobal")}</SelectItem>
                                <SelectItem value="domain">{t("VPN.RuleModeDomain")}</SelectItem>
                                <SelectItem value="ip">{t("VPN.RuleModeIP")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                </div>
            </div>

            <details className="rounded-md border bg-muted/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                    {t("VPN.AdvancedSettings")}
                </summary>
                <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={t("VPN.LocalSocks")} id="vpn-local-socks">
                            <Input
                                id="vpn-local-socks"
                                value={form.listen_socks}
                                onChange={(e) => onFormChange("listen_socks", e.target.value)}
                            />
                        </Field>
                        <Field label={t("VPN.LocalHTTP")} id="vpn-local-http">
                            <Input
                                id="vpn-local-http"
                                value={form.listen_http}
                                onChange={(e) => onFormChange("listen_http", e.target.value)}
                            />
                        </Field>
                        <Field label={t("VPN.TunName")} id="vpn-tun-name">
                            <Input
                                id="vpn-tun-name"
                                value={form.tun_name}
                                onChange={(e) => onFormChange("tun_name", e.target.value)}
                            />
                        </Field>
                        <Field label={t("VPN.DNSServer")} id="vpn-dns-server">
                            <Input
                                id="vpn-dns-server"
                                value={form.dns_server}
                                onChange={(e) => onFormChange("dns_server", e.target.value)}
                            />
                        </Field>
                        <Field label={t("VPN.DomainRules")} id="vpn-domain-rules">
                            <Textarea
                                id="vpn-domain-rules"
                                className="min-h-24"
                                value={form.domains.join("\n")}
                                onChange={(e) =>
                                    onFormChange("domains", splitLines(e.target.value))
                                }
                                placeholder="github.com&#10;api.github.com"
                            />
                        </Field>
                        <Field label={t("VPN.CIDRRules")} id="vpn-cidr-rules">
                            <Textarea
                                id="vpn-cidr-rules"
                                className="min-h-24"
                                value={form.cidrs.join("\n")}
                                onChange={(e) => onFormChange("cidrs", splitLines(e.target.value))}
                                placeholder="140.82.112.0/20&#10;20.205.243.0/24"
                            />
                        </Field>
                        <Field label={t("VPN.DirectCIDRs")} id="vpn-direct-cidrs">
                            <Textarea
                                id="vpn-direct-cidrs"
                                className="min-h-24"
                                value={form.direct_cidrs.join("\n")}
                                onChange={(e) =>
                                    onFormChange("direct_cidrs", splitLines(e.target.value))
                                }
                                placeholder="127.0.0.0/8&#10;10.0.0.0/8"
                            />
                        </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                        <Field label={t("VPN.Expires")} id="vpn-expires">
                            <Input
                                id="vpn-expires"
                                type="number"
                                value={form.expires_seconds}
                                onChange={(e) =>
                                    onFormChange("expires_seconds", Number(e.target.value))
                                }
                            />
                        </Field>
                        <Field label={t("VPN.MaxUpload")} id="vpn-max-upload">
                            <Input
                                id="vpn-max-upload"
                                type="number"
                                min={0}
                                value={form.max_upload_bytes}
                                onChange={(e) =>
                                    onFormChange("max_upload_bytes", Number(e.target.value))
                                }
                            />
                        </Field>
                        <Field label={t("VPN.MaxDownload")} id="vpn-max-download">
                            <Input
                                id="vpn-max-download"
                                type="number"
                                min={0}
                                value={form.max_download_bytes}
                                onChange={(e) =>
                                    onFormChange("max_download_bytes", Number(e.target.value))
                                }
                            />
                        </Field>
                        <Field label={t("VPN.MaxConnections")} id="vpn-max-connections">
                            <Input
                                id="vpn-max-connections"
                                type="number"
                                value={form.max_connections}
                                onChange={(e) =>
                                    onFormChange("max_connections", Number(e.target.value))
                                }
                            />
                        </Field>
                        <Field label={t("VPN.IdleTimeout")} id="vpn-idle-timeout">
                            <Input
                                id="vpn-idle-timeout"
                                type="number"
                                min={0}
                                value={form.idle_timeout_seconds}
                                onChange={(e) =>
                                    onFormChange("idle_timeout_seconds", Number(e.target.value))
                                }
                            />
                        </Field>
                        <Field label={t("VPN.NotificationGroup")} id="vpn-notify-group">
                            <Select
                                value={String(form.notification_group_id)}
                                onValueChange={(value) =>
                                    onFormChange("notification_group_id", Number(value))
                                }
                            >
                                <SelectTrigger id="vpn-notify-group">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">-</SelectItem>
                                    {notifierGroups.map((item) => (
                                        <SelectItem
                                            key={item.group.id}
                                            value={String(item.group.id)}
                                        >
                                            {item.group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>

                    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                        <Label htmlFor="vpn-auto-restore">{t("VPN.AutoRestore")}</Label>
                        <Switch
                            id="vpn-auto-restore"
                            checked={form.auto_restart}
                            onCheckedChange={(checked) => onFormChange("auto_restart", checked)}
                        />
                    </div>

                    <div className="grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[12rem_1fr] xl:grid-cols-[12rem_1fr_1fr]">
                        <Field label={t("VPN.CoreVersion")} id="vpn-core-version">
                            <Input
                                id="vpn-core-version"
                                value={form.core_version}
                                onChange={(e) => onFormChange("core_version", e.target.value)}
                                placeholder="1.12.0"
                            />
                        </Field>
                        <Field label={t("VPN.CoreDownloadURL")} id="vpn-core-download-url">
                            <Input
                                id="vpn-core-download-url"
                                value={form.core_download_url}
                                onChange={(e) => onFormChange("core_download_url", e.target.value)}
                                placeholder="https://example.com/sing-box.exe"
                            />
                        </Field>
                        <Field label={t("VPN.CoreSHA256")} id="vpn-core-sha256">
                            <Input
                                id="vpn-core-sha256"
                                value={form.core_sha256}
                                onChange={(e) => onFormChange("core_sha256", e.target.value)}
                                placeholder="0123456789abcdef..."
                            />
                        </Field>
                    </div>

                    {form.mode === "system_proxy" && (
                        <div className="grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[12rem_1fr]">
                            <div className="flex items-center justify-between md:col-span-2">
                                <Label htmlFor="vpn-set-system-proxy">
                                    {t("VPN.SetSystemProxy")}
                                </Label>
                                <Switch
                                    id="vpn-set-system-proxy"
                                    checked={form.set_system_proxy}
                                    onCheckedChange={(checked) =>
                                        onFormChange("set_system_proxy", checked)
                                    }
                                />
                            </div>
                            <Field label={t("VPN.EgressProbeURL")} id="vpn-egress-probe-url">
                                <Input
                                    id="vpn-egress-probe-url"
                                    value={form.egress_probe_url}
                                    onChange={(e) =>
                                        onFormChange("egress_probe_url", e.target.value)
                                    }
                                    placeholder="https://ifconfig.me/ip"
                                />
                            </Field>
                        </div>
                    )}

                    {isTunMode && (
                        <div className="grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-[1fr_12rem]">
                            <Field label={t("VPN.TunHealthURL")} id="vpn-tun-health-url">
                                <Input
                                    id="vpn-tun-health-url"
                                    value={form.tun_health_url}
                                    onChange={(e) => onFormChange("tun_health_url", e.target.value)}
                                    placeholder="https://connectivitycheck.gstatic.com/generate_204"
                                />
                            </Field>
                            <Field label={t("VPN.TunHealthTimeout")} id="vpn-tun-health-timeout">
                                <Input
                                    id="vpn-tun-health-timeout"
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={form.tun_health_timeout_seconds}
                                    onChange={(e) =>
                                        onFormChange(
                                            "tun_health_timeout_seconds",
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </Field>
                        </div>
                    )}

                    {isTunMode && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                            <label
                                htmlFor="vpn-tun-risk-confirm"
                                className="flex items-start gap-3 text-sm"
                            >
                                <input
                                    id="vpn-tun-risk-confirm"
                                    type="checkbox"
                                    aria-label={t("VPN.TunRiskConfirm")}
                                    checked={tunRiskConfirmed}
                                    onChange={(e) => onTunRiskChange(e.target.checked)}
                                    className="mt-1 h-4 w-4"
                                />
                                <span>
                                    <span className="block font-medium">
                                        {t("VPN.TunRiskConfirm")}
                                    </span>
                                    <span className="mt-1 block text-muted-foreground">
                                        {t("VPN.TunRiskHint")}
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}
                </div>
            </details>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={onCancel}>
                    {t("Close")}
                </Button>
                <Button variant="outline" onClick={onSave}>
                    {t("VPN.SavePolicy")}
                </Button>
                <Button disabled={editingPolicyID === null} onClick={onStart}>
                    <Play className="mr-2 h-4 w-4" />
                    {t("VPN.StartSession")}
                </Button>
            </div>
        </div>
    )
}

function Field({ children, id, label }: { children: React.ReactNode; id: string; label: string }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {children}
        </div>
    )
}

function splitLines(value: string): string[] {
    return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean)
}
