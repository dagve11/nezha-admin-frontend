// NOTE: Do not modify the import order unless absolutely necessary.
import { createRoot } from "react-dom/client"
import { RouterProvider, createBrowserRouter } from "react-router-dom"

import "./index.css"
import "./lib/i18n"

import { AuthProvider } from "./hooks/useAuth"
import { NotificationProvider } from "./hooks/useNotfication"
import { ServerProvider } from "./hooks/useServer"

import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import Root from "./routes/root"
import ErrorPage from "./error-page"

import ProtectedRoute from "./routes/protect"
import FeatureRoute from "./routes/feature"
import BestIPPage from "./routes/bestip"
import CronPage from "./routes/cron"
import LoginPage from "./routes/login"
import RegisterPage from "./routes/register"
import ServerPage from "./routes/server"
import ServicePage from "./routes/service"
import { TerminalPage } from "./components/terminal"
import DDNSPage from "./routes/ddns"
import NATPage from "./routes/nat"
import NotificationGroupPage from "./routes/notification-group"
import ServerGroupPage from "./routes/server-group"
import AlertRulePage from "./routes/alert-rule"
import NotificationPage from "./routes/notification"
import OnlineUserPage from "./routes/online-user"
import ProfilePage from "./routes/profile"
import SettingsPage from "./routes/settings"
import TransferPage from "./routes/transfer"
import UserPage from "./routes/user"
import VPNPage from "./routes/vpn"
import WAFPage from "./routes/waf"

const router = createBrowserRouter([
    {
        path: "/dashboard/terminal/:id",
        element: (
            <AuthProvider>
                <ProtectedRoute>
                    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                        <TerminalPage />
                        <Toaster />
                    </ThemeProvider>
                </ProtectedRoute>
            </AuthProvider>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: "/dashboard",
        element: (
            <AuthProvider>
                <ProtectedRoute>
                    <Root />
                </ProtectedRoute>
            </AuthProvider>
        ),
        errorElement: <ErrorPage />,
        children: [
            {
                path: "/dashboard/login",
                element: <LoginPage />,
            },
            {
                path: "/dashboard/register",
                element: <RegisterPage />,
            },
            {
                path: "/dashboard",
                element: (
                    <ServerProvider withServerGroup>
                        <ServerPage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/service",
                element: (
                    <FeatureRoute feature="service">
                        <ServerProvider withServer>
                            <NotificationProvider withNotifierGroup>
                                <ServicePage />
                            </NotificationProvider>
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/cron",
                element: (
                    <FeatureRoute feature="task">
                        <ServerProvider withServer>
                            <NotificationProvider withNotifierGroup>
                                <CronPage />
                            </NotificationProvider>
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/alert-rule",
                element: (
                    <FeatureRoute feature="notification">
                        <NotificationProvider withNotifierGroup>
                            <AlertRulePage />
                        </NotificationProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/ddns",
                element: (
                    <FeatureRoute feature="ddns">
                        <DDNSPage />
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/bestip",
                element: (
                    <FeatureRoute feature="bestip">
                        <ServerProvider withServer>
                            <NotificationProvider withNotifierGroup>
                                <BestIPPage />
                            </NotificationProvider>
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/nat",
                element: (
                    <FeatureRoute feature="nat">
                        <ServerProvider withServer>
                            <NATPage />
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/server-group",
                element: (
                    <FeatureRoute feature="server_group">
                        <ServerProvider withServer>
                            <ServerGroupPage />
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/notification-group",
                element: (
                    <FeatureRoute feature="notification">
                        <NotificationProvider withNotifier>
                            <NotificationGroupPage />
                        </NotificationProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/notification",
                element: (
                    <FeatureRoute feature="notification">
                        <NotificationProvider withNotifierGroup>
                            <NotificationPage />
                        </NotificationProvider>
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/profile",
                element: (
                    <ServerProvider withServer withServerGroup>
                        <ProfilePage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/settings",
                element: (
                    <NotificationProvider withNotifierGroup>
                        <SettingsPage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/settings/user",
                element: <UserPage />,
            },
            {
                path: "/dashboard/settings/waf",
                element: <WAFPage />,
            },
            {
                path: "/dashboard/settings/online-user",
                element: <OnlineUserPage />,
            },
            {
                path: "/dashboard/transfer",
                element: (
                    <FeatureRoute feature="server_transfer">
                        <TransferPage />
                    </FeatureRoute>
                ),
            },
            {
                path: "/dashboard/vpn",
                element: (
                    <FeatureRoute feature="vpn">
                        <ServerProvider withServer>
                            <NotificationProvider withNotifierGroup>
                                <VPNPage />
                            </NotificationProvider>
                        </ServerProvider>
                    </FeatureRoute>
                ),
            },
        ],
    },
])

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)
