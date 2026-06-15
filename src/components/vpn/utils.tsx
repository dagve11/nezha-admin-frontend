import { ModelAgentVPNPolicy, ModelAgentVPNPolicyForm } from "@/types"

export const VPN_EXPIRES_SECONDS_PER_DAY = 24 * 60 * 60
export const DEFAULT_VPN_EXPIRES_SECONDS = VPN_EXPIRES_SECONDS_PER_DAY

export function validatePolicyFormClient(form: ModelAgentVPNPolicyForm): string | null {
    if (form.entry_server_id === 0 || form.exit_server_id === 0)
        return "VPN.ValidationServerRequired"
    if (form.entry_server_id === form.exit_server_id) return "VPN.ValidationSameServer"
    if (form.mode === "system_proxy" && !form.listen_http && !form.listen_socks) {
        return "VPN.ValidationProxyListenRequired"
    }
    if (!validateListenAddress(form.listen_http) || !validateListenAddress(form.listen_socks)) {
        return "VPN.ValidationListenInvalid"
    }
    if (!isLoopbackListenAddress(form.listen_http) || !isLoopbackListenAddress(form.listen_socks)) {
        return "VPN.ValidationLoopbackListen"
    }
    if (form.rule_mode === "domain" && !form.domains.every(isValidDomain)) {
        return "VPN.ValidationDomainInvalid"
    }
    if (form.rule_mode === "ip" && !form.cidrs.every(isValidCIDR)) {
        return "VPN.ValidationCIDRInvalid"
    }
    if (!form.direct_cidrs.every(isValidCIDR)) {
        return "VPN.ValidationCIDRInvalid"
    }
    if (
        !isValidHTTPURL(form.core_download_url) ||
        !isValidHTTPURL(form.egress_probe_url) ||
        !isValidHTTPURL(form.tun_health_url)
    ) {
        return "VPN.ValidationHTTPURLInvalid"
    }
    if (!isValidSHA256(form.core_sha256)) {
        return "VPN.ValidationSHA256Invalid"
    }
    if (
        form.exit_nat_enabled &&
        (!isValidNATHost(form.exit_nat_host) ||
            !Number.isInteger(form.exit_nat_port) ||
            form.exit_nat_port <= 0 ||
            form.exit_nat_port > 65535)
    ) {
        return "VPN.ValidationExitNATInvalid"
    }
    if (form.expires_seconds <= 0) return "VPN.ValidationExpiresRequired"
    return null
}

export function normalizePolicyForm(form: ModelAgentVPNPolicyForm): ModelAgentVPNPolicyForm {
    return {
        ...form,
        name: form.name.trim() || "Agent VPN",
        relay_mode: form.relay_mode || "auto",
        exit_nat_host: form.exit_nat_host.trim(),
        exit_nat_port: form.exit_nat_enabled ? Math.max(Number(form.exit_nat_port) || 0, 0) : 0,
        domains: form.domains.filter(Boolean),
        cidrs: form.cidrs.filter(Boolean),
        direct_cidrs: form.direct_cidrs.filter(Boolean),
        dns_server: form.dns_server.trim(),
        idle_timeout_seconds: Math.max(form.idle_timeout_seconds || 0, 0),
        tun_health_url: form.tun_health_url.trim(),
        tun_health_timeout_seconds: Math.min(
            Math.max(form.tun_health_timeout_seconds || 10, 1),
            60,
        ),
        egress_probe_url: form.egress_probe_url.trim(),
        core_version: form.core_version.trim(),
        core_download_url: form.core_download_url.trim(),
        core_sha256: form.core_sha256.trim(),
    }
}

export function policyToForm(policy: ModelAgentVPNPolicy): ModelAgentVPNPolicyForm {
    return {
        name: policy.name,
        entry_server_id: policy.entry_server_id,
        exit_server_id: policy.exit_server_id,
        mode: policy.mode,
        rule_mode: policy.rule_mode,
        relay_mode: policy.relay_mode ?? "auto",
        exit_nat_enabled: policy.exit_nat_enabled ?? false,
        exit_nat_host: policy.exit_nat_host ?? "",
        exit_nat_port: policy.exit_nat_port ?? 0,
        domains: policy.domains ?? [],
        cidrs: policy.cidrs ?? [],
        direct_cidrs: policy.direct_cidrs ?? [],
        listen_http: policy.listen_http ?? "",
        listen_socks: policy.listen_socks ?? "",
        tun_name: policy.tun_name ?? "nezha-vpn",
        dns_server: policy.dns_server ?? "https://1.1.1.1/dns-query",
        expires_seconds: policy.expires_seconds ?? DEFAULT_VPN_EXPIRES_SECONDS,
        max_upload_bytes: policy.max_upload_bytes ?? 0,
        max_download_bytes: policy.max_download_bytes ?? 0,
        max_connections: policy.max_connections ?? 128,
        idle_timeout_seconds: policy.idle_timeout_seconds ?? 0,
        notification_group_id: policy.notification_group_id ?? 0,
        auto_restart: policy.auto_restart ?? true,
        set_system_proxy: policy.set_system_proxy ?? false,
        tun_health_url: policy.tun_health_url ?? "",
        tun_health_timeout_seconds: policy.tun_health_timeout_seconds ?? 10,
        egress_probe_url: policy.egress_probe_url ?? "",
        core_version: policy.core_version ?? "",
        core_download_url: policy.core_download_url ?? "",
        core_sha256: policy.core_sha256 ?? "",
    }
}

function validateListenAddress(value: string): boolean {
    if (!value) return true
    const parsed = parseListenAddress(value)
    return parsed !== null && parsed.port > 0 && parsed.port <= 65535
}

function isLoopbackListenAddress(value: string): boolean {
    if (!value) return true
    const parsed = parseListenAddress(value)
    return parsed !== null && isLoopbackHost(parsed.host)
}

function parseListenAddress(value: string): { host: string; port: number } | null {
    const match = value.match(/^\[([^\]]+)]:(\d+)$/) ?? value.match(/^([^:]+):(\d+)$/)
    if (!match) return null
    return {
        host: match[1],
        port: Number(match[2]),
    }
}

function isLoopbackHost(host: string): boolean {
    return host === "localhost" || host === "127.0.0.1" || host === "::1"
}

function isValidNATHost(value: string): boolean {
    const host = value.trim()
    if (!host) return false
    if (host.includes("://") || /[\s/?#@]/.test(host)) return false
    if (/^[^:[\]]+:\d+$/.test(host)) return false
    const unwrapped = host.replace(/^\[|\]$/g, "")
    if (unwrapped.includes(":")) return isIPv6Address(unwrapped)
    return isValidDomain(unwrapped) || isIPv4Address(unwrapped)
}

function isValidCIDR(value: string): boolean {
    if (!value) return false
    const [ip, prefix] = value.split("/")
    if (!ip || !prefix || !/^\d+$/.test(prefix)) return false
    const prefixNumber = Number(prefix)
    if (isIPv4Address(ip)) return prefixNumber >= 0 && prefixNumber <= 32
    if (isIPv6Address(ip)) return prefixNumber >= 0 && prefixNumber <= 128
    return false
}

function isIPv4Address(value: string): boolean {
    const parts = value.split(".")
    return (
        parts.length === 4 &&
        parts.every((part) => {
            if (!/^\d+$/.test(part)) return false
            const number = Number(part)
            return number >= 0 && number <= 255 && String(number) === String(Number(part))
        })
    )
}

function isIPv6Address(value: string): boolean {
    return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value)
}

function isValidHTTPURL(value: string): boolean {
    if (!value) return true
    try {
        const parsed = new URL(value)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
        return false
    }
}

function isValidSHA256(value: string): boolean {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^[0-9a-fA-F]{64}$/.test(trimmed)
}

function isValidDomain(value: string): boolean {
    if (!value || value.trim() !== value || value.length > 253) return false
    return value
        .split(".")
        .every(
            (label) =>
                label.length > 0 &&
                label.length <= 63 &&
                !label.startsWith("-") &&
                !label.endsWith("-") &&
                /^[A-Za-z0-9-]+$/.test(label),
        )
}

export async function copyTextToClipboard(value: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return
    }
    const textarea = document.createElement("textarea")
    textarea.value = value
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    textarea.style.top = "0"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
        if (!document.execCommand("copy")) {
            throw new Error("copy command failed")
        }
    } finally {
        document.body.removeChild(textarea)
    }
}
