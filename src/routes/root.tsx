import Header from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import useSetting from "@/hooks/useSetting"
import i18n from "@/lib/i18n"
import { InjectContext } from "@/lib/inject"
import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"

export default function Root() {
    const { data: settingData, error } = useSetting()
    const [injectedCustomCode, setInjectedCustomCode] = useState<string | null>(null)

    useEffect(() => {
        document.title = settingData?.config?.site_name || "哪吒监控 Nezha Monitoring"
    }, [settingData?.config?.site_name])

    useEffect(() => {
        if (settingData?.config?.custom_code_dashboard) {
            InjectContext(settingData?.config?.custom_code_dashboard)
            queueMicrotask(() => {
                setInjectedCustomCode(settingData.config.custom_code_dashboard)
            })
        } else {
            queueMicrotask(() => {
                setInjectedCustomCode(null)
            })
        }
    }, [settingData?.config?.custom_code_dashboard])

    useEffect(() => {
        if (settingData?.config?.language && !localStorage.getItem("language")) {
            i18n.changeLanguage(settingData?.config?.language)
        }
    }, [settingData?.config?.language])

    if (error) {
        throw error
    }

    if (!settingData) {
        return null
    }

    if (
        settingData?.config?.custom_code_dashboard &&
        injectedCustomCode !== settingData.config.custom_code_dashboard
    ) {
        return null
    }

    const siteName = settingData.config.site_name || "哪吒监控 Nezha Monitoring"
    const currentYear = new Date().getFullYear()

    return (
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <section className="text-sm mx-auto h-full flex flex-col justify-between">
                <div>
                    <Header />
                    <div className="max-w-5xl mx-auto">
                        <Outlet />
                    </div>
                </div>
                <footer className="mx-5 py-5 text-foreground/50 font-light text-xs text-center">
                    &copy; {currentYear} {siteName} {settingData.version}
                </footer>
            </section>
            <Toaster />
        </ThemeProvider>
    )
}
