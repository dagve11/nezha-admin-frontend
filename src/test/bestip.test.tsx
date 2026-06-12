import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("sonner", () => ({
    toast: vi.fn(),
}))

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: { type: "3rdParty", init: () => undefined },
}))

const runBestIPFission = vi.fn()
const runBestIPFissionStream = vi.fn()
const writeBestIPDNS = vi.fn()
const saveBestIPAutomation = vi.fn()
const runBestIPAutomation = vi.fn()
const rollbackBestIPAutomation = vi.fn()
const notifyBestIPResult = vi.fn()
const swrMockState = vi.hoisted(() => {
    const makeAutomation = () => ({
        id: 1,
        enabled: false,
        scheduler: "0 */30 * * * *",
        auto_write_dns: true,
        push_successful: true,
        push_failed: true,
        notification_group_id: 9,
        write_top_n: 1,
        ddns_profiles: [7],
        domains: ["cdn.example.com"],
        fission: {
            seed_ips: ["1.1.1.1"],
            rounds: 2,
            concurrency: 10,
            timeout_ms: 3000,
            max_domains: 200,
            max_ips_per_round: 200,
            families: ["ipv4"],
            probe_port: 443,
            probe_count: 3,
            result_count: 10,
            http_test_enabled: true,
            http_test_url: "http://speed.cloudflare.com/__down?bytes=20971520",
            http_test_seconds: 3,
            min_download_mbps: 0,
            weight_latency: 0.35,
            weight_success_rate: 0.25,
            weight_download: 0.4,
            staged_scan_enabled: false,
            quick_tcp_count: 80,
            latency_check_count: 40,
        },
        rollback_ipv4_records: ["9.9.9.9"],
    })
    const makeAutomationHistories = () => [
        {
            id: 12,
            action: "rollback",
            started_at: "2026-06-07T09:05:00+08:00",
            finished_at: "2026-06-07T09:05:10+08:00",
            success: false,
            error: "parse error",
            ipv4_records: ["9.9.9.9"],
            dns_results: [
                {
                    profile_id: 7,
                    provider: "dummy",
                    domains: ["cdn.example.com"],
                    success: false,
                    error: "parse error",
                },
            ],
        },
        {
            id: 11,
            action: "run",
            started_at: "2026-06-07T09:00:00+08:00",
            finished_at: "2026-06-07T09:00:20+08:00",
            success: true,
            ipv4_records: ["1.0.0.1"],
            dns_results: [
                {
                    profile_id: 7,
                    provider: "dummy",
                    domains: ["cdn.example.com"],
                    success: true,
                },
            ],
        },
    ]

    return {
        ddnsProfiles: [
            {
                id: 7,
                name: "dummy-ddns",
                provider: "dummy",
                domains: ["cdn.example.com"],
                enable_ipv4: true,
                enable_ipv6: false,
                max_retries: 1,
            },
        ],
        automation: makeAutomation(),
        automationHistories: makeAutomationHistories(),
        makeAutomation,
        makeAutomationHistories,
    }
})
vi.mock("@/api/bestip", () => ({
    runBestIPFission: (...args: unknown[]) => runBestIPFission(...args),
    runBestIPFissionStream: (...args: unknown[]) => runBestIPFissionStream(...args),
    writeBestIPDNS: (...args: unknown[]) => writeBestIPDNS(...args),
    saveBestIPAutomation: (...args: unknown[]) => saveBestIPAutomation(...args),
    runBestIPAutomation: (...args: unknown[]) => runBestIPAutomation(...args),
    rollbackBestIPAutomation: (...args: unknown[]) => rollbackBestIPAutomation(...args),
    notifyBestIPResult: (...args: unknown[]) => notifyBestIPResult(...args),
}))

vi.mock("@/api/api", () => ({
    swrFetcher: vi.fn(),
}))

vi.mock("@/hooks/useNotfication", () => ({
    useNotification: () => ({
        notifierGroup: [
            {
                group: { id: 9, name: "bestip-notify" },
                notifications: [1],
            },
        ],
    }),
}))

vi.mock("swr", () => {
    return {
        default: (key: string) => {
            let data: unknown = swrMockState.automationHistories
            if (key === "/api/v1/ddns") {
                data = swrMockState.ddnsProfiles
            } else if (key === "/api/v1/bestip/automation") {
                data = swrMockState.automation
            } else if (key === "/api/v1/bestip/automation/history") {
                data = swrMockState.automationHistories
            }

            return {
                data,
                mutate: vi.fn(),
                error: undefined,
                isLoading: false,
            }
        },
    }
})

beforeEach(() => {
    swrMockState.ddnsProfiles = [
        {
            id: 7,
            name: "dummy-ddns",
            provider: "dummy",
            domains: ["cdn.example.com"],
            enable_ipv4: true,
            enable_ipv6: false,
            max_retries: 1,
        },
    ]
    swrMockState.automation = swrMockState.makeAutomation()
    swrMockState.automationHistories = swrMockState.makeAutomationHistories()
    runBestIPFission.mockReset()
    runBestIPFissionStream.mockReset()
    writeBestIPDNS.mockReset()
    saveBestIPAutomation.mockReset()
    runBestIPAutomation.mockReset()
    rollbackBestIPAutomation.mockReset()
    notifyBestIPResult.mockReset()
})

test("BestIPPage links to DDNS creation when no DDNS profile exists", async () => {
    swrMockState.ddnsProfiles = []

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    expect(screen.getByText("BestIP.DDNSProfilesEmpty")).toBeTruthy()
    const createLink = screen.getByRole("link", { name: "BestIP.CreateDDNSProfile" })
    expect(createLink.getAttribute("href")).toBe("/dashboard/ddns")
})

function mockFissionWithCandidates() {
    const result = {
        ips: ["1.1.1.1", "1.0.0.1"],
        candidates: [
            {
                family: "ipv4",
                ip: "1.0.0.1",
                attempts: 3,
                successes: 3,
                avg_latency_ms: 10.5,
                success_rate: 1,
                download_mbps: 20,
                score: 0.98,
            },
            {
                family: "ipv4",
                ip: "1.1.1.1",
                attempts: 3,
                successes: 1,
                avg_latency_ms: 200,
                success_rate: 0.33,
                download_mbps: 2,
                score: 0.42,
            },
        ],
        rounds: [
            {
                round: 1,
                new_ips: ["1.0.0.1"],
                new_domains: ["one.example.com"],
                total_ips: 2,
                total_domains: 1,
            },
        ],
    }
    runBestIPFission.mockResolvedValue(result)
    runBestIPFissionStream.mockImplementation(async (_form, onEvent) => {
        onEvent({
            type: "start",
            ips: ["1.1.1.1"],
        })
        onEvent({
            type: "lookup_source_start",
            ip: "1.1.1.1",
            source: "ip138",
        })
        onEvent({
            type: "lookup_source_done",
            ip: "1.1.1.1",
            source: "ip138",
            status_code: 200,
            domains: ["one.example.com"],
            total_domains: 1,
        })
        onEvent({
            type: "ip_lookup_done",
            round: 1,
            ip: "1.1.1.1",
            domains: ["one.example.com"],
        })
        onEvent({
            type: "domain_resolve_done",
            round: 1,
            domain: "one.example.com",
            ips: ["1.0.0.1"],
        })
        onEvent({
            type: "probe_result",
            ip: "1.0.0.1",
            candidate: result.candidates[0],
        })
        onEvent({
            type: "done",
            result,
        })
        return result
    })
}

test("BestIPPage renders probe metrics and writes the top scored IP by default", async () => {
    mockFissionWithCandidates()
    writeBestIPDNS.mockResolvedValue([
        {
            profile_id: 7,
            provider: "dummy",
            domains: ["cdn.example.com"],
            success: true,
        },
    ])

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    expect(screen.getByText("BestIP.Title")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("BestIP.SeedIPs"), {
        target: { value: "1.1.1.1" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))

    await waitFor(() => {
        expect(runBestIPFissionStream).toHaveBeenCalled()
    })
    await waitFor(() => {
        expect(screen.getByText("10.5 ms")).toBeTruthy()
    })
    expect(screen.getByText("BestIP.Latency")).toBeTruthy()
    expect(screen.getByText("BestIP.SuccessRate")).toBeTruthy()
    expect(screen.getByText("BestIP.DownloadSpeed")).toBeTruthy()
    expect(screen.getByText("BestIP.Score")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("20.00 MB/s")).toBeTruthy()
    expect(screen.getByText("0.980")).toBeTruthy()
    expect(runBestIPFission).not.toHaveBeenCalled()
    expect(runBestIPFissionStream).toHaveBeenCalledWith(
        expect.objectContaining({
            seed_ips: ["1.1.1.1"],
            rounds: 2,
        }),
        expect.any(Function),
    )

    fireEvent.click(screen.getByRole("button", { name: "BestIP.WriteDNS" }))

    await waitFor(() => {
        expect(writeBestIPDNS).toHaveBeenCalledWith(
            expect.objectContaining({
                ddns_profiles: [7],
                ipv4_records: ["1.0.0.1"],
            }),
        )
    })
    expect(screen.getByText("BestIP.DNSSuccess")).toBeTruthy()
})

test("BestIPPage writes the top N scored IPv4 records", async () => {
    mockFissionWithCandidates()
    writeBestIPDNS.mockResolvedValue([
        {
            profile_id: 7,
            provider: "dummy",
            domains: ["cdn.example.com"],
            success: true,
        },
    ])

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("1.0.0.1")).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText("BestIP.WriteTopN"), {
        target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.WriteDNS" }))

    await waitFor(() => {
        expect(writeBestIPDNS).toHaveBeenCalledWith(
            expect.objectContaining({
                ipv4_records: ["1.0.0.1", "1.1.1.1"],
            }),
        )
    })
})

test("BestIPPage auto-notifies fission result with the configured notification group", async () => {
    mockFissionWithCandidates()
    notifyBestIPResult.mockResolvedValue({
        success: true,
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.change(screen.getByLabelText("BestIP.WriteTopN"), {
        target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))

    await waitFor(() => {
        expect(notifyBestIPResult).toHaveBeenCalledWith(
            expect.objectContaining({
                notification_group_id: 9,
                ipv4_records: ["1.0.0.1", "1.1.1.1"],
                candidates: expect.arrayContaining([
                    expect.objectContaining({ ip: "1.0.0.1" }),
                    expect.objectContaining({ ip: "1.1.1.1" }),
                ]),
                write_top_n: 2,
            }),
        )
    })
})

test("BestIPPage writes only candidate IPs and caps DNS write count at ten", async () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
        family: "ipv4",
        ip: `203.0.113.${index + 1}`,
        attempts: 3,
        successes: 3,
        avg_latency_ms: 10 + index,
        success_rate: 1,
        download_mbps: 20 - index,
        score: 1 - index / 100,
    }))
    const result = {
        ips: candidates.map((candidate) => candidate.ip),
        candidates,
        rounds: [],
    }
    runBestIPFissionStream.mockImplementation(async (_form, onEvent) => {
        onEvent({
            type: "done",
            result,
        })
        return result
    })
    writeBestIPDNS.mockResolvedValue([
        {
            profile_id: 7,
            provider: "dummy",
            domains: ["cdn.example.com"],
            success: true,
        },
    ])

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    expect(screen.getAllByLabelText("IPv4")).toHaveLength(1)
    expect(screen.getAllByLabelText("IPv6")).toHaveLength(1)
    expect(screen.getByLabelText("BestIP.WriteTopN").getAttribute("max")).toBe("10")

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("203.0.113.10")).toBeTruthy()
    })
    expect(screen.queryByText("203.0.113.11")).toBeNull()

    fireEvent.change(screen.getByLabelText("BestIP.WriteTopN"), {
        target: { value: "12" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.WriteDNS" }))

    await waitFor(() => {
        expect(writeBestIPDNS).toHaveBeenCalledWith(
            expect.objectContaining({
                ipv4_records: candidates.slice(0, 10).map((candidate) => candidate.ip),
            }),
        )
    })
    expect(writeBestIPDNS.mock.calls[0][0].ipv4_records).toHaveLength(10)
})

test("BestIPPage treats DNS write count as total top candidates across IP families", async () => {
    const candidates = [
        {
            family: "ipv4",
            ip: "203.0.113.1",
            attempts: 3,
            successes: 3,
            avg_latency_ms: 10,
            success_rate: 1,
            download_mbps: 20,
            score: 0.99,
        },
        {
            family: "ipv6",
            ip: "2001:db8::1",
            attempts: 3,
            successes: 3,
            avg_latency_ms: 11,
            success_rate: 1,
            download_mbps: 19,
            score: 0.98,
        },
        {
            family: "ipv4",
            ip: "203.0.113.2",
            attempts: 3,
            successes: 3,
            avg_latency_ms: 12,
            success_rate: 1,
            download_mbps: 18,
            score: 0.97,
        },
        {
            family: "ipv6",
            ip: "2001:db8::2",
            attempts: 3,
            successes: 3,
            avg_latency_ms: 13,
            success_rate: 1,
            download_mbps: 17,
            score: 0.96,
        },
    ]
    const result = {
        ips: candidates.map((candidate) => candidate.ip),
        candidates,
        rounds: [],
    }
    runBestIPFissionStream.mockImplementation(async (_form, onEvent) => {
        onEvent({
            type: "done",
            result,
        })
        return result
    })
    writeBestIPDNS.mockResolvedValue([
        {
            profile_id: 7,
            provider: "dummy",
            domains: ["cdn.example.com"],
            success: true,
        },
    ])

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("2001:db8::2")).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText("BestIP.WriteTopN"), {
        target: { value: "3" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.WriteDNS" }))

    await waitFor(() => {
        expect(writeBestIPDNS).toHaveBeenCalledWith(
            expect.objectContaining({
                ipv4_records: ["203.0.113.1", "203.0.113.2"],
                ipv6_records: ["2001:db8::1"],
            }),
        )
    })
    expect([
        ...writeBestIPDNS.mock.calls[0][0].ipv4_records,
        ...writeBestIPDNS.mock.calls[0][0].ipv6_records,
    ]).toHaveLength(3)
})

test("BestIPPage keeps only the first ten candidate IPs", async () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
        family: "ipv4",
        ip: `203.0.113.${index + 1}`,
        attempts: 3,
        successes: 3,
        avg_latency_ms: 10 + index,
        success_rate: 1,
        download_mbps: 20 - index,
        score: 1 - index / 100,
    }))
    const result = {
        ips: candidates.map((candidate) => candidate.ip),
        candidates,
        rounds: [],
    }
    runBestIPFissionStream.mockImplementation(async (_form, onEvent) => {
        onEvent({
            type: "done",
            result,
        })
        return result
    })
    notifyBestIPResult.mockResolvedValue({
        success: true,
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("203.0.113.10")).toBeTruthy()
    })
    expect(screen.queryByText("203.0.113.11")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "BestIP.NotifyResult" }))
    await waitFor(() => {
        expect(notifyBestIPResult).toHaveBeenCalledWith(
            expect.objectContaining({
                candidates: expect.arrayContaining([
                    expect.objectContaining({ ip: "203.0.113.10" }),
                ]),
            }),
        )
    })
    expect(notifyBestIPResult.mock.calls[0][0].candidates).toHaveLength(10)
    expect(notifyBestIPResult.mock.calls[0][0].candidates).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ ip: "203.0.113.11" })]),
    )
})

test("BestIP DNS writeback defaults to Cloudflare profiles when no config is saved", async () => {
    const { defaultBestIPDDNSProfileIDs } = await import("@/routes/bestip")

    expect(
        defaultBestIPDDNSProfileIDs([
            {
                id: 7,
                provider: "dummy",
            },
            {
                id: 8,
                provider: "cloudflare",
            },
        ]),
    ).toEqual([8])
})

test("BestIPPage exposes separate save buttons for fission and DNS settings", async () => {
    saveBestIPAutomation.mockResolvedValue({
        id: 1,
        enabled: false,
        scheduler: "0 */30 * * * *",
        auto_write_dns: true,
        write_top_n: 2,
        ddns_profiles: [7],
        domains: ["cdn.example.com"],
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.change(screen.getByLabelText("BestIP.SeedIPs"), {
        target: { value: "1.1.1.1\n1.0.0.1" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.OverrideDomains"), {
        target: { value: "other.example.com" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.WriteTopN"), {
        target: { value: "2" },
    })
    expect(screen.queryByRole("button", { name: "BestIP.SaveConfig" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "BestIP.SaveFissionConfig" }))
    await waitFor(() => {
        expect(saveBestIPAutomation).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: false,
                scheduler: "0 */30 * * * *",
                auto_write_dns: true,
                write_top_n: 1,
                ddns_profiles: [7],
                domains: ["cdn.example.com"],
                fission: expect.objectContaining({
                    seed_ips: ["1.1.1.1", "1.0.0.1"],
                    rounds: 2,
                }),
            }),
        )
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.SaveDNSConfig" }))
    await waitFor(() => {
        expect(saveBestIPAutomation).toHaveBeenLastCalledWith(
            expect.objectContaining({
                write_top_n: 2,
                ddns_profiles: [7],
                domains: ["other.example.com"],
                fission: expect.objectContaining({
                    seed_ips: ["1.1.1.1"],
                    rounds: 2,
                }),
            }),
        )
    })
})

test("BestIPPage treats an id zero automation response as unsaved defaults", async () => {
    swrMockState.automation = {
        id: 0,
        enabled: false,
        scheduler: "",
        auto_write_dns: false,
        push_successful: false,
        push_failed: false,
        notification_group_id: 0,
        write_top_n: 1,
        ddns_profiles: [],
        domains: [],
        fission: {
            seed_ips: [],
            rounds: 0,
            concurrency: 0,
            timeout_ms: 0,
            max_domains: 0,
            max_ips_per_round: 0,
            families: [],
            probe_port: 0,
            probe_count: 0,
            result_count: 0,
            http_test_enabled: false,
            http_test_url: "",
            http_test_seconds: 0,
            min_download_mbps: 0,
            weight_latency: 0,
            weight_success_rate: 0,
            weight_download: 0,
            staged_scan_enabled: false,
            quick_tcp_count: 0,
            latency_check_count: 0,
        },
        rollback_ipv4_records: [],
    }
    saveBestIPAutomation.mockResolvedValue(swrMockState.makeAutomation())

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.SaveDNSConfig" }))

    await waitFor(() => {
        expect(saveBestIPAutomation).toHaveBeenCalledWith(
            expect.objectContaining({
                auto_write_dns: true,
                push_successful: true,
                push_failed: true,
                ddns_profiles: [7],
                domains: [],
                fission: expect.objectContaining({
                    seed_ips: ["1.1.1.1", "1.0.0.1"],
                    families: ["ipv4"],
                }),
            }),
        )
    })
})

test("BestIPPage submits probe scoring and staged scan settings", async () => {
    mockFissionWithCandidates()
    saveBestIPAutomation.mockResolvedValue({
        id: 1,
        enabled: false,
        scheduler: "0 */30 * * * *",
        auto_write_dns: true,
        write_top_n: 1,
        ddns_profiles: [7],
        domains: ["cdn.example.com"],
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.change(screen.getByLabelText("BestIP.ProbePort"), {
        target: { value: "8443" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.ProbeCount"), {
        target: { value: "4" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.ResultCount"), {
        target: { value: "12" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.HTTPTestURL"), {
        target: { value: "http://speed.cloudflare.com/__down?bytes=1048576" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.HTTPTestSeconds"), {
        target: { value: "5" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.MinDownloadMBps"), {
        target: { value: "1.5" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.WeightLatency"), {
        target: { value: "0.4" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.WeightSuccessRate"), {
        target: { value: "0.3" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.WeightDownload"), {
        target: { value: "0.3" },
    })
    fireEvent.click(screen.getByRole("checkbox", { name: "BestIP.StagedScanEnabled" }))
    fireEvent.change(screen.getByLabelText("BestIP.QuickTCPCount"), {
        target: { value: "96" },
    })
    fireEvent.change(screen.getByLabelText("BestIP.LatencyCheckCount"), {
        target: { value: "48" },
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(runBestIPFissionStream).toHaveBeenCalledWith(
            expect.objectContaining({
                probe_port: 8443,
                probe_count: 4,
                result_count: 10,
                http_test_enabled: true,
                http_test_url: "http://speed.cloudflare.com/__down?bytes=1048576",
                http_test_seconds: 5,
                min_download_mbps: 1.5,
                weight_latency: 0.4,
                weight_success_rate: 0.3,
                weight_download: 0.3,
                staged_scan_enabled: true,
                quick_tcp_count: 96,
                latency_check_count: 48,
            }),
            expect.any(Function),
        )
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.SaveFissionConfig" }))
    await waitFor(() => {
        expect(saveBestIPAutomation).toHaveBeenCalledWith(
            expect.objectContaining({
                fission: expect.objectContaining({
                    probe_port: 8443,
                    probe_count: 4,
                    result_count: 10,
                    http_test_enabled: true,
                    http_test_seconds: 5,
                    staged_scan_enabled: true,
                    quick_tcp_count: 96,
                    latency_check_count: 48,
                }),
            }),
        )
    })
})

test("BestIPPage saves automation, runs it, and rolls back DNS records", async () => {
    saveBestIPAutomation.mockResolvedValue({
        id: 1,
        enabled: true,
        scheduler: "0 */30 * * * *",
        auto_write_dns: true,
        push_successful: true,
        push_failed: true,
        notification_group_id: 9,
        write_top_n: 1,
        ddns_profiles: [7],
        domains: ["cdn.example.com"],
        rollback_ipv4_records: ["9.9.9.9"],
    })
    runBestIPAutomation.mockResolvedValue({
        action: "run",
        success: true,
        ipv4_records: ["1.0.0.1"],
        rollback_ipv4_records: ["9.9.9.9"],
        candidates: [
            {
                family: "ipv4",
                ip: "1.0.0.1",
                attempts: 3,
                successes: 3,
                avg_latency_ms: 10.5,
                success_rate: 1,
                download_mbps: 20,
                score: 0.98,
            },
        ],
        dns_results: [
            {
                profile_id: 7,
                provider: "dummy",
                domains: ["cdn.example.com"],
                success: true,
            },
        ],
    })
    rollbackBestIPAutomation.mockResolvedValue({
        action: "rollback",
        success: true,
        ipv4_records: ["9.9.9.9"],
        rollback_ipv4_records: ["1.0.0.1"],
        dns_results: [
            {
                profile_id: 7,
                provider: "dummy",
                domains: ["cdn.example.com"],
                success: true,
            },
        ],
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    fireEvent.click(screen.getByRole("checkbox", { name: "BestIP.EnableAutomation" }))
    fireEvent.change(screen.getByLabelText("BestIP.OverrideDomains"), {
        target: { value: "cdn.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.SaveAutomation" }))
    await waitFor(() => {
        expect(saveBestIPAutomation).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                scheduler: "0 */30 * * * *",
                auto_write_dns: true,
                push_successful: true,
                push_failed: true,
                notification_group_id: 9,
                write_top_n: 1,
                ddns_profiles: [7],
                domains: ["cdn.example.com"],
            }),
        )
    })

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunAutomation" }))
    await waitFor(() => {
        expect(runBestIPAutomation).toHaveBeenCalled()
    })
    expect(screen.getAllByText("1.0.0.1").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RollbackDNS" }))
    await waitFor(() => {
        expect(rollbackBestIPAutomation).toHaveBeenCalled()
    })
    expect(screen.getAllByText("9.9.9.9").length).toBeGreaterThan(0)
})

test("BestIPPage sends selected best IP records to notification group", async () => {
    mockFissionWithCandidates()
    notifyBestIPResult.mockResolvedValue({
        success: true,
        ipv4_records: ["1.0.0.1"],
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    expect(screen.getAllByText("bestip-notify").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("checkbox", { name: "BestIP.AutoNotifyFission" }))
    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("1.0.0.1")).toBeTruthy()
    })
    fireEvent.click(screen.getByRole("button", { name: "BestIP.NotifyResult" }))

    await waitFor(() => {
        expect(notifyBestIPResult).toHaveBeenCalledWith(
            expect.objectContaining({
                notification_group_id: 9,
                domains: ["cdn.example.com"],
                ipv4_records: ["1.0.0.1"],
            }),
        )
    })
})

test("BestIPPage renders realtime fission logs and automation histories", async () => {
    mockFissionWithCandidates()

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    expect(screen.getByText("BestIP.RunLogs")).toBeTruthy()
    expect(screen.getByText("BestIP.RealtimeLog")).toBeTruthy()
    expect(screen.getByText("BestIP.ActionRun")).toBeTruthy()
    expect(screen.getByText("BestIP.ActionRollback")).toBeTruthy()
    expect(screen.getByText("BestIP.LogDNSFailed")).toBeTruthy()
    expect(screen.getByText("parse error")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("BestIP.EventIPLookupDone")).toBeTruthy()
    })
    expect(screen.getByText("BestIP.EventLookupSourceStart")).toBeTruthy()
    expect(screen.getByText("BestIP.EventLookupSourceDone")).toBeTruthy()
    expect(screen.getAllByText(/ip138/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/HTTP 状态: 200|BestIP.HTTPStatus: 200/).length).toBeGreaterThan(0)
    expect(screen.getByText("BestIP.EventDomainResolveDone")).toBeTruthy()
    expect(screen.getByText("BestIP.EventProbeResult")).toBeTruthy()
    expect(screen.getByText("BestIP.EventDone")).toBeTruthy()
    expect(screen.getAllByText(/one\.example\.com/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1\.1\.1\.1/).length).toBeGreaterThan(0)
})

test("BestIPPage keeps realtime fission logs scrolled to latest output", async () => {
    mockFissionWithCandidates()
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
        configurable: true,
        get() {
            return 480
        },
    })

    const { default: BestIPPage } = await import("@/routes/bestip")
    await act(async () => {
        render(<BestIPPage />)
    })

    const logStream = screen.getByRole("log", { name: "BestIP.RealtimeLog" })
    logStream.scrollTop = 0

    fireEvent.click(screen.getByRole("button", { name: "BestIP.RunFission" }))
    await waitFor(() => {
        expect(screen.getByText("BestIP.EventDone")).toBeTruthy()
    })
    await waitFor(() => {
        expect(logStream.scrollTop).toBe(480)
    })
})
