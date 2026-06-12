import { ModelAgentVPNSession, ServerIdentifierType } from "@/types"
import { useTranslation } from "react-i18next"
import { TopologyDiagramNew } from "./topology-diagram-new"

interface OverviewTabProps {
    servers: ServerIdentifierType[]
    sessions: ModelAgentVPNSession[]
    serverName: (id?: number) => string
}

export function OverviewTab({ servers, sessions, serverName }: OverviewTabProps) {
    const { t } = useTranslation()

    return (
        <TopologyDiagramNew
            servers={servers}
            sessions={sessions}
            serverName={serverName}
            t={t}
        />
    )
}
