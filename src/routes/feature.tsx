import { useAuth } from "@/hooks/useAuth"
import { userHasFeature, UserFeature } from "@/lib/permissions"
import { Navigate } from "react-router-dom"

export default function FeatureRoute({
    children,
    feature,
}: {
    children: React.ReactNode
    feature: UserFeature
}) {
    const { profile } = useAuth()

    if (!profile) return null
    if (!userHasFeature(profile, feature)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

