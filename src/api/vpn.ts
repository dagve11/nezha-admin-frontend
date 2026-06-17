import {
    ModelAgentVPNAuditLog,
    ModelAgentVPNDebugResult,
    ModelAgentVPNPolicy,
    ModelAgentVPNPolicyForm,
    ModelAgentVPNPolicyStatusCheck,
    ModelAgentVPNSession,
    ModelAgentVPNSessionControlForm,
} from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const createVPNPolicy = async (data: ModelAgentVPNPolicyForm): Promise<number> => {
    return fetcher<number>(FetcherMethod.POST, "/api/v1/vpn/policy", data)
}

export const updateVPNPolicy = async (id: number, data: ModelAgentVPNPolicyForm): Promise<void> => {
    return fetcher<void>(FetcherMethod.PATCH, `/api/v1/vpn/policy/${id}`, data)
}

export const deleteVPNPolicy = async (ids: number[]): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/batch-delete/vpn/policy", ids)
}

export const prepareVPNPolicyCore = async (id: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/vpn/policy/${id}/core/prepare`)
}

export const cleanupVPNPolicyCore = async (id: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/vpn/policy/${id}/core/cleanup`)
}

export const prepareVPNPolicyRules = async (id: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/vpn/policy/${id}/rules/prepare`)
}

export const cleanupVPNPolicyRules = async (id: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, `/api/v1/vpn/policy/${id}/rules/cleanup`)
}

export const checkVPNPolicyStatus = async (id: number): Promise<ModelAgentVPNPolicyStatusCheck> => {
    return fetcher<ModelAgentVPNPolicyStatusCheck>(
        FetcherMethod.POST,
        `/api/v1/vpn/policy/${id}/status`,
    )
}

export const getVPNAgentDebugResults = async (limit = 30): Promise<ModelAgentVPNDebugResult[]> => {
    return fetcher<ModelAgentVPNDebugResult[]>(
        FetcherMethod.GET,
        "/api/v1/vpn/debug/agent-results",
        {
            limit,
        },
    )
}

export const startVPNSession = async (policyID: number): Promise<ModelAgentVPNSession> => {
    return fetcher<ModelAgentVPNSession>(FetcherMethod.POST, "/api/v1/vpn/session/start", {
        policy_id: policyID,
    })
}

const vpnSessionPath = (sessionID: string, action: string) =>
    `/api/v1/vpn/session/${encodeURIComponent(sessionID)}/${action}`

export const stopVPNSession = async (sessionID: string): Promise<ModelAgentVPNSession> => {
    return fetcher<ModelAgentVPNSession>(FetcherMethod.POST, vpnSessionPath(sessionID, "stop"))
}

export const deleteVPNSession = async (sessionID: string): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, vpnSessionPath(sessionID, "delete"))
}

export const restartVPNSession = async (sessionID: string): Promise<ModelAgentVPNSession> => {
    return fetcher<ModelAgentVPNSession>(FetcherMethod.POST, vpnSessionPath(sessionID, "restart"))
}

export const refreshVPNSessionStatus = async (sessionID: string): Promise<ModelAgentVPNSession> => {
    return fetcher<ModelAgentVPNSession>(FetcherMethod.POST, vpnSessionPath(sessionID, "status"))
}

export const controlVPNSession = async (
    sessionID: string,
    data: ModelAgentVPNSessionControlForm,
): Promise<ModelAgentVPNSession> => {
    return fetcher<ModelAgentVPNSession>(
        FetcherMethod.POST,
        vpnSessionPath(sessionID, "control"),
        data,
    )
}

export type {
    ModelAgentVPNDebugResult,
    ModelAgentVPNPolicy,
    ModelAgentVPNPolicyStatusCheck,
    ModelAgentVPNAuditLog,
    ModelAgentVPNSession,
}
