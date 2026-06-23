import { ModelProfile, ModelUserPermissions } from "@/types"

export type UserFeature = keyof ModelUserPermissions

export const allUserPermissions: ModelUserPermissions = {
    service: true,
    task: true,
    notification: true,
    ddns: true,
    bestip: true,
    nat: true,
    vpn: true,
    server_group: true,
    server_transfer: true,
}

export const defaultUserPermissions: ModelUserPermissions = {
    service: true,
    task: false,
    notification: true,
    ddns: false,
    bestip: false,
    nat: false,
    vpn: false,
    server_group: true,
    server_transfer: false,
}

export const userPermissionKeys = Object.keys(defaultUserPermissions) as UserFeature[]

export function permissionsForRole(role: number, permissions?: ModelUserPermissions) {
    if (role === 0) return allUserPermissions
    return permissions ?? defaultUserPermissions
}

export function userHasFeature(profile: ModelProfile | undefined, feature: UserFeature) {
    if (!profile) return false
    if (profile.role === 0) return true
    return !!profile.permissions?.[feature]
}

