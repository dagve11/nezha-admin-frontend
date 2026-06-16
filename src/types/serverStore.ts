import { ModelServerGroupResponseItem } from "@/types"

export interface ServerIdentifierHostType {
    arch?: string
    platform?: string
    vpn_enabled?: boolean
    vpn_allow_system_proxy?: boolean
    vpn_allow_tun?: boolean
    vpn_core_version?: string
    vpn_last_error?: string
}

export interface ServerIdentifierType {
    id: number
    name: string
    host?: ServerIdentifierHostType
    last_active?: string
    online?: boolean
}

export interface ServerStore {
    server?: ServerIdentifierType[]
    serverGroup?: ModelServerGroupResponseItem[]
    setServer: (server?: ServerIdentifierType[]) => void
    setServerGroup: (serverGroup?: ModelServerGroupResponseItem[]) => void
}
