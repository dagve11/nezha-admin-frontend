export interface ModelAgentVPNPolicy {
    id: number
    name: string
    entry_server_id: number
    exit_server_id: number
    mode: string
    rule_mode: string
    relay_mode?: string
    direct_transport?: string
    direct_host?: string
    direct_port?: number
    direct_tls_server_name?: string
    direct_ws_path?: string
    direct_tls_verify?: boolean
    direct_cert_sha256?: string
    exit_nat_enabled?: boolean
    exit_nat_host?: string
    exit_nat_port?: number
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
    auto_restart_max_attempts?: number
    auto_restart_backoff_seconds?: number[]
    auto_restart_window_seconds?: number
    auto_restart_on_relay_failure?: boolean
    auto_restart_on_exit_failure?: boolean
    auto_restart_on_agent_reconnect?: boolean
    auto_restart_settings_configured?: boolean
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
    relay_mode: string
    direct_transport: string
    direct_host: string
    direct_port: number
    direct_tls_server_name: string
    direct_ws_path: string
    direct_tls_verify: boolean
    direct_cert_sha256: string
    exit_nat_enabled: boolean
    exit_nat_host: string
    exit_nat_port: number
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
    auto_restart_max_attempts: number
    auto_restart_backoff_seconds: number[]
    auto_restart_window_seconds: number
    auto_restart_on_relay_failure: boolean
    auto_restart_on_exit_failure: boolean
    auto_restart_on_agent_reconnect: boolean
    auto_restart_settings_configured: boolean
    set_system_proxy: boolean
    tun_health_url: string
    tun_health_timeout_seconds: number
    egress_probe_url: string
    core_version: string
    core_download_url: string
    core_sha256: string
}

export interface ModelAgentVPNServer {
    id: number
    name: string
    owner?: {
        id: number
        username?: string
    }
    owned: boolean
    shared: boolean
    online: boolean
    vpn_enabled: boolean
    vpn_allow_system_proxy: boolean
    vpn_allow_tun: boolean
    vpn_core_version?: string
    vpn_last_error?: string
    vpn_direct_enabled: boolean
    vpn_direct_listen_port?: number
    vpn_direct_transports?: string[]
    vpn_direct_crypto_version?: string
}

export interface ModelAgentVPNSession {
    id: number
    policy_id: number
    entry_server_id: number
    exit_server_id: number
    session_id: string
    runtime_instance_id?: string
    mode: string
    rule_mode?: string
    relay_mode?: string
    state: string
    entry_state?: string
    exit_state?: string
    runtime_status?: string
    mode_status?: string
    rule_mode_status?: string
    core_status?: string
    core_path?: string
    core_version?: string
    rules_status?: string
    rules_path?: string
    rules_version?: string
    local_http?: string
    local_socks?: string
    tun_name?: string
    set_system_proxy?: boolean
    system_proxy_applied?: boolean
    system_proxy_status?: string
    system_proxy_current?: string
    system_proxy_expected?: string
    tun_status?: string
    tun_interface?: string
    upload_bytes?: number
    download_bytes?: number
    active_connections?: number
    last_error?: string
    recovery_state?: string
    recovery_attempt?: number
    recovery_started_at?: string
    recovery_next_at?: string
    recovery_last_error?: string
    recovery_reason?: string
    started_at?: string
    expires_at?: string
    stopped_at?: string
    diagnostics?: ModelVPNDiagnostic[]
}

export interface ModelVPNDiagnostic {
    code: string
    severity: "critical" | "warning" | "notice" | string
    source?: string
    message?: string
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
    runtime_instance_id?: string
    action: string
    role: string
    state: string
    check_id?: string
    runtime_status?: string
    mode_status?: string
    rule_mode_status?: string
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
    system_proxy_status?: string
    system_proxy_current?: string
    system_proxy_expected?: string
    tun_status?: string
    tun_interface?: string
    upload_bytes?: number
    download_bytes?: number
    active_conns?: number
    failure_reason?: string
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
