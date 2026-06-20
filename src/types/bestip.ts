export interface ModelBestIPFissionForm {
    seed_ips: string[]
    rounds: number
    concurrency: number
    timeout_ms: number
    max_domains: number
    max_ips_per_round: number
    families: string[]
    probe_port?: number
    probe_count?: number
    result_count?: number
    http_test_enabled?: boolean
    http_test_url?: string
    http_test_seconds?: number
    min_download_mbps?: number
    weight_latency?: number
    weight_success_rate?: number
    weight_download?: number
    staged_scan_enabled?: boolean
    quick_tcp_count?: number
    latency_check_count?: number
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
    p95_latency_ms?: number
    success_rate: number
    download_mbps: number
    score: number
    timeout_count?: number
    refused_count?: number
    other_errors?: number
}

export interface ModelBestIPFissionResult {
    ips: string[]
    rounds: ModelBestIPFissionRoundResult[]
    candidates: ModelBestIPCandidateResult[]
}

export type ModelBestIPFissionProgressType =
    | "start"
    | "round_start"
    | "ip_lookup_start"
    | "lookup_source_start"
    | "lookup_source_done"
    | "ip_lookup_done"
    | "domain_resolve_start"
    | "domain_resolve_done"
    | "round_done"
    | "cloudflare_validation_start"
    | "cloudflare_validation_done"
    | "probe_start"
    | "probe_stage_start"
    | "probe_stage_done"
    | "probe_result"
    | "probe_done"
    | "done"
    | "error"

export interface ModelBestIPFissionProgressEvent {
    type: ModelBestIPFissionProgressType
    round?: number
    ip?: string
    domain?: string
    source?: string
    status_code?: number
    ips?: string[]
    domains?: string[]
    new_ips?: string[]
    new_domains?: string[]
    filtered_ips?: string[]
    total_ips?: number
    total_domains?: number
    probe_port?: number
    probe_count?: number
    stage?: string
    workers?: number
    done?: number
    cloudflare_ipv4_ranges?: number
    cloudflare_ipv6_ranges?: number
    cloudflare_hit_rate?: number
    candidate?: ModelBestIPCandidateResult
    probe_stats?: {
        total_probes?: number
        success_count?: number
        timeout_count?: number
        refused_count?: number
        other_error_count?: number
        tcp_dial_attempts?: number
        quick_stage_count?: number
        full_stage_count?: number
        staged_scan?: boolean
        http_test_count?: number
        http_success_count?: number
        http_fail_count?: number
    }
    result?: ModelBestIPFissionResult
    round_result?: ModelBestIPFissionRoundResult
    error?: string
}

export interface ModelBestIPDNSWriteForm {
    ddns_profiles?: number[]
    ddns_credentials?: number[]
    domains: string[]
    ipv4?: string
    ipv6?: string
    ipv4_records?: string[]
    ipv6_records?: string[]
}

export interface ModelBestIPDNSWriteResult {
    profile_id?: number
    credential_id?: number
    provider: string
    domains: string[]
    success: boolean
    error?: string
}

export interface ModelBestIPNotifyForm {
    notification_group_id: number
    domains?: string[]
    ipv4?: string
    ipv6?: string
    ipv4_records?: string[]
    ipv6_records?: string[]
    candidates?: ModelBestIPCandidateResult[]
    write_top_n?: number
}

export interface ModelBestIPNotifyResult {
    success: boolean
    ipv4_records?: string[]
    ipv6_records?: string[]
}

export interface ModelBestIPAutomationForm {
    enabled: boolean
    scheduler: string
    auto_write_dns: boolean
    push_successful: boolean
    push_failed: boolean
    fission_notification_group_id: number
    notification_group_id: number
    write_top_n: number
    ddns_profiles?: number[]
    ddns_credentials?: number[]
    domains: string[]
    fission: ModelBestIPFissionForm
}

export interface ModelBestIPAutomation extends ModelBestIPAutomationForm {
    id: number
    last_ipv4_records?: string[]
    last_ipv6_records?: string[]
    rollback_ipv4_records?: string[]
    rollback_ipv6_records?: string[]
    last_candidates?: ModelBestIPCandidateResult[]
    last_dns_results?: ModelBestIPDNSWriteResult[]
    last_run_at?: string
    last_result?: boolean
    last_error?: string
    cron_job_id?: number
}

export interface ModelBestIPAutomationHistory {
    id?: number
    automation_id?: number
    action: "run" | "rollback"
    started_at?: string
    finished_at?: string
    success: boolean
    error?: string
    ipv4_records?: string[]
    ipv6_records?: string[]
    rollback_ipv4_records?: string[]
    rollback_ipv6_records?: string[]
    candidates?: ModelBestIPCandidateResult[]
    dns_results?: ModelBestIPDNSWriteResult[]
}
