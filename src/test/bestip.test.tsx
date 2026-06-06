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
const writeBestIPDNS = vi.fn()
vi.mock("@/api/bestip", () => ({
    runBestIPFission: (...args: unknown[]) => runBestIPFission(...args),
    writeBestIPDNS: (...args: unknown[]) => writeBestIPDNS(...args),
}))

vi.mock("@/api/api", () => ({
    swrFetcher: vi.fn(),
}))

vi.mock("swr", () => ({
    default: () => ({
        data: [
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
        mutate: vi.fn(),
        error: undefined,
        isLoading: false,
    }),
}))

beforeEach(() => {
    runBestIPFission.mockReset()
    writeBestIPDNS.mockReset()
})

function mockFissionWithCandidates() {
    runBestIPFission.mockResolvedValue({
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
        expect(screen.getByText("1.0.0.1")).toBeTruthy()
    })
    expect(screen.getByText("BestIP.Latency")).toBeTruthy()
    expect(screen.getByText("BestIP.SuccessRate")).toBeTruthy()
    expect(screen.getByText("BestIP.DownloadSpeed")).toBeTruthy()
    expect(screen.getByText("BestIP.Score")).toBeTruthy()
    expect(screen.getByText("10.5 ms")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByText("20.00 MB/s")).toBeTruthy()
    expect(screen.getByText("0.980")).toBeTruthy()
    expect(runBestIPFission).toHaveBeenCalledWith(
        expect.objectContaining({
            seed_ips: ["1.1.1.1"],
            rounds: 2,
        }),
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
