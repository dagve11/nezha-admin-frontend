import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Globe2, Minus, Network, Plus, RotateCw, Server, Zap } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface TopologyDiagramProps {
    entry: string
    exit: string
    mode: string
    t: (key: string) => string
}

export function TopologyDiagram({ entry, exit, mode, t }: TopologyDiagramProps) {
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const dragRef = useRef<{
        originX: number
        originY: number
        pointerID: number
        startX: number
        startY: number
    } | null>(null)

    const zoomBy = (delta: number) => {
        setView((current) => ({
            ...current,
            scale: clampNumber(current.scale + delta, 0.5, 2),
        }))
    }

    const resetView = () => setView({ scale: 1, x: 0, y: 0 })

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault()
            event.stopPropagation()

            const rect = viewport.getBoundingClientRect()
            const cursorX = event.clientX - rect.left - rect.width / 2
            const cursorY = event.clientY - rect.top - rect.height / 2
            setView((current) => {
                const nextScale = clampNumber(current.scale - event.deltaY * 0.001, 0.5, 2)
                const ratio = nextScale / current.scale
                return {
                    scale: nextScale,
                    x: cursorX - (cursorX - current.x) * ratio,
                    y: cursorY - (cursorY - current.y) * ratio,
                }
            })
        }

        viewport.addEventListener("wheel", handleWheel, { passive: false })
        return () => viewport.removeEventListener("wheel", handleWheel)
    }, [])


    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        dragRef.current = {
            originX: view.x,
            originY: view.y,
            pointerID: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerID !== event.pointerId) return
        setView((current) => ({
            ...current,
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
        }))
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerID === event.pointerId) {
            dragRef.current = null
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    return (
        <Card className="overflow-hidden border-0 shadow-xl">
            <CardContent className="relative h-[600px] overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-0">
                {/* 动态背景网格 */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(99,102,241,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.3)_1px,transparent_1px)] [background-size:60px_60px]" />
                    <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(99,102,241,0.5)_1px,transparent_1px)] [background-size:20px_20px]" />
                </div>

                {/* 光晕效果 */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
                    <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
                    <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
                </div>

                {/* 信息卡片 */}
                <div className="absolute left-6 top-6 z-20 rounded-xl border border-indigo-500/30 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                            <Network className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-200">
                                {t("VPN.Topology")}
                            </h2>
                            <Badge
                                variant="outline"
                                className="mt-1 border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
                            >
                                {mode}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* 控制按钮 */}
                <div className="absolute right-6 top-6 z-30 flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-md">
                    <Button
                        aria-label={t("VPN.TopologyZoomOut")}
                        className="h-9 w-9 border-0 bg-transparent text-slate-300 hover:bg-indigo-500/20 hover:text-white"
                        size="icon"
                        variant="ghost"
                        onClick={() => zoomBy(-0.2)}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-16 text-center text-xs font-medium tabular-nums text-indigo-300">
                        {Math.round(view.scale * 100)}%
                    </div>
                    <Button
                        aria-label={t("VPN.TopologyZoomIn")}
                        className="h-9 w-9 border-0 bg-transparent text-slate-300 hover:bg-indigo-500/20 hover:text-white"
                        size="icon"
                        variant="ghost"
                        onClick={() => zoomBy(0.2)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    <div className="mx-1 h-6 w-px bg-indigo-500/30" />
                    <Button
                        aria-label={t("VPN.TopologyResetView")}
                        className="h-9 w-9 border-0 bg-transparent text-slate-300 hover:bg-indigo-500/20 hover:text-white"
                        size="icon"
                        variant="ghost"
                        onClick={resetView}
                    >
                        <RotateCw className="h-4 w-4" />
                    </Button>
                </div>

                {/* 拓扑图主体 */}
                <div
                    ref={viewportRef}
                    aria-label={t("VPN.Topology")}
                    className="absolute inset-0 z-10 touch-none cursor-grab overscroll-contain active:cursor-grabbing"
                    role="img"
                    onPointerCancel={handlePointerUp}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <div
                        className="absolute left-1/2 top-1/2 h-[500px] w-[1100px] origin-center transition-transform duration-150"
                        style={{
                            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        }}
                    >
                        {/* SVG 连接线和动画 */}
                        <svg
                            className="absolute inset-0 h-full w-full overflow-visible"
                            fill="none"
                            viewBox="0 0 1100 500"
                        >
                            <defs>
                                {/* 渐变定义 */}
                                <linearGradient id="link-gradient-1" x1="0%" x2="100%" y1="0%" y2="0%">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="50%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                                <linearGradient id="link-gradient-2" x1="0%" x2="100%" y1="0%" y2="0%">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="50%" stopColor="#a78bfa" />
                                    <stop offset="100%" stopColor="#c084fc" />
                                </linearGradient>
                                <linearGradient id="link-gradient-3" x1="0%" x2="100%" y1="0%" y2="0%">
                                    <stop offset="0%" stopColor="#c084fc" />
                                    <stop offset="50%" stopColor="#e879f9" />
                                    <stop offset="100%" stopColor="#f0abfc" />
                                </linearGradient>

                                {/* 箭头标记 */}
                                <marker
                                    id="arrow-cyan"
                                    markerHeight="8"
                                    markerWidth="8"
                                    orient="auto"
                                    refX="8"
                                    refY="4"
                                    viewBox="0 0 8 8"
                                >
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#06b6d4" />
                                </marker>
                                <marker
                                    id="arrow-purple"
                                    markerHeight="8"
                                    markerWidth="8"
                                    orient="auto"
                                    refX="8"
                                    refY="4"
                                    viewBox="0 0 8 8"
                                >
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#a78bfa" />
                                </marker>
                                <marker
                                    id="arrow-pink"
                                    markerHeight="8"
                                    markerWidth="8"
                                    orient="auto"
                                    refX="8"
                                    refY="4"
                                    viewBox="0 0 8 8"
                                >
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#f0abfc" />
                                </marker>

                                {/* 动画流动效果 */}
                                <linearGradient id="flow-gradient">
                                    <stop offset="0%" stopColor="transparent" />
                                    <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
                                    <stop offset="100%" stopColor="transparent" />
                                    <animate
                                        attributeName="x1"
                                        values="0%;100%"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                    <animate
                                        attributeName="x2"
                                        values="0%;100%"
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                </linearGradient>
                            </defs>

                            {/* 连接路径 - 入口到中继 */}
                            <g opacity="0.4">
                                <path
                                    d="M 280 260 Q 340 260 340 160 T 400 160"
                                    stroke="url(#link-gradient-1)"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </g>
                            <path
                                d="M 280 260 Q 340 260 340 160 T 400 160"
                                stroke="url(#link-gradient-1)"
                                strokeLinecap="round"
                                strokeWidth="3"
                                markerEnd="url(#arrow-cyan)"
                                fill="none"
                                className="drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                            >
                                <animate
                                    attributeName="stroke-dasharray"
                                    values="0,1000;1000,0"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 连接路径 - 中继到出口 */}
                            <g opacity="0.4">
                                <path
                                    d="M 610 160 Q 670 160 670 280 T 740 280"
                                    stroke="url(#link-gradient-2)"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </g>
                            <path
                                d="M 610 160 Q 670 160 670 280 T 740 280"
                                stroke="url(#link-gradient-2)"
                                strokeLinecap="round"
                                strokeWidth="3"
                                markerEnd="url(#arrow-purple)"
                                fill="none"
                                className="drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                            >
                                <animate
                                    attributeName="stroke-dasharray"
                                    values="0,1000;1000,0"
                                    dur="3s"
                                    begin="0.5s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 连接路径 - 出口到互联网 */}
                            <g opacity="0.4">
                                <path
                                    d="M 960 280 Q 1000 280 1000 160 T 1040 160"
                                    stroke="url(#link-gradient-3)"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            </g>
                            <path
                                d="M 960 280 Q 1000 280 1000 160 T 1040 160"
                                stroke="url(#link-gradient-3)"
                                strokeLinecap="round"
                                strokeWidth="3"
                                markerEnd="url(#arrow-pink)"
                                fill="none"
                                className="drop-shadow-[0_0_8px_rgba(240,171,252,0.6)]"
                            >
                                <animate
                                    attributeName="stroke-dasharray"
                                    values="0,1000;1000,0"
                                    dur="3s"
                                    begin="1s"
                                    repeatCount="indefinite"
                                />
                            </path>

                            {/* 流动粒子效果 */}
                            <circle r="4" fill="#06b6d4" className="drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]">
                                <animateMotion dur="3s" repeatCount="indefinite">
                                    <mpath href="#path-1" />
                                </animateMotion>
                            </circle>
                            <circle r="4" fill="#a78bfa" className="drop-shadow-[0_0_6px_rgba(167,139,250,0.8)]">
                                <animateMotion dur="3s" begin="0.5s" repeatCount="indefinite">
                                    <mpath href="#path-2" />
                                </animateMotion>
                            </circle>
                            <circle r="4" fill="#f0abfc" className="drop-shadow-[0_0_6px_rgba(240,171,252,0.8)]">
                                <animateMotion dur="3s" begin="1s" repeatCount="indefinite">
                                    <mpath href="#path-3" />
                                </animateMotion>
                            </circle>

                            {/* 隐藏路径用于动画 */}
                            <path
                                id="path-1"
                                d="M 280 260 Q 340 260 340 160 T 400 160"
                                fill="none"
                                opacity="0"
                            />
                            <path
                                id="path-2"
                                d="M 610 160 Q 670 160 670 280 T 740 280"
                                fill="none"
                                opacity="0"
                            />
                            <path
                                id="path-3"
                                d="M 960 280 Q 1000 280 1000 160 T 1040 160"
                                fill="none"
                                opacity="0"
                            />
                        </svg>

                        {/* 节点卡片 */}
                        <TopologyNode
                            className="left-[50px] top-[210px]"
                            icon={<Server className="h-7 w-7" />}
                            label={t("VPN.EntryServer")}
                            value={entry}
                            color="cyan"
                        />
                        <TopologyNode
                            className="left-[400px] top-[90px]"
                            icon={<Zap className="h-7 w-7" />}
                            label={t("VPN.FlowRelay")}
                            value="Dashboard Relay"
                            color="indigo"
                        />
                        <TopologyNode
                            className="left-[740px] top-[230px]"
                            icon={<Server className="h-7 w-7" />}
                            label={t("VPN.ExitServer")}
                            value={exit}
                            color="purple"
                        />
                        <TopologyNode
                            className="left-[1040px] top-[100px] w-[220px]"
                            icon={<Globe2 className="h-7 w-7" />}
                            label={t("VPN.FlowTarget")}
                            value="Internet"
                            color="pink"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function TopologyNode({
    className,
    icon,
    label,
    value,
    color,
}: {
    className: string
    icon: React.ReactNode
    label: string
    value: string
    color: "cyan" | "indigo" | "purple" | "pink"
}) {
    const colorClasses = {
        cyan: {
            border: "border-cyan-500/40",
            bg: "bg-slate-900/95",
            iconBg: "bg-gradient-to-br from-cyan-500 to-blue-600",
            shadow: "shadow-cyan-500/20",
            glow: "after:bg-cyan-500/20",
        },
        indigo: {
            border: "border-indigo-500/40",
            bg: "bg-slate-900/95",
            iconBg: "bg-gradient-to-br from-indigo-500 to-purple-600",
            shadow: "shadow-indigo-500/20",
            glow: "after:bg-indigo-500/20",
        },
        purple: {
            border: "border-purple-500/40",
            bg: "bg-slate-900/95",
            iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
            shadow: "shadow-purple-500/20",
            glow: "after:bg-purple-500/20",
        },
        pink: {
            border: "border-pink-500/40",
            bg: "bg-slate-900/95",
            iconBg: "bg-gradient-to-br from-pink-500 to-rose-600",
            shadow: "shadow-pink-500/20",
            glow: "after:bg-pink-500/20",
        },
    }

    const colors = colorClasses[color]

    return (
        <div
            className={`group absolute w-[240px] rounded-xl border backdrop-blur-md transition-all duration-300 hover:scale-105 ${className} ${colors.border} ${colors.bg} ${colors.shadow} shadow-2xl`}
        >
            {/* 发光效果 */}
            <div className={`absolute -inset-0.5 rounded-xl opacity-0 blur transition duration-300 group-hover:opacity-100 ${colors.glow}`} />

            <div className="relative p-4">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white shadow-lg transition-transform duration-300 group-hover:scale-110 ${colors.iconBg}`}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {label}
                        </div>
                        <div className="mt-1.5 break-all text-sm font-bold text-slate-100">
                            {value || "-"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}
