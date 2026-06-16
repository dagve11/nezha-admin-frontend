import { Button } from "@/components/ui/button"
import { ModelAgentVPNSession, ServerIdentifierType } from "@/types"
import { Minus, Plus, RotateCw, Server, Waypoints } from "lucide-react"
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

interface ActiveConnection {
    id: string
    entryNode: NodePosition
    exitNode: NodePosition
    isDirect: boolean
}

// Deterministic pseudo-random number from a seed.
function seededRandom(seed: number): number {
    const value = Math.sin(seed) * 43758.5453
    return value - Math.floor(value)
}

function isServerOnline(server: ServerIdentifierType): boolean {
    if (typeof server.online === "boolean") {
        return server.online
    }
    if (!server.last_active) {
        return false
    }
    const lastActive = new Date(server.last_active).getTime()
    if (Number.isNaN(lastActive)) {
        return false
    }
    return Date.now() - lastActive < 90000
}

// Spread nodes around the relay hub with stable jitter.
function generateNodePositions(
    servers: ServerIdentifierType[],
    canvasWidth: number,
    canvasHeight: number,
    serverName: (id?: number) => string,
): NodePosition[] {
    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2
    const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.36
    const count = servers.length || 1
    const slice = (2 * Math.PI) / count

    return servers.map((server, index) => {
        const seed = server.id * 12.9898 + index * 78.233
        const angleJitter = (seededRandom(seed) - 0.5) * slice * 0.7
        const angle = index * slice - Math.PI / 2 + angleJitter
        const actualRadius = baseRadius + (seededRandom(seed * 1.7 + 3.1) - 0.5) * baseRadius * 0.55

        return {
            id: server.id,
            name: serverName(server.id),
            x: centerX + Math.cos(angle) * actualRadius,
            y: centerY + Math.sin(angle) * actualRadius,
            isOnline: isServerOnline(server),
        }
    })
}

// Generate a curved link path between two nodes.
function generatePath(x1: number, y1: number, x2: number, y2: number): string {
    const dx = x2 - x1
    const dy = y2 - y1
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance === 0) return `M ${x1} ${y1} L ${x2} ${y2}`

    const offset = distance * 0.22
    const cx1 = x1 + dx * 0.3 + (dy * offset) / distance
    const cy1 = y1 + dy * 0.3 - (dx * offset) / distance
    const cx2 = x2 - dx * 0.3 + (dy * offset) / distance
    const cy2 = y2 - dy * 0.3 - (dx * offset) / distance

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

export function TopologyDiagramNew({ servers, sessions, serverName, t }: TopologyDiagramProps) {
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const dragRef = useRef<{
        originX: number
        originY: number
        pointerID: number
        startX: number
        startY: number
    } | null>(null)
    const rafRef = useRef<number | null>(null)
    const [canvasSize] = useState({ width: 1200, height: 800 })

    const zoomBy = (delta: number) => {
        setView((current) => ({
            ...current,
            scale: clampNumber(current.scale + delta, 0.5, 2),
        }))
    }

    const resetView = () => setView({ scale: 1, x: 0, y: 0 })

    const nodePositions = useMemo(
        () => generateNodePositions(servers, canvasSize.width, canvasSize.height, serverName),
        [servers, canvasSize.width, canvasSize.height, serverName],
    )

    const dashboardNode = {
        x: canvasSize.width / 2,
        y: canvasSize.height / 2,
    }

    const onlineCount = useMemo(
        () => nodePositions.filter((n) => n.isOnline).length,
        [nodePositions],
    )

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
                    isDirect: session.relay_mode === "direct",
                }
            })
            .filter((conn): conn is ActiveConnection => conn !== null)
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
        setIsDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current
        if (!drag || drag.pointerID !== event.pointerId) return

        const nextX = drag.originX + event.clientX - drag.startX
        const nextY = drag.originY + event.clientY - drag.startY

        if (rafRef.current !== null) return
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            setView((current) => ({ ...current, x: nextX, y: nextY }))
        })
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerID === event.pointerId) {
            dragRef.current = null
            setIsDragging(false)
        }
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    return (
        <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            {/* Dotted grid background */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:28px_28px]"
                aria-hidden="true"
            />

            {/* Summary panel */}
            <div className="absolute left-4 top-4 z-20 rounded-lg border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                <div className="flex divide-x divide-zinc-800 p-2 text-center">
                    <div className="px-3.5 py-2">
                        <div className="text-base font-semibold tabular-nums text-zinc-100">
                            {servers.length}
                        </div>
                        <div className="text-[11px] text-zinc-500">{t("Servers")}</div>
                    </div>
                    <div className="px-3.5 py-2">
                        <div className="flex items-center justify-center gap-1.5 text-base font-semibold tabular-nums text-emerald-400">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            </span>
                            {onlineCount}
                        </div>
                        <div className="text-[11px] text-zinc-500">{t("VPN.Online")}</div>
                    </div>
                    <div className="px-3.5 py-2">
                        <div className="text-base font-semibold tabular-nums text-zinc-100">
                            {activeConnections.length}
                        </div>
                        <div className="text-[11px] text-zinc-500">{t("VPN.ActiveSessions")}</div>
                    </div>
                </div>
            </div>

            {/* Zoom controls */}
            <div className="absolute right-4 top-4 z-30 flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 backdrop-blur-sm">
                <Button
                    aria-label={t("VPN.TopologyZoomOut")}
                    className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    size="icon"
                    variant="ghost"
                    onClick={() => zoomBy(-0.2)}
                >
                    <Minus className="h-4 w-4" />
                </Button>
                <div className="w-12 text-center text-xs font-medium tabular-nums text-zinc-300">
                    {Math.round(view.scale * 100)}%
                </div>
                <Button
                    aria-label={t("VPN.TopologyZoomIn")}
                    className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    size="icon"
                    variant="ghost"
                    onClick={() => zoomBy(0.2)}
                >
                    <Plus className="h-4 w-4" />
                </Button>
                <div className="mx-0.5 h-5 w-px bg-zinc-800" />
                <Button
                    aria-label={t("VPN.TopologyResetView")}
                    className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    size="icon"
                    variant="ghost"
                    onClick={resetView}
                >
                    <RotateCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-[11px] text-zinc-400 backdrop-blur-sm">
                <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t("VPN.Online")}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                    {t("VPN.Offline")}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-px w-4 bg-emerald-400/70" />
                    {t("VPN.ActiveSessions")}
                </span>
            </div>

            {/* Topology canvas */}
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
                    className={`absolute left-1/2 top-1/2 origin-center will-change-transform ${
                        isDragging ? "" : "transition-transform duration-200 ease-out"
                    }`}
                    style={{
                        width: `${canvasSize.width}px`,
                        height: `${canvasSize.height}px`,
                        transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    }}
                >
                    {/* SVG links */}
                    <svg
                        className="absolute inset-0 h-full w-full overflow-visible"
                        fill="none"
                        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                    >
                        {activeConnections.map((conn, index) => {
                            const paths = conn.isDirect
                                ? [
                                      generatePath(
                                          conn.entryNode.x,
                                          conn.entryNode.y,
                                          conn.exitNode.x,
                                          conn.exitNode.y,
                                      ),
                                  ]
                                : [
                                      generatePath(
                                          conn.entryNode.x,
                                          conn.entryNode.y,
                                          dashboardNode.x,
                                          dashboardNode.y,
                                      ),
                                      generatePath(
                                          dashboardNode.x,
                                          dashboardNode.y,
                                          conn.exitNode.x,
                                          conn.exitNode.y,
                                      ),
                                  ]

                            return (
                                <g key={conn.id}>
                                    {paths.map((path, pathIndex) => {
                                        const pathID = `motion-path-${index}-${pathIndex}`
                                        return (
                                            <g key={pathID}>
                                                {/* Static link base */}
                                                <path
                                                    d={path}
                                                    stroke="rgb(63 63 70)"
                                                    strokeWidth="1"
                                                />

                                                {/* Animated active link */}
                                                <path
                                                    d={path}
                                                    stroke={
                                                        conn.isDirect
                                                            ? "rgb(96 165 250)"
                                                            : "rgb(52 211 153)"
                                                    }
                                                    strokeWidth={conn.isDirect ? "2" : "1.5"}
                                                    strokeLinecap="round"
                                                    strokeDasharray="4 10"
                                                    opacity="0.85"
                                                >
                                                    <animate
                                                        attributeName="stroke-dashoffset"
                                                        values="28;0"
                                                        dur={conn.isDirect ? "1s" : "1.2s"}
                                                        begin={`${index * 0.2 + pathIndex * 0.15}s`}
                                                        repeatCount="indefinite"
                                                    />
                                                </path>

                                                {/* Flow particle */}
                                                <circle
                                                    r={conn.isDirect ? "3" : "2.5"}
                                                    fill={
                                                        conn.isDirect
                                                            ? "rgb(147 197 253)"
                                                            : "rgb(110 231 183)"
                                                    }
                                                >
                                                    <animateMotion
                                                        dur={conn.isDirect ? "1.8s" : "2.4s"}
                                                        begin={`${index * 0.3 + pathIndex * 0.4}s`}
                                                        repeatCount="indefinite"
                                                    >
                                                        <mpath href={`#${pathID}`} />
                                                    </animateMotion>
                                                </circle>
                                                <path id={pathID} d={path} opacity="0" />
                                            </g>
                                        )
                                    })}
                                </g>
                            )
                        })}
                    </svg>

                    {/* Relay hub node */}
                    <HubNode x={dashboardNode.x} y={dashboardNode.y} label={t("VPN.FlowRelay")} />

                    {/* Server nodes */}
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
        </div>
    )
}

function HubNode({ x, y, label }: { x: number; y: number; label: string }) {
    return (
        <div
            className="group absolute"
            style={{ left: `${x}px`, top: `${y}px`, transform: "translate(-50%, -50%)" }}
        >
            <div className="relative flex flex-col items-center">
                <div className="relative flex h-24 w-24 items-center justify-center">
                    {/* Outer pulse ring */}
                    <span className="absolute h-full w-full animate-ping rounded-full border border-emerald-500/30 [animation-duration:3s]" />
                    {/* Solid core */}
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-500 shadow-[0_0_28px_-2px_rgba(16,185,129,0.7)] transition-colors duration-200 group-hover:bg-emerald-400">
                        <Waypoints className="h-7 w-7 text-zinc-950" strokeWidth={2.25} />
                    </div>
                </div>
                <div className="-mt-1 whitespace-nowrap rounded-md border border-emerald-400 bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-950">
                    {label}
                </div>
            </div>
        </div>
    )
}

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
            style={{ left: `${x}px`, top: `${y}px`, transform: "translate(-50%, -50%)" }}
        >
            <div className="relative flex flex-col items-center">
                <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-xl border transition-colors duration-200 ${
                        isOnline
                            ? "border-zinc-700 bg-zinc-900 group-hover:border-emerald-500/60"
                            : "border-zinc-800 bg-zinc-900/50 group-hover:border-zinc-700"
                    }`}
                >
                    <Server
                        className={`h-6 w-6 ${isOnline ? "text-zinc-200" : "text-zinc-600"}`}
                        strokeWidth={1.75}
                    />
                    {isOnline && (
                        <span className="absolute -right-1 -top-1 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
                        </span>
                    )}
                </div>
                <div
                    className={`mt-2 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        isOnline
                            ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                            : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
                    }`}
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
