import { swrFetcher } from "@/api/api"
import {
    notifyBestIPResult,
    rollbackBestIPAutomation,
    runBestIPAutomation,
    runBestIPFissionStream,
    saveBestIPAutomation,
    writeBestIPDNS,
} from "@/api/bestip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
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
import { Textarea } from "@/components/ui/textarea"
import { MultiSelect } from "@/components/xui/multi-select"
import { useNotification } from "@/hooks/useNotfication"
import {
    ModelBestIPAutomation,
    ModelBestIPAutomationForm,
    ModelBestIPAutomationHistory,
    ModelBestIPCandidateResult,
    ModelBestIPDNSWriteResult,
    ModelBestIPFissionForm,
    ModelBestIPFissionProgressEvent,
    ModelBestIPFissionResult,
    ModelDDNSCredential,
} from "@/types"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

const defaultSeedIPs = "1.1.1.1\n1.0.0.1"
const defaultScheduler = "0 */30 * * * *"
const defaultHTTPTestURL = "http://speed.cloudflare.com/__down?bytes=20971520"
const maxBestIPCandidateCount = 10

type BestIPFissionLogEntry = ModelBestIPFissionProgressEvent & {
    received_at: string
}

function parseList(value: string): string[] {
    return value
        .split(/[\n,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
}

function isIPv6(ip: string): boolean {
    return ip.includes(":")
}

function candidateFamily(candidate: ModelBestIPCandidateResult): string {
    if (candidate.family) return candidate.family
    return isIPv6(candidate.ip) ? "ipv6" : "ipv4"
}

function candidateType(candidate: ModelBestIPCandidateResult): string {
    return candidateFamily(candidate) === "ipv6" ? "AAAA" : "A"
}

function candidateFromIP(ip: string): ModelBestIPCandidateResult {
    return {
        family: isIPv6(ip) ? "ipv6" : "ipv4",
        ip,
        attempts: 0,
        successes: 0,
        avg_latency_ms: 0,
        success_rate: 0,
        download_mbps: 0,
        score: 0,
    }
}

function clampBestIPCandidateCount(value: number): number {
    if (!Number.isFinite(value)) return maxBestIPCandidateCount
    return Math.min(maxBestIPCandidateCount, Math.max(1, value))
}

function limitBestIPCandidates(
    candidates: ModelBestIPCandidateResult[],
): ModelBestIPCandidateResult[] {
    return candidates.slice(0, maxBestIPCandidateCount)
}

function hasSavedAutomation(
    automation?: ModelBestIPAutomation,
): automation is ModelBestIPAutomation {
    return Boolean(automation?.id)
}

function hasStoredFissionConfig(
    fission?: ModelBestIPFissionForm,
): fission is ModelBestIPFissionForm {
    return Boolean(fission?.seed_ips?.length)
}

function candidateRowsFromResult(result?: ModelBestIPFissionResult): ModelBestIPCandidateResult[] {
    if (!result) return []
    if (result.candidates?.length) return limitBestIPCandidates(result.candidates)

    const fromRounds = result.rounds.flatMap((round) => round.new_ips) ?? []
    const source = fromRounds.length > 0 ? fromRounds : (result.ips ?? [])
    return Array.from(new Set(source)).slice(0, maxBestIPCandidateCount).map(candidateFromIP)
}

export function defaultBestIPDDNSCredentialIDs(
    credentials?: Pick<ModelDDNSCredential, "id" | "provider">[],
): number[] {
    const items = credentials ?? []
    const cloudflareCredentials = items.filter((credential) => credential.provider === "cloudflare")
    if (cloudflareCredentials.length) return cloudflareCredentials.map((credential) => credential.id)

    const dnsProviderCredentials = items.filter(
        (credential) => credential.provider !== "dummy" && credential.provider !== "webhook",
    )
    if (dnsProviderCredentials.length) {
        return dnsProviderCredentials.map((credential) => credential.id)
    }

    return items.map((credential) => credential.id)
}

export const defaultBestIPDDNSProfileIDs = defaultBestIPDDNSCredentialIDs

function selectWriteRecords(
    candidates: ModelBestIPCandidateResult[],
    family: "ipv4" | "ipv6",
    topN: number,
): string[] {
    return candidates
        .slice(0, clampBestIPCandidateCount(topN))
        .filter((candidate) => candidateFamily(candidate) === family)
        .map((candidate) => candidate.ip)
}

function formatLatency(value: number): string {
    if (!value) return "-"
    return `${value.toFixed(1)} ms`
}

function formatSuccessRate(value: number): string {
    if (!value) return "-"
    return `${Math.round(value * 100)}%`
}

function formatDownloadSpeed(value: number): string {
    if (!value) return "-"
    return `${value.toFixed(2)} MB/s`
}

function formatScore(value: number): string {
    return value.toFixed(3)
}

function recordsText(records?: string[]): string {
    return records?.length ? records.join(", ") : "-"
}

function historyActionText(
    action: ModelBestIPAutomationHistory["action"],
    t: (key: string) => string,
): string {
    return action === "rollback" ? t("BestIP.ActionRollback") : t("BestIP.ActionRun")
}

function historyStatusText(success: boolean, t: (key: string) => string): string {
    return success ? t("BestIP.LogSuccess") : t("BestIP.LogFailure")
}

function historyDNSStatusText(
    results: ModelBestIPDNSWriteResult[] | undefined,
    t: (key: string) => string,
): string {
    if (!results?.length) return "-"
    return results.every((result) => result.success)
        ? t("BestIP.LogDNSSuccess")
        : t("BestIP.LogDNSFailed")
}

function historyRecordsText(history: ModelBestIPAutomationHistory): string {
    const records = [...(history.ipv4_records ?? []), ...(history.ipv6_records ?? [])]
    return recordsText(records)
}

function logTimeText(value: string | undefined): string {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
}

function fissionEventTitle(
    type: ModelBestIPFissionProgressEvent["type"],
    t: (key: string) => string,
): string {
    const titles: Record<ModelBestIPFissionProgressEvent["type"], string> = {
        start: "BestIP.EventStart",
        round_start: "BestIP.EventRoundStart",
        ip_lookup_start: "BestIP.EventIPLookupStart",
        lookup_source_start: "BestIP.EventLookupSourceStart",
        lookup_source_done: "BestIP.EventLookupSourceDone",
        ip_lookup_done: "BestIP.EventIPLookupDone",
        domain_resolve_start: "BestIP.EventDomainResolveStart",
        domain_resolve_done: "BestIP.EventDomainResolveDone",
        round_done: "BestIP.EventRoundDone",
        cloudflare_validation_start: "BestIP.EventCloudflareValidationStart",
        cloudflare_validation_done: "BestIP.EventCloudflareValidationDone",
        probe_start: "BestIP.EventProbeStart",
        probe_stage_start: "BestIP.EventProbeStageStart",
        probe_stage_done: "BestIP.EventProbeStageDone",
        probe_result: "BestIP.EventProbeResult",
        probe_done: "BestIP.EventProbeDone",
        done: "BestIP.EventDone",
        error: "BestIP.EventError",
    }
    return t(titles[type] ?? "BestIP.EventUnknown")
}

function fissionEventTerminalCode(type: ModelBestIPFissionProgressEvent["type"]): string {
    return type.replace(/_/g, "-").toUpperCase()
}

function fissionEventTerminalTone(event: ModelBestIPFissionProgressEvent): string {
    if (event.type === "error") return "text-red-300"
    if (event.type === "done") return "text-emerald-300"
    if (event.type === "probe_result") return "text-lime-300"
    if (event.type.endsWith("_start") || event.type === "start") return "text-cyan-300"
    if (event.type.endsWith("_done")) return "text-sky-300"
    return "text-zinc-200"
}

function fissionRoundPrefix(
    event: ModelBestIPFissionProgressEvent,
    t: (key: string) => string,
): string {
    return event.round ? `${t("BestIP.Round")} ${event.round} · ` : ""
}

function fissionEventDetail(
    event: ModelBestIPFissionProgressEvent,
    t: (key: string) => string,
): string {
    const roundPrefix = fissionRoundPrefix(event, t)
    switch (event.type) {
    case "start":
        return `${t("BestIP.TotalIPs")}: ${event.total_ips ?? event.ips?.length ?? 0} · IP: ${recordsText(event.ips)}`
    case "round_start":
        return `${roundPrefix}IP: ${recordsText(event.ips)}`
    case "ip_lookup_start":
        return `${roundPrefix}IP: ${event.ip || "-"}`
    case "lookup_source_start":
        return [
            `IP: ${event.ip || "-"}`,
            `${t("BestIP.LookupSource")}: ${event.source || "-"}`,
        ].join(" · ")
    case "lookup_source_done": {
        const details = [
            `IP: ${event.ip || "-"}`,
            `${t("BestIP.LookupSource")}: ${event.source || "-"}`,
        ]
        if (event.status_code) {
            details.push(`${t("BestIP.HTTPStatus")}: ${event.status_code}`)
        }
        details.push(
            `${t("BestIP.TotalDomains")}: ${event.total_domains ?? event.domains?.length ?? 0}`,
        )
        details.push(`${t("Domains")}: ${recordsText(event.domains)}`)
        if (event.error) {
            details.push(`${t("Error")}: ${event.error}`)
        }
        return details.join(" · ")
    }
    case "ip_lookup_done":
        return `${roundPrefix}${event.ip || "-"} -> ${recordsText(event.domains)}`
    case "domain_resolve_start":
        return `${roundPrefix}${event.domain || "-"}`
    case "domain_resolve_done":
        return `${roundPrefix}${event.domain || "-"} -> ${recordsText(event.ips)}`
    case "round_done": {
        const round = event.round_result
        return [
            `${roundPrefix}${t("BestIP.NewIPs")}: ${recordsText(event.new_ips ?? round?.new_ips)}`,
            `${t("BestIP.NewDomains")}: ${recordsText(event.new_domains ?? round?.new_domains)}`,
            `${t("BestIP.TotalIPs")}: ${event.total_ips ?? round?.total_ips ?? 0}`,
            `${t("BestIP.TotalDomains")}: ${event.total_domains ?? round?.total_domains ?? 0}`,
        ].join(" · ")
    }
    case "cloudflare_validation_start":
        return `${t("BestIP.TotalIPs")}: ${event.total_ips ?? event.ips?.length ?? 0} · IP: ${recordsText(event.ips)}`
    case "cloudflare_validation_done":
        return [
            `${t("BestIP.TotalIPs")}: ${event.total_ips ?? event.ips?.length ?? 0}`,
            `${t("BestIP.FilteredIPs")}: ${recordsText(event.filtered_ips)}`,
            `${t("BestIP.CloudflareRanges")}: IPv4 ${event.cloudflare_ipv4_ranges ?? 0} / IPv6 ${event.cloudflare_ipv6_ranges ?? 0}`,
            `${t("BestIP.CloudflareHitRate")}: ${formatSuccessRate(event.cloudflare_hit_rate ?? 0)}`,
        ].join(" · ")
    case "probe_start":
        return [
            `IP: ${recordsText(event.ips)}`,
            `${t("BestIP.ProbePort")}: ${event.probe_port ?? "-"}`,
            `${t("BestIP.ProbeCount")}: ${event.probe_count ?? "-"}`,
        ].join(" · ")
    case "probe_stage_start":
        return [
            `${t("BestIP.ProbeStage")}: ${event.stage || "-"}`,
            `${t("BestIP.TotalIPs")}: ${event.total_ips ?? event.ips?.length ?? 0}`,
            `${t("BestIP.ProbeCount")}: ${event.probe_count ?? "-"}`,
            `${t("BestIP.Workers")}: ${event.workers ?? "-"}`,
        ].join(" · ")
    case "probe_stage_done":
        return [
            `${t("BestIP.ProbeStage")}: ${event.stage || "-"}`,
            `${t("BestIP.DoneCount")}: ${event.done ?? 0}/${event.total_ips ?? 0}`,
            `${t("BestIP.ProbeCount")}: ${event.probe_count ?? "-"}`,
        ].join(" · ")
    case "probe_result": {
        const candidate = event.candidate
        if (!candidate) return event.ip || "-"
        return [
            `IP: ${candidate.ip || event.ip || "-"}`,
            `${t("BestIP.Latency")}: ${formatLatency(candidate.avg_latency_ms)}`,
            `${t("BestIP.P95Latency")}: ${formatLatency(candidate.p95_latency_ms ?? 0)}`,
            `${t("BestIP.SuccessRate")}: ${formatSuccessRate(candidate.success_rate)}`,
            `${t("BestIP.ProbeErrors")}: ${candidate.timeout_count ?? 0}/${candidate.refused_count ?? 0}/${candidate.other_errors ?? 0}`,
            `${t("BestIP.Score")}: ${formatScore(candidate.score)}`,
        ].join(" · ")
    }
    case "probe_done": {
        const stats = event.probe_stats
        return [
            `${t("BestIP.TotalIPs")}: ${event.total_ips ?? stats?.total_probes ?? 0}`,
            `${t("BestIP.TCPDialAttempts")}: ${stats?.tcp_dial_attempts ?? "-"}`,
            `${t("BestIP.SuccessRate")}: ${stats?.total_probes ? formatSuccessRate((stats.success_count ?? 0) / stats.total_probes) : "-"}`,
            `${t("BestIP.ProbeErrors")}: ${stats?.timeout_count ?? 0}/${stats?.refused_count ?? 0}/${stats?.other_error_count ?? 0}`,
            `${t("BestIP.HTTPTestCount")}: ${stats?.http_test_count ?? 0}`,
            `${t("BestIP.HTTPResult")}: ${stats?.http_success_count ?? 0}/${stats?.http_fail_count ?? 0}`,
            `${t("BestIP.StagedScan")}: ${stats?.staged_scan ? t("BestIP.Enabled") : t("BestIP.Disabled")}`,
        ].join(" · ")
    }
    case "done":
        return `${t("BestIP.TotalIPs")}: ${event.total_ips ?? event.result?.ips?.length ?? event.ips?.length ?? 0} · IP: ${recordsText(event.ips ?? event.result?.ips)}`
    case "error":
        return event.error || "-"
    default:
        return "-"
    }
}

export default function BestIPPage() {
    const { t } = useTranslation()
    const { data: ddnsCredentials, isLoading: isLoadingDDNSCredentials } = useSWR<
        ModelDDNSCredential[]
    >(
        "/api/v1/ddns-credential",
        swrFetcher,
    )
    const { notifierGroup } = useNotification()
    const [seedIPs, setSeedIPs] = useState(defaultSeedIPs)
    const [rounds, setRounds] = useState(2)
    const [concurrency, setConcurrency] = useState(10)
    const [timeoutMS, setTimeoutMS] = useState(3000)
    const [maxDomains, setMaxDomains] = useState(200)
    const [maxIPsPerRound, setMaxIPsPerRound] = useState(200)
    const [enableIPv4, setEnableIPv4] = useState(true)
    const [enableIPv6, setEnableIPv6] = useState(false)
    const [probePort, setProbePort] = useState(443)
    const [probeCount, setProbeCount] = useState(3)
    const [resultCount, setResultCount] = useState(10)
    const [httpTestEnabled, setHTTPTestEnabled] = useState(true)
    const [httpTestURL, setHTTPTestURL] = useState(defaultHTTPTestURL)
    const [httpTestSeconds, setHTTPTestSeconds] = useState(3)
    const [minDownloadMBps, setMinDownloadMBps] = useState(0)
    const [weightLatency, setWeightLatency] = useState(0.35)
    const [weightSuccessRate, setWeightSuccessRate] = useState(0.25)
    const [weightDownload, setWeightDownload] = useState(0.4)
    const [stagedScanEnabled, setStagedScanEnabled] = useState(false)
    const [quickTCPCount, setQuickTCPCount] = useState(80)
    const [latencyCheckCount, setLatencyCheckCount] = useState(40)
    const [selectedDDNSCredentials, setSelectedDDNSCredentials] = useState<number[]>([])
    const [ddnsSelectionTouched, setDDNSSelectionTouched] = useState(false)
    const [overrideDomains, setOverrideDomains] = useState("")
    const [overrideDomainsTouched, setOverrideDomainsTouched] = useState(false)
    const [writeTopN, setWriteTopN] = useState(1)
    const [fissionResult, setFissionResult] = useState<ModelBestIPFissionResult>()
    const [fissionLogs, setFissionLogs] = useState<BestIPFissionLogEntry[]>([])
    const [dnsResults, setDNSResults] = useState<ModelBestIPDNSWriteResult[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [isWriting, setIsWriting] = useState(false)
    const [automationEnabled, setAutomationEnabled] = useState(false)
    const [automationScheduler, setAutomationScheduler] = useState(defaultScheduler)
    const [automationAutoWriteDNS, setAutomationAutoWriteDNS] = useState(true)
    const [fissionNotificationGroupID, setFissionNotificationGroupID] = useState(0)
    const [fissionNotificationGroupTouched, setFissionNotificationGroupTouched] = useState(false)
    const [automationNotificationGroupID, setAutomationNotificationGroupID] = useState(0)
    const [automationNotificationGroupTouched, setAutomationNotificationGroupTouched] = useState(false)
    const [pushSuccessful, setPushSuccessful] = useState(true)
    const [pushSuccessfulTouched, setPushSuccessfulTouched] = useState(false)
    const [pushFailed, setPushFailed] = useState(true)
    const [pushFailedTouched, setPushFailedTouched] = useState(false)
    const [automationResult, setAutomationResult] = useState<ModelBestIPAutomationHistory>()
    const [isSavingFissionConfig, setIsSavingFissionConfig] = useState(false)
    const [isSavingDNSConfig, setIsSavingDNSConfig] = useState(false)
    const [isSavingAutomation, setIsSavingAutomation] = useState(false)
    const [isRunningAutomation, setIsRunningAutomation] = useState(false)
    const [isRollingBackAutomation, setIsRollingBackAutomation] = useState(false)
    const fissionLogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!fissionLogs.length) return

        const logStream = fissionLogRef.current
        if (!logStream) return

        logStream.scrollTop = logStream.scrollHeight
    }, [fissionLogs])

    const loadAutomation = useCallback((nextAutomation: ModelBestIPAutomation) => {
        const saved = hasSavedAutomation(nextAutomation)
        setAutomationEnabled(Boolean(nextAutomation.enabled))
        setAutomationScheduler(nextAutomation.scheduler || defaultScheduler)
        setAutomationAutoWriteDNS(saved ? nextAutomation.auto_write_dns : true)
        setFissionNotificationGroupID(
            saved ? nextAutomation.fission_notification_group_id || 0 : 0,
        )
        setAutomationNotificationGroupID(saved ? nextAutomation.notification_group_id || 0 : 0)
        setPushSuccessful(saved ? nextAutomation.push_successful : true)
        setPushFailed(saved ? nextAutomation.push_failed : true)
        setWriteTopN(clampBestIPCandidateCount(nextAutomation.write_top_n || 1))
        if (saved) {
            setSelectedDDNSCredentials(nextAutomation.ddns_credentials ?? [])
            setDDNSSelectionTouched(true)
        }
        setOverrideDomains(saved ? nextAutomation.domains?.join("\n") || "" : "")
        if (hasStoredFissionConfig(nextAutomation.fission)) {
            setSeedIPs((nextAutomation.fission.seed_ips ?? []).join("\n") || defaultSeedIPs)
            setRounds(nextAutomation.fission.rounds || 2)
            setConcurrency(nextAutomation.fission.concurrency || 10)
            setTimeoutMS(nextAutomation.fission.timeout_ms || 3000)
            setMaxDomains(nextAutomation.fission.max_domains || 200)
            setMaxIPsPerRound(nextAutomation.fission.max_ips_per_round || 200)
            setEnableIPv4((nextAutomation.fission.families ?? ["ipv4"]).includes("ipv4"))
            setEnableIPv6((nextAutomation.fission.families ?? []).includes("ipv6"))
            setProbePort(nextAutomation.fission.probe_port || 443)
            setProbeCount(nextAutomation.fission.probe_count || 3)
            setResultCount(clampBestIPCandidateCount(nextAutomation.fission.result_count || 10))
            setHTTPTestEnabled(nextAutomation.fission.http_test_enabled ?? true)
            setHTTPTestURL(nextAutomation.fission.http_test_url || defaultHTTPTestURL)
            setHTTPTestSeconds(nextAutomation.fission.http_test_seconds || 3)
            setMinDownloadMBps(nextAutomation.fission.min_download_mbps ?? 0)
            setWeightLatency(nextAutomation.fission.weight_latency ?? 0.35)
            setWeightSuccessRate(nextAutomation.fission.weight_success_rate ?? 0.25)
            setWeightDownload(nextAutomation.fission.weight_download ?? 0.4)
            setStagedScanEnabled(nextAutomation.fission.staged_scan_enabled ?? false)
            setQuickTCPCount(nextAutomation.fission.quick_tcp_count || 80)
            setLatencyCheckCount(nextAutomation.fission.latency_check_count || 40)
        }
        if (saved && nextAutomation.last_candidates?.length) {
            setFissionResult({
                ips: nextAutomation.last_candidates.map((candidate) => candidate.ip),
                rounds: [],
                candidates: nextAutomation.last_candidates,
            })
        }
        if (saved && nextAutomation.last_dns_results?.length) {
            setDNSResults(nextAutomation.last_dns_results)
        }
    }, [])

    const { data: automation, mutate: mutateAutomation } = useSWR<ModelBestIPAutomation>(
        "/api/v1/bestip/automation",
        swrFetcher,
        { onSuccess: loadAutomation },
    )
    const { data: automationHistories, mutate: mutateAutomationHistories } = useSWR<
        ModelBestIPAutomationHistory[]
    >("/api/v1/bestip/automation/history", swrFetcher)

    const effectiveSelectedDDNSCredentials = useMemo(() => {
        if (ddnsSelectionTouched || selectedDDNSCredentials.length > 0) {
            return selectedDDNSCredentials
        }
        if (hasSavedAutomation(automation)) return automation.ddns_credentials ?? []
        return defaultBestIPDDNSCredentialIDs(ddnsCredentials)
    }, [automation, ddnsCredentials, ddnsSelectionTouched, selectedDDNSCredentials])

    const ddnsCredentialOptions = useMemo(
        () =>
            (ddnsCredentials ?? []).map((credential) => ({
                label: `${credential.name} (${credential.provider})`,
                value: String(credential.id),
            })),
        [ddnsCredentials],
    )

    const effectiveOverrideDomains = overrideDomainsTouched
        ? overrideDomains
        : overrideDomains || automation?.domains?.join("\n") || ""

    const effectiveFissionNotificationGroupID = fissionNotificationGroupTouched
        ? fissionNotificationGroupID
        : hasSavedAutomation(automation)
            ? (automation?.fission_notification_group_id ?? 0)
            : fissionNotificationGroupID
    const effectiveAutomationNotificationGroupID = automationNotificationGroupTouched
        ? automationNotificationGroupID
        : hasSavedAutomation(automation)
            ? (automation?.notification_group_id ?? 0)
            : automationNotificationGroupID
    const effectivePushSuccessful = pushSuccessfulTouched
        ? pushSuccessful
        : hasSavedAutomation(automation)
            ? (automation?.push_successful ?? false)
            : pushSuccessful
    const effectivePushFailed = pushFailedTouched
        ? pushFailed
        : hasSavedAutomation(automation)
            ? (automation?.push_failed ?? false)
            : pushFailed

    const candidateRows = useMemo(() => candidateRowsFromResult(fissionResult), [fissionResult])

    const selectedIPv4Records = useMemo(
        () => selectWriteRecords(candidateRows, "ipv4", writeTopN),
        [candidateRows, writeTopN],
    )

    const selectedIPv6Records = useMemo(
        () => selectWriteRecords(candidateRows, "ipv6", writeTopN),
        [candidateRows, writeTopN],
    )

    const buildNotifyForm = (rows: ModelBestIPCandidateResult[]) => ({
        notification_group_id: effectiveFissionNotificationGroupID,
        domains: parseList(effectiveOverrideDomains),
        ipv4_records: selectWriteRecords(rows, "ipv4", writeTopN),
        ipv6_records: selectWriteRecords(rows, "ipv6", writeTopN),
        candidates: rows,
        write_top_n: clampBestIPCandidateCount(writeTopN),
    })

    const notificationGroupOptions = useMemo(
        () => [
            { value: "0", label: t("BestIP.NoNotificationGroup") },
            ...(notifierGroup ?? []).map((group) => ({
                value: String(group.group.id),
                label: group.group.name,
            })),
        ],
        [notifierGroup, t],
    )

    const buildFissionForm = (): ModelBestIPFissionForm => ({
        seed_ips: parseList(seedIPs),
        rounds,
        concurrency,
        timeout_ms: timeoutMS,
        max_domains: maxDomains,
        max_ips_per_round: maxIPsPerRound,
        families: [enableIPv4 ? "ipv4" : "", enableIPv6 ? "ipv6" : ""].filter(Boolean),
        probe_port: probePort,
        probe_count: probeCount,
        result_count: clampBestIPCandidateCount(resultCount),
        http_test_enabled: httpTestEnabled,
        http_test_url: httpTestURL,
        http_test_seconds: httpTestSeconds,
        min_download_mbps: minDownloadMBps,
        weight_latency: weightLatency,
        weight_success_rate: weightSuccessRate,
        weight_download: weightDownload,
        staged_scan_enabled: stagedScanEnabled,
        quick_tcp_count: quickTCPCount,
        latency_check_count: latencyCheckCount,
    })

    const buildStoredConfigForm = (): ModelBestIPAutomationForm => {
        const saved = hasSavedAutomation(automation)
        const storedFission = automation?.fission
        return {
            enabled: saved ? Boolean(automation?.enabled) : false,
            scheduler: saved ? automation?.scheduler || defaultScheduler : defaultScheduler,
            auto_write_dns: saved ? Boolean(automation?.auto_write_dns) : automationAutoWriteDNS,
            push_successful: saved ? Boolean(automation?.push_successful) : effectivePushSuccessful,
            push_failed: saved ? Boolean(automation?.push_failed) : effectivePushFailed,
            fission_notification_group_id: saved
                ? (automation?.fission_notification_group_id ?? 0)
                : 0,
            notification_group_id: saved ? (automation?.notification_group_id ?? 0) : 0,
            write_top_n: clampBestIPCandidateCount(
                saved ? automation?.write_top_n || 1 : writeTopN,
            ),
            ddns_profiles: saved ? (automation?.ddns_profiles ?? []) : [],
            ddns_credentials: saved
                ? (automation?.ddns_credentials ?? [])
                : effectiveSelectedDDNSCredentials,
            domains: saved ? (automation?.domains ?? []) : parseList(effectiveOverrideDomains),
            fission: hasStoredFissionConfig(storedFission) ? storedFission : buildFissionForm(),
        }
    }

    const buildFissionConfigForm = (): ModelBestIPAutomationForm => ({
        ...buildStoredConfigForm(),
        fission_notification_group_id: effectiveFissionNotificationGroupID,
        fission: buildFissionForm(),
    })

    const buildDNSConfigForm = (): ModelBestIPAutomationForm => ({
        ...buildStoredConfigForm(),
        write_top_n: clampBestIPCandidateCount(writeTopN),
        ddns_profiles: [],
        ddns_credentials: effectiveSelectedDDNSCredentials,
        domains: parseList(effectiveOverrideDomains),
    })

    const buildAutomationForm = (): ModelBestIPAutomationForm => ({
        ...buildStoredConfigForm(),
        enabled: automationEnabled,
        scheduler: automationScheduler,
        auto_write_dns: automationAutoWriteDNS,
        push_successful: effectivePushSuccessful,
        push_failed: effectivePushFailed,
        notification_group_id: effectiveAutomationNotificationGroupID,
    })

    const applyAutomationHistory = (history: ModelBestIPAutomationHistory) => {
        setAutomationResult(history)
        if (history.candidates?.length) {
            setFissionResult({
                ips: history.candidates.map((candidate) => candidate.ip),
                rounds: [],
                candidates: history.candidates,
            })
        }
        if (history.dns_results?.length) {
            setDNSResults(history.dns_results)
        }
    }

    const appendFissionLog = (event: ModelBestIPFissionProgressEvent) => {
        setFissionLogs((current) => [
            ...current,
            {
                ...event,
                received_at: new Date().toLocaleTimeString(),
            },
        ])
    }

    const sendNotifyResult = async (
        rows: ModelBestIPCandidateResult[],
        showSuccessToast: boolean,
    ) => {
        const form = buildNotifyForm(rows)
        if (
            form.notification_group_id === 0 ||
            (form.ipv4_records.length === 0 && form.ipv6_records.length === 0)
        ) {
            return
        }
        await notifyBestIPResult(form)
        if (showSuccessToast) toast(t("Success"))
    }

    const runFission = async () => {
        setIsRunning(true)
        setDNSResults([])
        setFissionLogs([])
        let receivedErrorEvent = false
        try {
            const result = await runBestIPFissionStream(buildFissionForm(), (event) => {
                if (event.type === "error") receivedErrorEvent = true
                appendFissionLog(event)
            })
            setFissionResult(result)
            const nextCandidateRows = candidateRowsFromResult(result)
            try {
                await sendNotifyResult(nextCandidateRows, false)
            } catch (error) {
                toast(t("Error"), {
                    description:
                        error instanceof Error ? error.message : t("Results.UnExpectedError"),
                })
            }
        } catch (error) {
            if (!receivedErrorEvent) {
                appendFissionLog({
                    type: "error",
                    error: error instanceof Error ? error.message : t("Results.UnExpectedError"),
                })
            }
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setIsRunning(false)
        }
    }

    const persistConfig = async (
        setSaving: (saving: boolean) => void,
        buildForm: () => ModelBestIPAutomationForm,
    ) => {
        setSaving(true)
        try {
            await saveBestIPAutomation(buildForm())
            await mutateAutomation()
        } catch (error) {
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setSaving(false)
        }
    }

    const saveFissionConfig = async () => {
        await persistConfig(setIsSavingFissionConfig, buildFissionConfigForm)
    }

    const saveDNSConfig = async () => {
        await persistConfig(setIsSavingDNSConfig, buildDNSConfigForm)
    }

    const saveAutomation = async () => {
        await persistConfig(setIsSavingAutomation, buildAutomationForm)
    }

    const runAutomation = async () => {
        setIsRunningAutomation(true)
        try {
            const history = await runBestIPAutomation()
            applyAutomationHistory(history)
            await mutateAutomation()
            await mutateAutomationHistories()
        } catch (error) {
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setIsRunningAutomation(false)
        }
    }

    const rollbackAutomation = async () => {
        setIsRollingBackAutomation(true)
        try {
            const history = await rollbackBestIPAutomation()
            applyAutomationHistory(history)
            await mutateAutomation()
            await mutateAutomationHistories()
        } catch (error) {
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setIsRollingBackAutomation(false)
        }
    }

    const writeDNS = async () => {
        setIsWriting(true)
        try {
            const results = await writeBestIPDNS({
                ddns_profiles: [],
                ddns_credentials: effectiveSelectedDDNSCredentials,
                domains: parseList(effectiveOverrideDomains),
                ipv4_records: selectedIPv4Records,
                ipv6_records: selectedIPv6Records,
            })
            setDNSResults(results)
        } catch (error) {
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setIsWriting(false)
        }
    }

    const handleDDNSCredentialsChange = (values: string[]) => {
        setDDNSSelectionTouched(true)
        setSelectedDDNSCredentials(values.map(Number).filter((value) => Number.isFinite(value)))
    }

    return (
        <div className="px-3 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between w-full gap-3 mt-6 mb-4">
                <h1 className="text-3xl font-bold tracking-tight">{t("BestIP.Title")}</h1>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="grid gap-1 sm:w-56">
                        <Label
                            htmlFor="bestip-fission-notification-group"
                            className="text-xs text-muted-foreground"
                        >
                            {t("BestIP.FissionNotificationGroup")}
                        </Label>
                        <Combobox
                            key={`fission-${effectiveFissionNotificationGroupID}`}
                            id="bestip-fission-notification-group"
                            aria-label={t("BestIP.FissionNotificationGroup")}
                            options={notificationGroupOptions}
                            defaultValue={String(effectiveFissionNotificationGroupID)}
                            placeholder={t("BestIP.NoNotificationGroup")}
                            onValueChange={(value) => {
                                setFissionNotificationGroupTouched(true)
                                setFissionNotificationGroupID(Number(value || 0))
                            }}
                        />
                    </div>
                    <Button onClick={runFission} disabled={isRunning}>
                        {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("BestIP.RunFission")}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4">
                <Card className="rounded-md shadow-none">
                    <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-lg">{t("BestIP.FissionConfig")}</CardTitle>
                        <Button
                            variant="outline"
                            onClick={saveFissionConfig}
                            disabled={isSavingFissionConfig}
                            className="w-full sm:w-auto"
                        >
                            {isSavingFissionConfig && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("BestIP.SaveFissionConfig")}
                        </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="bestip-seed-ips">{t("BestIP.SeedIPs")}</Label>
                            <Textarea
                                id="bestip-seed-ips"
                                value={seedIPs}
                                onChange={(event) => setSeedIPs(event.target.value)}
                                className="min-h-24"
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <NumberField
                                id="bestip-rounds"
                                label={t("BestIP.Rounds")}
                                value={rounds}
                                min={1}
                                max={5}
                                onChange={setRounds}
                            />
                            <NumberField
                                id="bestip-concurrency"
                                label={t("BestIP.Concurrency")}
                                value={concurrency}
                                min={1}
                                max={100}
                                onChange={setConcurrency}
                            />
                            <NumberField
                                id="bestip-timeout"
                                label={t("BestIP.TimeoutMS")}
                                value={timeoutMS}
                                min={100}
                                max={30000}
                                onChange={setTimeoutMS}
                            />
                            <NumberField
                                id="bestip-max-domains"
                                label={t("BestIP.MaxDomains")}
                                value={maxDomains}
                                min={1}
                                max={5000}
                                onChange={setMaxDomains}
                            />
                            <NumberField
                                id="bestip-max-ips"
                                label={t("BestIP.MaxIPsPerRound")}
                                value={maxIPsPerRound}
                                min={1}
                                max={5000}
                                onChange={setMaxIPsPerRound}
                            />
                            <div className="grid gap-2">
                                <Label>{t("BestIP.Families")}</Label>
                                <div className="flex h-10 items-center gap-4 rounded-md border px-3">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={enableIPv4}
                                            onCheckedChange={(checked) =>
                                                setEnableIPv4(checked === true)
                                            }
                                        />
                                        IPv4
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={enableIPv6}
                                            onCheckedChange={(checked) =>
                                                setEnableIPv6(checked === true)
                                            }
                                        />
                                        IPv6
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 rounded-md border p-3">
                            <div className="text-sm font-medium">{t("BestIP.ProbeAndScoring")}</div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <NumberField
                                    id="bestip-probe-port"
                                    label={t("BestIP.ProbePort")}
                                    value={probePort}
                                    min={1}
                                    max={65535}
                                    onChange={setProbePort}
                                />
                                <NumberField
                                    id="bestip-probe-count"
                                    label={t("BestIP.ProbeCount")}
                                    value={probeCount}
                                    min={1}
                                    max={10}
                                    onChange={setProbeCount}
                                />
                                <NumberField
                                    id="bestip-result-count"
                                    label={t("BestIP.ResultCount")}
                                    value={resultCount}
                                    min={1}
                                    max={maxBestIPCandidateCount}
                                    onChange={(value) =>
                                        setResultCount(clampBestIPCandidateCount(value))
                                    }
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={httpTestEnabled}
                                    onCheckedChange={(checked) =>
                                        setHTTPTestEnabled(checked === true)
                                    }
                                />
                                {t("BestIP.HTTPTestEnabled")}
                            </label>
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                                <div className="grid gap-2">
                                    <Label htmlFor="bestip-http-test-url">
                                        {t("BestIP.HTTPTestURL")}
                                    </Label>
                                    <Input
                                        id="bestip-http-test-url"
                                        value={httpTestURL}
                                        onChange={(event) => setHTTPTestURL(event.target.value)}
                                        disabled={!httpTestEnabled}
                                    />
                                </div>
                                <NumberField
                                    id="bestip-http-test-seconds"
                                    label={t("BestIP.HTTPTestSeconds")}
                                    value={httpTestSeconds}
                                    min={1}
                                    max={30}
                                    onChange={setHTTPTestSeconds}
                                />
                                <NumberField
                                    id="bestip-min-download"
                                    label={t("BestIP.MinDownloadMBps")}
                                    value={minDownloadMBps}
                                    min={0}
                                    max={10000}
                                    step="0.1"
                                    onChange={setMinDownloadMBps}
                                />
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <NumberField
                                    id="bestip-weight-latency"
                                    label={t("BestIP.WeightLatency")}
                                    value={weightLatency}
                                    min={0}
                                    max={1}
                                    step="0.01"
                                    onChange={setWeightLatency}
                                />
                                <NumberField
                                    id="bestip-weight-success"
                                    label={t("BestIP.WeightSuccessRate")}
                                    value={weightSuccessRate}
                                    min={0}
                                    max={1}
                                    step="0.01"
                                    onChange={setWeightSuccessRate}
                                />
                                <NumberField
                                    id="bestip-weight-download"
                                    label={t("BestIP.WeightDownload")}
                                    value={weightDownload}
                                    min={0}
                                    max={1}
                                    step="0.01"
                                    onChange={setWeightDownload}
                                />
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                                <label className="flex h-10 items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={stagedScanEnabled}
                                        onCheckedChange={(checked) =>
                                            setStagedScanEnabled(checked === true)
                                        }
                                    />
                                    {t("BestIP.StagedScanEnabled")}
                                </label>
                                <NumberField
                                    id="bestip-quick-tcp-count"
                                    label={t("BestIP.QuickTCPCount")}
                                    value={quickTCPCount}
                                    min={1}
                                    max={5000}
                                    onChange={setQuickTCPCount}
                                />
                                <NumberField
                                    id="bestip-latency-check-count"
                                    label={t("BestIP.LatencyCheckCount")}
                                    value={latencyCheckCount}
                                    min={1}
                                    max={5000}
                                    onChange={setLatencyCheckCount}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-md shadow-none">
                    <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-lg">{t("BestIP.DNSWriteback")}</CardTitle>
                        <Button
                            variant="outline"
                            onClick={saveDNSConfig}
                            disabled={isSavingDNSConfig}
                            className="w-full sm:w-auto"
                        >
                            {isSavingDNSConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("BestIP.SaveDNSConfig")}
                        </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>{t("BestIP.DDNSCredentials")}</Label>
                            <div className="grid gap-2">
                                {isLoadingDDNSCredentials && (
                                    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                                        {t("Loading")}
                                    </div>
                                )}
                                {!isLoadingDDNSCredentials && Boolean(ddnsCredentials?.length) && (
                                    <MultiSelect
                                        options={ddnsCredentialOptions}
                                        value={effectiveSelectedDDNSCredentials.map(String)}
                                        onValueChange={handleDDNSCredentialsChange}
                                        placeholder={t("BestIP.SelectDDNSCredentials")}
                                        maxCount={2}
                                    />
                                )}
                                {!isLoadingDDNSCredentials && !ddnsCredentials?.length && (
                                    <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:flex sm:items-center sm:justify-between">
                                        <div className="grid gap-1">
                                            <div className="font-medium text-foreground">
                                                {t("BestIP.DDNSCredentialsEmpty")}
                                            </div>
                                            <div className="text-muted-foreground">
                                                {t("BestIP.DDNSCredentialsEmptyHint")}
                                            </div>
                                        </div>
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="w-full sm:w-auto"
                                        >
                                            <a href="/dashboard/ddns">
                                                {t("BestIP.CreateDDNSCredential")}
                                            </a>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                            <div className="grid gap-2">
                                <Label htmlFor="bestip-domains">
                                    {t("BestIP.WritebackDomains")}
                                </Label>
                                <Input
                                    id="bestip-domains"
                                    value={effectiveOverrideDomains}
                                    onChange={(event) => {
                                        setOverrideDomainsTouched(true)
                                        setOverrideDomains(event.target.value)
                                    }}
                                    placeholder={t("BestIP.WritebackDomainsPlaceholder")}
                                />
                            </div>
                            <NumberField
                                id="bestip-write-top-n"
                                label={t("BestIP.WriteTopN")}
                                value={writeTopN}
                                min={1}
                                max={maxBestIPCandidateCount}
                                onChange={(value) => setWriteTopN(clampBestIPCandidateCount(value))}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                onClick={writeDNS}
                                disabled={
                                    isWriting ||
                                    effectiveSelectedDDNSCredentials.length === 0 ||
                                    parseList(effectiveOverrideDomains).length === 0 ||
                                    (selectedIPv4Records.length === 0 &&
                                        selectedIPv6Records.length === 0)
                                }
                                className="w-full sm:w-auto"
                            >
                                {isWriting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("BestIP.WriteDNS")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-4 rounded-md shadow-none">
                <CardHeader>
                    <CardTitle className="text-lg">{t("BestIP.Automation")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <div className="grid gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="bestip-automation-scheduler">
                                {t("BestIP.AutomationScheduler")}
                            </Label>
                            <Input
                                id="bestip-automation-scheduler"
                                value={automationScheduler}
                                onChange={(event) => setAutomationScheduler(event.target.value)}
                                placeholder={defaultScheduler}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bestip-notification-group">
                                {t("BestIP.NotificationGroup")}
                            </Label>
                            <Combobox
                                key={effectiveAutomationNotificationGroupID}
                                id="bestip-notification-group"
                                aria-label={t("BestIP.NotificationGroup")}
                                options={notificationGroupOptions}
                                defaultValue={String(effectiveAutomationNotificationGroupID)}
                                placeholder={t("BestIP.NoNotificationGroup")}
                                onValueChange={(value) => {
                                    setAutomationNotificationGroupTouched(true)
                                    setAutomationNotificationGroupID(Number(value || 0))
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={automationEnabled}
                                onCheckedChange={(checked) =>
                                    setAutomationEnabled(checked === true)
                                }
                            />
                            {t("BestIP.EnableAutomation")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={automationAutoWriteDNS}
                                onCheckedChange={(checked) =>
                                    setAutomationAutoWriteDNS(checked === true)
                                }
                            />
                            {t("BestIP.AutoWriteDNS")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={effectivePushSuccessful}
                                onCheckedChange={(checked) => {
                                    setPushSuccessfulTouched(true)
                                    setPushSuccessful(checked === true)
                                }}
                            />
                            {t("BestIP.PushSuccessful")}
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={effectivePushFailed}
                                onCheckedChange={(checked) => {
                                    setPushFailedTouched(true)
                                    setPushFailed(checked === true)
                                }}
                            />
                            {t("BestIP.PushFailed")}
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={saveAutomation} disabled={isSavingAutomation}>
                            {isSavingAutomation && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("BestIP.SaveAutomation")}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={runAutomation}
                            disabled={isRunningAutomation}
                        >
                            {isRunningAutomation && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("BestIP.RunAutomation")}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={rollbackAutomation}
                            disabled={
                                isRollingBackAutomation ||
                                (!automation?.rollback_ipv4_records?.length &&
                                    !automation?.rollback_ipv6_records?.length)
                            }
                        >
                            {isRollingBackAutomation && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("BestIP.RollbackDNS")}
                        </Button>
                    </div>
                    <div className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-3">
                        <div>
                            <div className="text-muted-foreground">{t("LastExecution")}</div>
                            <div>{automation?.last_run_at ?? "-"}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">
                                {t("BestIP.LastWriteRecords")}
                            </div>
                            <div className="font-mono text-xs">
                                {recordsText(
                                    automationResult?.ipv4_records ?? automation?.last_ipv4_records,
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">
                                {t("BestIP.RollbackRecords")}
                            </div>
                            <div className="font-mono text-xs">
                                {recordsText(
                                    automationResult?.rollback_ipv4_records ??
                                        automation?.rollback_ipv4_records,
                                )}
                            </div>
                        </div>
                    </div>
                    {automation?.last_error && (
                        <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
                            {automation.last_error}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="mt-4 rounded-md shadow-none">
                <CardHeader>
                    <CardTitle className="text-lg">{t("BestIP.RunLogs")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5">
                    <div className="grid gap-2">
                        <div className="text-sm font-medium">{t("BestIP.RealtimeLog")}</div>
                        <div
                            ref={fissionLogRef}
                            role="log"
                            aria-label={t("BestIP.RealtimeLog")}
                            aria-live="polite"
                            aria-atomic="false"
                            className="max-h-96 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 shadow-inner"
                        >
                            {fissionLogs.length ? (
                                <div className="space-y-2">
                                    {fissionLogs.map((event, index) => (
                                        <div
                                            key={`${event.received_at}-${index}`}
                                            className="grid min-w-0 gap-1 border-l border-zinc-800 pl-3 sm:grid-cols-[5.75rem_minmax(0,1fr)]"
                                        >
                                            <div className="whitespace-nowrap text-zinc-500">
                                                [{event.received_at}]
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    <span
                                                        className={fissionEventTerminalTone(event)}
                                                    >
                                                        {fissionEventTerminalCode(event.type)}
                                                    </span>
                                                    <span className="text-zinc-100">
                                                        {fissionEventTitle(event.type, t)}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`break-all ${
                                                        event.type === "error"
                                                            ? "text-red-200"
                                                            : "text-zinc-400"
                                                    }`}
                                                >
                                                    {fissionEventDetail(event, t)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-20 items-center gap-2 text-zinc-500">
                                    <span className="text-emerald-400">&gt;</span>
                                    <span>{t("NoResults")}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <div className="text-sm font-medium">
                            {t("BestIP.AutomationHistoryLog")}
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("BestIP.LogTime")}</TableHead>
                                    <TableHead>{t("BestIP.LogAction")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                    <TableHead>{t("BestIP.LogRecords")}</TableHead>
                                    <TableHead>{t("BestIP.LogDNS")}</TableHead>
                                    <TableHead>{t("Error")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {automationHistories?.length ? (
                                    automationHistories.map((history, index) => (
                                        <TableRow key={history.id ?? index}>
                                            <TableCell>
                                                {logTimeText(
                                                    history.finished_at ?? history.started_at,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {historyActionText(history.action, t)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        history.success
                                                            ? "secondary"
                                                            : "destructive"
                                                    }
                                                >
                                                    {historyStatusText(history.success, t)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {historyRecordsText(history)}
                                            </TableCell>
                                            <TableCell>
                                                {historyDNSStatusText(history.dns_results, t)}
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">
                                                {history.error || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-20 text-center">
                                            {t("NoResults")}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card className="mt-4 rounded-md shadow-none">
                <CardHeader>
                    <CardTitle className="text-lg">{t("BestIP.Candidates")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>IP</TableHead>
                                <TableHead>{t("Type")}</TableHead>
                                <TableHead>{t("BestIP.Latency")}</TableHead>
                                <TableHead>{t("BestIP.P95Latency")}</TableHead>
                                <TableHead>{t("BestIP.SuccessRate")}</TableHead>
                                <TableHead>{t("BestIP.DownloadSpeed")}</TableHead>
                                <TableHead>{t("BestIP.Score")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {candidateRows.length > 0 ? (
                                candidateRows.map((candidate) => (
                                    <TableRow key={candidate.ip}>
                                        <TableCell className="font-mono text-xs">
                                            {candidate.ip}
                                        </TableCell>
                                        <TableCell>{candidateType(candidate)}</TableCell>
                                        <TableCell>
                                            {formatLatency(candidate.avg_latency_ms)}
                                        </TableCell>
                                        <TableCell>
                                            {formatLatency(candidate.p95_latency_ms ?? 0)}
                                        </TableCell>
                                        <TableCell>
                                            {formatSuccessRate(candidate.success_rate)}
                                        </TableCell>
                                        <TableCell>
                                            {formatDownloadSpeed(candidate.download_mbps)}
                                        </TableCell>
                                        <TableCell>{formatScore(candidate.score)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {dnsResults.length > 0 && (
                <Card className="mt-4 rounded-md shadow-none">
                    <CardHeader>
                        <CardTitle className="text-lg">{t("Result")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>{t("Provider")}</TableHead>
                                    <TableHead>{t("Domains")}</TableHead>
                                    <TableHead>{t("Status")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dnsResults.map((result) => (
                                    <TableRow key={result.profile_id}>
                                        <TableCell>{result.profile_id}</TableCell>
                                        <TableCell>{result.provider}</TableCell>
                                        <TableCell>{result.domains.join(", ")}</TableCell>
                                        <TableCell>
                                            {result.success ? t("BestIP.DNSSuccess") : result.error}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function NumberField({
    id,
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    id: string
    label: string
    value: number
    min: number
    max: number
    step?: number | string
    onChange: (value: number) => void
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}
