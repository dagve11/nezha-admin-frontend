import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { userHasFeature } from "@/lib/permissions"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

export const GroupTab = ({ className }: { className?: string }) => {
    const { t } = useTranslation()
    const location = useLocation()
    const { profile } = useAuth()
    const canServerGroup = userHasFeature(profile, "server_group")
    const canNotification = userHasFeature(profile, "notification")
    const columnClass = canServerGroup && canNotification ? "grid-cols-2" : "grid-cols-1"

    return (
        <Tabs defaultValue={location.pathname} className={className}>
            <TabsList className={`grid w-full ${columnClass}`}>
                {canServerGroup && (
                    <TabsTrigger value="/dashboard/server-group" asChild>
                        <Link to="/dashboard/server-group">{t("Server")}</Link>
                    </TabsTrigger>
                )}
                {canNotification && (
                    <TabsTrigger value="/dashboard/notification-group" asChild>
                        <Link to="/dashboard/notification-group">{t("Notification")}</Link>
                    </TabsTrigger>
                )}
            </TabsList>
        </Tabs>
    )
}
