import {
    ModelBestIPDNSWriteForm,
    ModelBestIPDNSWriteResult,
    ModelBestIPFissionForm,
    ModelBestIPFissionResult,
} from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const runBestIPFission = async (
    data: ModelBestIPFissionForm,
): Promise<ModelBestIPFissionResult> => {
    return fetcher<ModelBestIPFissionResult>(FetcherMethod.POST, "/api/v1/bestip/fission", data)
}

export const writeBestIPDNS = async (
    data: ModelBestIPDNSWriteForm,
): Promise<ModelBestIPDNSWriteResult[]> => {
    return fetcher<ModelBestIPDNSWriteResult[]>(FetcherMethod.POST, "/api/v1/bestip/dns", data)
}
