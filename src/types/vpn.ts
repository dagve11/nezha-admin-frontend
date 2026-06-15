export interface ModelAgentVPNPolicy {
    id: number
    name: string
    entry_server_id: number
    exit_server_id: number
    mode: string
    rule_mode: string
    domains?: string[]
    cidrs?: string[]
    direct_cidrs?: string[]
    listen_http?: string
    listen_socks?: string
    tun_name?: string
    dns_server?: string
    expires_seconds?: number
    max_upload_bytes?: number
    max_download_bytes?: number
    max_connections?: number
    idle_timeout_seconds?: number
    notification_group_id?: number
    auto_restart?: boolean
    set_system_proxy?: boolean
    tun_health_url?: string
    tun_health_timeout_seconds?: number
    egress_probe_url?: string
    core_version?: string
    core_download_url?: string
    core_sha256?: string
}

export interface ModelAgentVPNPolicyForm {
    name: string
    entry_server_id: number
    exit_server_id: number
    mode: string
    rule_mode: string
    domains: string[]
    cidrs: string[]
    direct_cidrs: string[]
    listen_http: string
    listen_socks: string
    tun_name: string
    dns_server: string
    expires_seconds: number
    max_upload_bytes: number
    max_download_bytes: number
    max_connections: number
    idle_timeout_seconds: number
    notification_group_id: number
    auto_restart: boolean
    set_system_proxy: boolean
    tun_health_url: string
    tun_health_timeout_seconds: number
    egress_probe_url: string
    core_version: string
    core_download_url: string
    core_sha256: string
}

export interface ModelAgentVPNSession {
    id: number
    policy_id: number
    entry_server_id: number
    exit_server_id: number
    session_id: string
    mode: string
    rule_mode?: string
    relay_mode?: string
    state: string
    entry_state?: string
    exit_state?: string
    local_http?: string
    local_socks?: string
    tun_name?: string
    set_system_proxy?: boolean
    system_proxy_applied?: boolean
    upload_bytes?: number
    download_bytes?: number
    active_connections?: number
    last_error?: string
    started_at?: string
    expires_at?: string
    stopped_at?: string
}

export interface ModelAgentVPNSessionControlForm {
    mode: string
    rule_mode: string
    set_system_proxy: boolean
}

export interface ModelAgentVPNPolicyStatusCheck {
    policy_id: number
    policy_name: string
    check_id: string
    checked_at: string
    timed_out?: boolean
    nodes: ModelAgentVPNPolicyNodeStatus[]
}

export interface ModelAgentVPNPolicyNodeStatus {
    role: string
    server_id: number
    server_name: string
    online: boolean
    responded: boolean
    state: string
    core_status: string
    core_path?: string
    core_version?: string
    rules_status: string
    rules_path?: string
    rules_version?: string
    last_error?: string
    logs?: string[]
}

export interface ModelVPNControlResult {
    session_id: string
    action: string
    role: string
    state: string
    check_id?: string
    core_version?: string
    core_status?: string
    core_path?: string
    rules_status?: string
    rules_path?: string
    rules_version?: string
    local_http?: string
    local_socks?: string
    tun_name?: string
    system_proxy_applied?: boolean
    upload_bytes?: number
    download_bytes?: number
    active_conns?: number
    last_error?: string
    logs?: string[]
    started_at?: number
    stopped_at?: number
}

export interface ModelAgentVPNDebugResult {
    id: number
    reported_at: string
    reporter_server_id: number
    reporter_server_name?: string
    session_id: string
    action: string
    role: string
    state: string
    last_error?: string
    result: ModelVPNControlResult
}

export interface ModelAgentVPNAuditLog {
    id: number
    session_id?: string
    user_id?: number
    action: string
    entry_server_id?: number
    exit_server_id?: number
    success: boolean
    message?: string
    detail?: Record<string, string>
    created_at?: string
}

export interface ModelVPNSessionStreamFrame {
    session: ModelAgentVPNSession
    logs?: string[]
}
