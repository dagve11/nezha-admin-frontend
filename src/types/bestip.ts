export interface ModelBestIPFissionForm {
    seed_ips: string[]
    rounds: number
    concurrency: number
    timeout_ms: number
    max_domains: number
    max_ips_per_round: number
    families: string[]
}

export interface ModelBestIPFissionRoundResult {
    round: number
    new_ips: string[]
    new_domains: string[]
    total_ips: number
    total_domains: number
}

export interface ModelBestIPCandidateResult {
    family: string
    ip: string
    attempts: number
    successes: number
    avg_latency_ms: number
    success_rate: number
    download_mbps: number
    score: number
}

export interface ModelBestIPFissionResult {
    ips: string[]
    rounds: ModelBestIPFissionRoundResult[]
    candidates: ModelBestIPCandidateResult[]
}

export interface ModelBestIPDNSWriteForm {
    ddns_profiles: number[]
    domains: string[]
    ipv4?: string
    ipv6?: string
    ipv4_records?: string[]
    ipv6_records?: string[]
}

export interface ModelBestIPDNSWriteResult {
    profile_id: number
    provider: string
    domains: string[]
    success: boolean
    error?: string
}
