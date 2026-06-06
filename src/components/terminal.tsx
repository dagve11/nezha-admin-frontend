import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import useTerminal, { useXtermSession } from "@/hooks/useTerminal"
import { cn } from "@/lib/utils"
import "@xterm/xterm/css/xterm.css"
import { Expand, FolderClosed, Minus, Plus, Terminal as TerminalIcon } from "lucide-react"
import { JSX, forwardRef, useImperativeHandle, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"

import { FMCard } from "./fm"
import { Button } from "./ui/button"
import { IconButton } from "./xui/icon-button"

interface XtermProps {
    wsUrl: string
    setClose: React.Dispatch<React.SetStateAction<boolean>>
    fontSize?: number
}

const TERMINAL_FONT_SIZE_DEFAULT = 16
const TERMINAL_FONT_SIZE_MIN = 12
const TERMINAL_FONT_SIZE_MAX = 24

export const XtermComponent = forwardRef<HTMLDivElement, XtermProps & JSX.IntrinsicElements["div"]>(
    ({ wsUrl, setClose, fontSize = TERMINAL_FONT_SIZE_DEFAULT, className, ...props }, ref) => {
        const terminalIdRef = useRef<HTMLDivElement>(null)

        useImperativeHandle(ref, () => {
            return {
                ...terminalIdRef.current!,
                async requestFullscreen() {
                    await terminalIdRef.current?.requestFullscreen()
                },
            }
        }, [])

        useXtermSession({
            fontSize,
            initialFontSize: TERMINAL_FONT_SIZE_DEFAULT,
            setClose,
            terminalIdRef,
            wsUrl,
        })

        return (
            <div
                ref={terminalIdRef}
                className={cn(
                    "xterm-ime-anchor [&_.xterm-helpers]:!left-0 [&_.xterm-helpers]:!top-0 [&_.xterm-screen]:overflow-hidden",
                    className,
                )}
                {...props}
            />
        )
    },
)

export const TerminalPage = () => {
    const { id } = useParams<{ id: string }>()
    const [open, setOpen] = useState(false)
    const [fontSize, setFontSize] = useState(TERMINAL_FONT_SIZE_DEFAULT)
    const terminal = useTerminal(id ? parseInt(id) : undefined)
    const terminalIdRef = useRef<HTMLDivElement>(null)
    const decreaseFontSize = () => {
        setFontSize((value) => Math.max(TERMINAL_FONT_SIZE_MIN, value - 1))
    }
    const increaseFontSize = () => {
        setFontSize((value) => Math.min(TERMINAL_FONT_SIZE_MAX, value + 1))
    }
    return (
        <main
            data-testid="mac-terminal-page"
            className="h-[100dvh] overflow-hidden bg-[#171717] text-zinc-100"
        >
            <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-8 sm:py-7">
                <section
                    data-testid="mac-terminal-window"
                    className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#050505] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
                >
                    <div className="relative flex h-12 shrink-0 items-center border-b border-white/10 bg-[#2b2b2b] px-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Close window"
                                onClick={() => window.close()}
                                className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                            <button
                                type="button"
                                aria-label="Minimize window"
                                className="h-3 w-3 rounded-full bg-[#febc2e] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                            <button
                                type="button"
                                aria-label="Zoom window"
                                onClick={async () => {
                                    await terminalIdRef.current?.requestFullscreen()
                                }}
                                className="h-3 w-3 rounded-full bg-[#28c840] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]"
                            />
                        </div>

                        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-sm font-medium text-zinc-300">
                            <TerminalIcon className="h-4 w-4 text-zinc-400" />
                            <span>{`Terminal (${id})`}</span>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <div
                                data-testid="terminal-font-size-control"
                                className="flex h-8 items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03]"
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Decrease font size"
                                    aria-label="Decrease terminal font size"
                                    disabled={fontSize <= TERMINAL_FONT_SIZE_MIN}
                                    className="h-8 w-8 rounded-none text-zinc-300 hover:bg-white/10 hover:text-white"
                                    onClick={decreaseFontSize}
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span
                                    data-testid="terminal-font-size"
                                    className="min-w-7 select-none text-center text-[11px] font-medium tabular-nums text-zinc-400"
                                >
                                    {fontSize}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Increase font size"
                                    aria-label="Increase terminal font size"
                                    disabled={fontSize >= TERMINAL_FONT_SIZE_MAX}
                                    className="h-8 w-8 rounded-none text-zinc-300 hover:bg-white/10 hover:text-white"
                                    onClick={increaseFontSize}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Fullscreen"
                                className="h-8 w-8 rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
                                onClick={async () => {
                                    await terminalIdRef.current?.requestFullscreen()
                                }}
                            >
                                <Expand className="h-4 w-4" />
                            </Button>
                            <div className="[&_button]:h-8 [&_button]:w-8 [&_button]:rounded-md [&_button]:bg-transparent [&_button]:text-zinc-300 [&_button]:shadow-none [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
                                <FMCard id={id} />
                            </div>
                        </div>
                    </div>

                    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/5 bg-[#1f1f1f] px-4 text-xs text-zinc-500">
                        <FolderClosed className="h-3.5 w-3.5" />
                        <span className="truncate">agent session / server {id}</span>
                    </div>

                    <div className="min-h-0 flex-1 bg-black p-3">
                        {terminal?.session_id ? (
                            <XtermComponent
                                ref={terminalIdRef}
                                data-testid="terminal-viewport"
                                className="h-full min-h-0 overflow-hidden rounded-sm bg-black"
                                fontSize={fontSize}
                                wsUrl={`/api/v1/ws/terminal/${terminal?.session_id}`}
                                setClose={setOpen}
                            />
                        ) : (
                            <div className="flex h-full min-h-[20rem] items-center justify-center rounded-sm border border-white/10 bg-black px-6 text-center text-sm text-zinc-400">
                                The server does not exist, or have not been connected yet.
                            </div>
                        )}
                    </div>
                </section>
            </div>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent className="sm:max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Session completed</AlertDialogTitle>
                        <AlertDialogDescription>
                            You may close this window now.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction asChild>
                            <Button onClick={window.close}>Close</Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    )
}

export const TerminalButton = ({ id, menuItem = false }: { id: number; menuItem?: boolean }) => {
    const { t } = useTranslation()
    const handleOpenNewTab = () => {
        window.open(`/dashboard/terminal/${id}`, "_blank")
    }

    if (menuItem) {
        return (
            <button
                type="button"
                onClick={handleOpenNewTab}
                className="flex w-full items-center text-sm px-2 py-2 hover:bg-accent hover:text-accent-foreground"
            >
                <TerminalIcon className="h-4 w-4 mr-2" />
                <span>{t("Terminal")}</span>
            </button>
        )
    }

    return <IconButton variant="outline" icon="terminal" onClick={handleOpenNewTab} />
}
