import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ModelAgentVPNSession, ServerIdentifierType } from "@/types"
import { Minus, Network, Plus, RotateCw, Server, Zap } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

interface TopologyDiagramProps {
    servers: ServerIdentifierType[]
    sessions: ModelAgentVPNSession[]
    serverName: (id?: number) => string
    t: (key: string) => string
}

interface NodePosition {
    id: number
    name: string
    x: number
    y: number
    isOnline: boolean
}

function stableNodeOffset(serverID: number, index: number): number {
    const seed = Math.sin(serverID * 12.9898 + index * 78.233) * 43758.5453
    return (seed - Math.floor(seed) - 0.5) * 80
}

// 生成节点在 Dashboard 周围的圆形分布位置
function generateNodePositions(
    servers: ServerIdentifierType[],
    canvasWidth: number,
    canvasHeight: number,
    serverName: (id?: number) => string,
): NodePosition[] {
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const radius = Math.min(canvasWidth, canvasHeight) * 0.35 // 节点分布半径

    return servers.map((server, index) => {
        const angle = (index / servers.length) * 2 * Math.PI - Math.PI / 2
        const actualRadius = radius + stableNodeOffset(server.id, index)

        return {
            id: server.id,
            name: serverName(server.id),
            x: centerX + Math.cos(angle) * actualRadius,
            y: centerY + Math.sin(angle) * actualRadius,
            isOnline: server.last_active
                ? new Date().getTime() - new Date(server.last_active).getTime() < 90000
                : false,
        }
    })
}

// 生成贝塞尔曲线路径
function generatePath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance === 0) return `M ${x1} ${y1} L ${x2} ${y2}`

    // 控制点偏移
    const offset = distance * 0.3
    const cx1 = x1 + dx * 0.3 + dy * offset / distance
    const cy1 = y1 + dy * 0.3 - dx * offset / distance
    const cx2 = x2 - dx * 0.3 + dy * offset / distance
    const cy2 = y2 - dy * 0.3 - dx * offset / distance

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

export function TopologyDiagramNew({ servers, sessions, serverName, t }: TopologyDiagramProps) {
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const dragRef = useRef<{
        originX: number
        originY: number
        pointerID: number
        startX: number
        startY: number
    } | null>(null)
    const [canvasSize] = useState({ width: 1200, height: 800 })

    const zoomBy = (delta: number) => {
        setView((current) => ({
            ...current,
            scale: clampNumber(current.scale + delta, 0.5, 2),
        }))
    }

    const resetView = () => setView({ scale: 1, x: 0, y: 0 })

    // 生成节点位置（只在服务器列表变化时重新计算）
    const nodePositions = useMemo(
        () => generateNodePositions(servers, canvasSize.width, canvasSize.height, serverName),
        [servers, canvasSize.width, canvasSize.height, serverName],
    )

    // Dashboard 中心位置
    const dashboardNode = {
        x: canvasSize.width / 2,
        y: canvasSize.height / 2,
    }

    // 活跃的会话连接
    const activeConnections = useMemo(() => {
        return sessions
            .filter((session) => session.state === "running")
            .map((session) => {
                const entryNode = nodePositions.find((n) => n.id === session.entry_server_id)
                const exitNode = nodePositions.find((n) => n.id === session.exit_server_id)

                if (!entryNode || !exitNode) return null

                return {
                    id: session.session_id,
                    entryNode,
                    exitNode,
                }
            })
            .filter((conn): conn is NonNullable<typeof conn> => conn !== null)
    }, [sessions, nodePositions])

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
                                {servers.length} {t("Servers")} · {activeConnections.length}{" "}
                                {t("VPN.ActiveSessions")}
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
                        className="absolute left-1/2 top-1/2 origin-center transition-transform duration-150"
                        style={{
                            width: `${canvasSize.width}px`,
                            height: `${canvasSize.height}px`,
                            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                        }}
                    >
                        {/* SVG 连接线 */}
                        <svg
                            className="absolute inset-0 h-full w-full overflow-visible"
                            fill="none"
                            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                        >
                            <defs>
                                {/* 渐变定义 */}
                                <linearGradient id="link-gradient-entry" x1="0%" x2="100%" y1="0%" y2="0%">
                                    <stop offset="0%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                                <linearGradient id="link-gradient-exit" x1="0%" x2="100%" y1="0%" y2="0%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#a78bfa" />
                                </linearGradient>

                                {/* 箭头标记 */}
                                <marker
                                    id="arrow-entry"
                                    markerHeight="8"
                                    markerWidth="8"
                                    orient="auto"
                                    refX="8"
                                    refY="4"
                                    viewBox="0 0 8 8"
                                >
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#6366f1" />
                                </marker>
                                <marker
                                    id="arrow-exit"
                                    markerHeight="8"
                                    markerWidth="8"
                                    orient="auto"
                                    refX="8"
                                    refY="4"
                                    viewBox="0 0 8 8"
                                >
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#a78bfa" />
                                </marker>
                            </defs>

                            {/* 绘制活跃会话的连接线 */}
                            {activeConnections.map((conn, index) => {
                                // Entry -> Dashboard
                                const entryPath = generatePath(
                                    conn.entryNode.x,
                                    conn.entryNode.y,
                                    dashboardNode.x,
                                    dashboardNode.y,
                                )
                                // Dashboard -> Exit
                                const exitPath = generatePath(
                                    dashboardNode.x,
                                    dashboardNode.y,
                                    conn.exitNode.x,
                                    conn.exitNode.y,
                                )

                                return (
                                    <g key={conn.id}>
                                        {/* Entry 到 Dashboard 的连接 */}
                                        <g opacity="0.3">
                                            <path
                                                d={entryPath}
                                                stroke="url(#link-gradient-entry)"
                                                strokeWidth="2"
                                            />
                                        </g>
                                        <path
                                            d={entryPath}
                                            stroke="url(#link-gradient-entry)"
                                            strokeLinecap="round"
                                            strokeWidth="3"
                                            markerEnd="url(#arrow-entry)"
                                            className="drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                                        >
                                            <animate
                                                attributeName="stroke-dasharray"
                                                values="0,1000;1000,0"
                                                dur="3s"
                                                begin={`${index * 0.5}s`}
                                                repeatCount="indefinite"
                                            />
                                        </path>

                                        {/* Dashboard 到 Exit 的连接 */}
                                        <g opacity="0.3">
                                            <path
                                                d={exitPath}
                                                stroke="url(#link-gradient-exit)"
                                                strokeWidth="2"
                                            />
                                        </g>
                                        <path
                                            d={exitPath}
                                            stroke="url(#link-gradient-exit)"
                                            strokeLinecap="round"
                                            strokeWidth="3"
                                            markerEnd="url(#arrow-exit)"
                                            className="drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                                        >
                                            <animate
                                                attributeName="stroke-dasharray"
                                                values="0,1000;1000,0"
                                                dur="3s"
                                                begin={`${index * 0.5 + 0.3}s`}
                                                repeatCount="indefinite"
                                            />
                                        </path>

                                        {/* 流动粒子 - Entry 到 Dashboard */}
                                        <circle
                                            r="4"
                                            fill="#06b6d4"
                                            className="drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]"
                                        >
                                            <animateMotion
                                                dur="3s"
                                                begin={`${index * 0.5}s`}
                                                repeatCount="indefinite"
                                            >
                                                <mpath href={`#motion-path-entry-${index}`} />
                                            </animateMotion>
                                        </circle>
                                        <path
                                            id={`motion-path-entry-${index}`}
                                            d={entryPath}
                                            opacity="0"
                                        />

                                        {/* 流动粒子 - Dashboard 到 Exit */}
                                        <circle
                                            r="4"
                                            fill="#a78bfa"
                                            className="drop-shadow-[0_0_6px_rgba(167,139,250,0.8)]"
                                        >
                                            <animateMotion
                                                dur="3s"
                                                begin={`${index * 0.5 + 0.3}s`}
                                                repeatCount="indefinite"
                                            >
                                                <mpath href={`#motion-path-exit-${index}`} />
                                            </animateMotion>
                                        </circle>
                                        <path
                                            id={`motion-path-exit-${index}`}
                                            d={exitPath}
                                            opacity="0"
                                        />
                                    </g>
                                )
                            })}
                        </svg>

                        {/* Dashboard 中心节点 */}
                        <DashboardNode
                            x={dashboardNode.x}
                            y={dashboardNode.y}
                            label={t("VPN.FlowRelay")}
                        />

                        {/* 服务器节点 */}
                        {nodePositions.map((node) => (
                            <ServerNode
                                key={node.id}
                                x={node.x}
                                y={node.y}
                                name={node.name}
                                isOnline={node.isOnline}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Dashboard 中心节点
function DashboardNode({ x, y, label }: { x: number; y: number; label: string }) {
    return (
        <div
            className="group absolute"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
            }}
        >
            <div className="relative">
                {/* 发光效果 */}
                <div className="absolute -inset-4 rounded-full bg-indigo-500/30 blur-xl" />

                {/* 主节点 */}
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-indigo-500 bg-gradient-to-br from-indigo-600 to-purple-600 shadow-2xl transition-transform duration-300 group-hover:scale-110">
                    <Zap className="h-10 w-10 text-white" />
                </div>

                {/* 标签 */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-indigo-500/30 bg-slate-900/95 px-3 py-1 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur-md">
                    {label}
                </div>
            </div>
        </div>
    )
}

// 服务器节点
function ServerNode({
    x,
    y,
    name,
    isOnline,
}: {
    x: number
    y: number
    name: string
    isOnline: boolean
}) {
    return (
        <div
            className="group absolute"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
            }}
        >
            <div className="relative">
                {/* 主节点 */}
                <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 ${
                        isOnline
                            ? "border-cyan-500 bg-gradient-to-br from-cyan-600 to-blue-600 shadow-cyan-500/30"
                            : "border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-500/30"
                    } shadow-2xl transition-all duration-300 group-hover:scale-110`}
                >
                    <Server className="h-7 w-7 text-white" />

                    {/* 在线状态指示器 */}
                    {isOnline && (
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-slate-950 bg-green-500">
                            <div className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-75" />
                        </div>
                    )}
                </div>

                {/* 标签 */}
                <div
                    className={`absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border ${
                        isOnline ? "border-cyan-500/30" : "border-slate-600/30"
                    } bg-slate-900/95 px-2 py-0.5 text-xs font-medium text-slate-100 shadow-lg backdrop-blur-md`}
                >
                    {name}
                </div>
            </div>
        </div>
    )
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}
