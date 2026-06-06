import { swrFetcher } from "@/api/api"
import { runBestIPFission, writeBestIPDNS } from "@/api/bestip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
    ModelBestIPDNSWriteResult,
    ModelBestIPCandidateResult,
    ModelBestIPFissionResult,
    ModelDDNSProfile,
} from "@/types"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

const defaultSeedIPs = "1.1.1.1\n1.0.0.1"

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

function candidateRowsFromResult(result?: ModelBestIPFissionResult): ModelBestIPCandidateResult[] {
    if (!result) return []
    if (result.candidates?.length) return result.candidates

    const fromRounds = result.rounds.flatMap((round) => round.new_ips) ?? []
    const source = fromRounds.length > 0 ? fromRounds : result.ips ?? []
    return Array.from(new Set(source)).map(candidateFromIP)
}

function selectWriteRecords(
    candidates: ModelBestIPCandidateResult[],
    family: "ipv4" | "ipv6",
    topN: number,
    selectedIP: string,
): string[] {
    const candidateIPs = candidates
        .filter((candidate) => candidateFamily(candidate) === family)
        .slice(0, Math.max(1, topN))
        .map((candidate) => candidate.ip)
    if (topN > 1 && candidateIPs.length > 0) return candidateIPs

    const selectedIPs = parseList(selectedIP)
    if (selectedIPs.length > 0) return selectedIPs.slice(0, 1)
    return candidateIPs.slice(0, 1)
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

export default function BestIPPage() {
    const { t } = useTranslation()
    const { data: ddnsProfiles } = useSWR<ModelDDNSProfile[]>("/api/v1/ddns", swrFetcher)
    const [seedIPs, setSeedIPs] = useState(defaultSeedIPs)
    const [rounds, setRounds] = useState(2)
    const [concurrency, setConcurrency] = useState(10)
    const [timeoutMS, setTimeoutMS] = useState(3000)
    const [maxDomains, setMaxDomains] = useState(200)
    const [maxIPsPerRound, setMaxIPsPerRound] = useState(200)
    const [enableIPv4, setEnableIPv4] = useState(true)
    const [enableIPv6, setEnableIPv6] = useState(false)
    const [selectedDDNSProfiles, setSelectedDDNSProfiles] = useState<number[]>([])
    const [ddnsSelectionTouched, setDDNSSelectionTouched] = useState(false)
    const [overrideDomains, setOverrideDomains] = useState("")
    const [writeTopN, setWriteTopN] = useState(1)
    const [selectedIPv4, setSelectedIPv4] = useState("")
    const [selectedIPv6, setSelectedIPv6] = useState("")
    const [fissionResult, setFissionResult] = useState<ModelBestIPFissionResult>()
    const [dnsResults, setDNSResults] = useState<ModelBestIPDNSWriteResult[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [isWriting, setIsWriting] = useState(false)

    const effectiveSelectedDDNSProfiles = useMemo(() => {
        if (ddnsSelectionTouched || selectedDDNSProfiles.length > 0) return selectedDDNSProfiles
        return (ddnsProfiles ?? []).map((profile) => profile.id)
    }, [ddnsProfiles, ddnsSelectionTouched, selectedDDNSProfiles])

    const candidateRows = useMemo(() => candidateRowsFromResult(fissionResult), [fissionResult])

    const selectedIPv4Records = useMemo(
        () => selectWriteRecords(candidateRows, "ipv4", writeTopN, selectedIPv4),
        [candidateRows, selectedIPv4, writeTopN],
    )

    const selectedIPv6Records = useMemo(
        () => selectWriteRecords(candidateRows, "ipv6", writeTopN, selectedIPv6),
        [candidateRows, selectedIPv6, writeTopN],
    )

    const runFission = async () => {
        setIsRunning(true)
        setDNSResults([])
        try {
            const result = await runBestIPFission({
                seed_ips: parseList(seedIPs),
                rounds,
                concurrency,
                timeout_ms: timeoutMS,
                max_domains: maxDomains,
                max_ips_per_round: maxIPsPerRound,
                families: [enableIPv4 ? "ipv4" : "", enableIPv6 ? "ipv6" : ""].filter(Boolean),
            })
            setFissionResult(result)
            const rows = candidateRowsFromResult(result)
            setSelectedIPv4(rows.find((candidate) => candidateFamily(candidate) === "ipv4")?.ip ?? "")
            setSelectedIPv6(rows.find((candidate) => candidateFamily(candidate) === "ipv6")?.ip ?? "")
        } catch (error) {
            toast(t("Error"), {
                description: error instanceof Error ? error.message : t("Results.UnExpectedError"),
            })
        } finally {
            setIsRunning(false)
        }
    }

    const writeDNS = async () => {
        setIsWriting(true)
        try {
            const results = await writeBestIPDNS({
                ddns_profiles: effectiveSelectedDDNSProfiles,
                domains: parseList(overrideDomains),
                ipv4: selectedIPv4,
                ipv6: selectedIPv6,
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

    const toggleDDNSProfile = (id: number, checked: boolean) => {
        setDDNSSelectionTouched(true)
        setSelectedDDNSProfiles((current) => {
            const currentSelection = ddnsSelectionTouched ? current : effectiveSelectedDDNSProfiles
            if (checked) return Array.from(new Set([...currentSelection, id]))
            return currentSelection.filter((item) => item !== id)
        })
    }

    return (
        <div className="px-3 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 mt-6 mb-4">
                <h1 className="text-3xl font-bold tracking-tight">{t("BestIP.Title")}</h1>
                <Button onClick={runFission} disabled={isRunning}>
                    {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("BestIP.RunFission")}
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
                <Card className="rounded-md shadow-none">
                    <CardHeader>
                        <CardTitle className="text-lg">{t("BestIP.FissionConfig")}</CardTitle>
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
                                            onCheckedChange={(checked) => setEnableIPv4(checked === true)}
                                        />
                                        IPv4
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={enableIPv6}
                                            onCheckedChange={(checked) => setEnableIPv6(checked === true)}
                                        />
                                        IPv6
                                    </label>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-md shadow-none">
                    <CardHeader>
                        <CardTitle className="text-lg">{t("BestIP.DNSWriteback")}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>{t("BestIP.DDNSProfiles")}</Label>
                            <div className="grid gap-2 rounded-md border p-3">
                                {(ddnsProfiles ?? []).map((profile) => (
                                    <label
                                        key={profile.id}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Checkbox
                                                checked={effectiveSelectedDDNSProfiles.includes(profile.id)}
                                                onCheckedChange={(checked) =>
                                                    toggleDDNSProfile(profile.id, checked === true)
                                                }
                                            />
                                            <span className="truncate">{profile.name}</span>
                                        </span>
                                        <Badge variant="outline">{profile.provider}</Badge>
                                    </label>
                                ))}
                                {!ddnsProfiles?.length && (
                                    <div className="py-2 text-center text-sm text-muted-foreground">
                                        {t("NoResults")}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bestip-domains">{t("BestIP.OverrideDomains")}</Label>
                            <Input
                                id="bestip-domains"
                                value={overrideDomains}
                                onChange={(event) => setOverrideDomains(event.target.value)}
                                placeholder="cdn.example.com"
                            />
                        </div>
                        <NumberField
                            id="bestip-write-top-n"
                            label={t("BestIP.WriteTopN")}
                            value={writeTopN}
                            min={1}
                            max={20}
                            onChange={(value) => setWriteTopN(Math.max(1, value || 1))}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="bestip-selected-ipv4">IPv4</Label>
                                <Input
                                    id="bestip-selected-ipv4"
                                    value={selectedIPv4}
                                    onChange={(event) => setSelectedIPv4(event.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="bestip-selected-ipv6">IPv6</Label>
                                <Input
                                    id="bestip-selected-ipv6"
                                    value={selectedIPv6}
                                    onChange={(event) => setSelectedIPv6(event.target.value)}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={writeDNS}
                            disabled={
                                isWriting ||
                                effectiveSelectedDDNSProfiles.length === 0 ||
                                (selectedIPv4Records.length === 0 && selectedIPv6Records.length === 0)
                            }
                        >
                            {isWriting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("BestIP.WriteDNS")}
                        </Button>
                    </CardContent>
                </Card>
            </div>

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
                                <TableHead>{t("BestIP.SuccessRate")}</TableHead>
                                <TableHead>{t("BestIP.DownloadSpeed")}</TableHead>
                                <TableHead>{t("BestIP.Score")}</TableHead>
                                <TableHead>{t("Actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {candidateRows.length > 0 ? (
                                candidateRows.map((candidate) => (
                                    <TableRow key={candidate.ip}>
                                        <TableCell className="font-mono text-xs">{candidate.ip}</TableCell>
                                        <TableCell>{candidateType(candidate)}</TableCell>
                                        <TableCell>{formatLatency(candidate.avg_latency_ms)}</TableCell>
                                        <TableCell>{formatSuccessRate(candidate.success_rate)}</TableCell>
                                        <TableCell>{formatDownloadSpeed(candidate.download_mbps)}</TableCell>
                                        <TableCell>{formatScore(candidate.score)}</TableCell>
                                        <TableCell>
                                            {candidateFamily(candidate) === "ipv6" ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedIPv6(candidate.ip)}
                                                >
                                                    {t("BestIP.UseAsIPv6")}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedIPv4(candidate.ip)}
                                                >
                                                    {t("BestIP.UseAsIPv4")}
                                                </Button>
                                            )}
                                        </TableCell>
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
    onChange,
}: {
    id: string
    label: string
    value: number
    min: number
    max: number
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
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}
