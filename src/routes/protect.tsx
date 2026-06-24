import { useAuth } from "@/hooks/useAuth"
import { Navigate } from "react-router-dom"

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { profile } = useAuth()

    const publicPaths = ["/dashboard/login", "/dashboard/register"]

    if (!profile && !publicPaths.includes(window.location.pathname)) {
        return (
            <>
                <Navigate to="/dashboard/login" />
                {children}
            </>
        )
    }

    return children
}

export default ProtectedRoute
