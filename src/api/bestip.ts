import {
    ModelBestIPDNSWriteForm,
    ModelBestIPDNSWriteResult,
    ModelBestIPAutomation,
    ModelBestIPAutomationForm,
    ModelBestIPAutomationHistory,
    ModelBestIPFissionForm,
    ModelBestIPFissionProgressEvent,
    ModelBestIPFissionResult,
    ModelBestIPNotifyForm,
    ModelBestIPNotifyResult,
} from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const runBestIPFission = async (
    data: ModelBestIPFissionForm,
): Promise<ModelBestIPFissionResult> => {
    return fetcher<ModelBestIPFissionResult>(FetcherMethod.POST, "/api/v1/bestip/fission", data)
}

function websocketURL(path: string): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}${path}`
}

export const runBestIPFissionStream = async (
    data: ModelBestIPFissionForm,
    onEvent: (event: ModelBestIPFissionProgressEvent) => void,
): Promise<ModelBestIPFissionResult> => {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(websocketURL("/api/v1/ws/bestip/fission"))
        let settled = false

        const fail = (error: Error) => {
            if (settled) return
            settled = true
            socket.close()
            reject(error)
        }

        socket.onopen = () => {
            socket.send(JSON.stringify(data))
        }
        socket.onmessage = (message) => {
            let event: ModelBestIPFissionProgressEvent
            try {
                event = JSON.parse(String(message.data)) as ModelBestIPFissionProgressEvent
            } catch (error) {
                fail(error instanceof Error ? error : new Error("Invalid Best IP fission event"))
                return
            }

            onEvent(event)
            if (event.type === "done") {
                settled = true
                socket.close()
                resolve(event.result ?? { ips: event.ips ?? [], rounds: [], candidates: [] })
            }
            if (event.type === "error") {
                fail(new Error(event.error || "Best IP fission failed"))
            }
        }
        socket.onerror = () => {
            fail(new Error("Best IP fission WebSocket error"))
        }
        socket.onclose = () => {
            if (!settled) {
                fail(new Error("Best IP fission WebSocket closed"))
            }
        }
    })
}

export const writeBestIPDNS = async (
    data: ModelBestIPDNSWriteForm,
): Promise<ModelBestIPDNSWriteResult[]> => {
    return fetcher<ModelBestIPDNSWriteResult[]>(FetcherMethod.POST, "/api/v1/bestip/dns", data)
}

export const notifyBestIPResult = async (
    data: ModelBestIPNotifyForm,
): Promise<ModelBestIPNotifyResult> => {
    return fetcher<ModelBestIPNotifyResult>(FetcherMethod.POST, "/api/v1/bestip/notify", data)
}

export const saveBestIPAutomation = async (
    data: ModelBestIPAutomationForm,
): Promise<ModelBestIPAutomation> => {
    return fetcher<ModelBestIPAutomation>(FetcherMethod.POST, "/api/v1/bestip/automation", data)
}

export const runBestIPAutomation = async (): Promise<ModelBestIPAutomationHistory> => {
    return fetcher<ModelBestIPAutomationHistory>(FetcherMethod.POST, "/api/v1/bestip/automation/run")
}

export const rollbackBestIPAutomation = async (): Promise<ModelBestIPAutomationHistory> => {
    return fetcher<ModelBestIPAutomationHistory>(
        FetcherMethod.POST,
        "/api/v1/bestip/automation/rollback",
    )
}
