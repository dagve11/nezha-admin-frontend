import { swrFetcher } from "@/api/api"
import { deleteDDNSCredentials, deleteDDNSProfiles, getDDNSProviders } from "@/api/ddns"
import { ActionButtonGroup } from "@/components/action-button-group"
import { DDNSCard, DDNSCredentialCard } from "@/components/ddns"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ModelDDNSCredential, ModelDDNSProfile } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function DDNSPage() {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState("ddns")
    const {
        data: profiles,
        mutate: mutateProfiles,
        error: profilesError,
        isLoading: isLoadingProfiles,
    } = useSWR<ModelDDNSProfile[]>("/api/v1/ddns", swrFetcher)
    const {
        data: credentials,
        mutate: mutateCredentials,
        error: credentialsError,
        isLoading: isLoadingCredentials,
    } = useSWR<ModelDDNSCredential[]>("/api/v1/ddns-credential", swrFetcher)
    const [providers, setProviders] = useState<string[]>([])

    useEffect(() => {
        const fetchProviders = async () => {
            const fetchedProviders = await getDDNSProviders()
            setProviders(fetchedProviders)
        }
        fetchProviders()
    }, [])

    useEffect(() => {
        const error = profilesError || credentialsError
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profilesError, credentialsError])

    const profileColumns: ColumnDef<ModelDDNSProfile>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            header: "ID",
            accessorKey: "id",
            accessorFn: (row) => row.id,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const item = row.original
                return <div className="max-w-32 whitespace-normal break-words">{item.name}</div>
            },
        },
        {
            header: t("Credential"),
            accessorKey: "credential",
            accessorFn: (row) => row.credential_name || row.credential_id,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="max-w-36 whitespace-normal break-words">
                        {item.credential_name || item.credential_id || "-"}
                    </div>
                )
            },
        },
        {
            header: "IPv4",
            accessorKey: "enableIPv4",
            accessorFn: (row) => row.enable_ipv4 ?? false,
        },
        {
            header: "IPv6",
            accessorKey: "enableIPv6",
            accessorFn: (row) => row.enable_ipv6 ?? false,
        },
        {
            header: t("Provider"),
            accessorKey: "provider",
            accessorFn: (row) => row.provider,
        },
        {
            header: t("Domains"),
            accessorKey: "domains",
            accessorFn: (row) => row.domains,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="max-w-48 whitespace-normal break-words">
                        {(item.domains ?? []).join(", ")}
                    </div>
                )
            },
        },
        {
            header: t("MaximumRetryAttempts"),
            accessorKey: "maxRetries",
            accessorFn: (row) => row.max_retries,
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const item = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteDDNSProfiles,
                            id: item.id,
                            mutate: mutateProfiles,
                        }}
                    >
                        <DDNSCard
                            mutate={mutateProfiles}
                            data={item}
                            credentials={credentials ?? []}
                        />
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const credentialColumns: ColumnDef<ModelDDNSCredential>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            header: "ID",
            accessorKey: "id",
            accessorFn: (row) => row.id,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const item = row.original
                return <div className="max-w-32 whitespace-normal break-words">{item.name}</div>
            },
        },
        {
            header: t("Provider"),
            accessorKey: "provider",
            accessorFn: (row) => row.provider,
        },
        {
            header: `${t("Credential")} 1`,
            accessorKey: "access_id",
            accessorFn: (row) => row.access_id,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="max-w-40 whitespace-normal break-words">
                        {item.access_id || "-"}
                    </div>
                )
            },
        },
        {
            header: `${t("Credential")} 2`,
            accessorKey: "access_secret_set",
            accessorFn: (row) => row.access_secret_set,
            cell: ({ row }) => (row.original.access_secret_set ? t("Configured") : "-"),
        },
        {
            header: "Webhook URL",
            accessorKey: "webhook_url",
            accessorFn: (row) => row.webhook_url,
            cell: ({ row }) => {
                const item = row.original
                return (
                    <div className="max-w-48 whitespace-normal break-words">
                        {item.webhook_url || "-"}
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const item = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteDDNSCredentials,
                            id: item.id,
                            mutate: mutateCredentials,
                        }}
                    >
                        <DDNSCredentialCard
                            mutate={mutateCredentials}
                            data={item}
                            providers={providers}
                        />
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const profileData = useMemo(() => profiles ?? [], [profiles])
    const credentialData = useMemo(() => credentials ?? [], [credentials])

    const profileTable = useReactTable({
        data: profileData,
        columns: profileColumns,
        getCoreRowModel: getCoreRowModel(),
    })

    const credentialTable = useReactTable({
        data: credentialData,
        columns: credentialColumns,
        getCoreRowModel: getCoreRowModel(),
    })

    const selectedProfileRows = profileTable.getSelectedRowModel().rows
    const selectedCredentialRows = credentialTable.getSelectedRowModel().rows

    return (
        <div className="px-3">
            <div className="flex mt-6 mb-4">
                <h1 className="flex-1 text-3xl font-bold tracking-tight">{t("DDNS")}</h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:w-[24rem]">
                    <TabsTrigger value="ddns">{t("DDNS")}</TabsTrigger>
                    <TabsTrigger value="credential">{t("Credentials")}</TabsTrigger>
                </TabsList>

                <TabsContent value="ddns" className="space-y-4">
                    <div className="flex justify-end">
                        <HeaderButtonGroup
                            className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                            delete={{
                                fn: deleteDDNSProfiles,
                                id: selectedProfileRows.map((row) => row.original.id),
                                mutate: mutateProfiles,
                            }}
                        >
                            <DDNSCard mutate={mutateProfiles} credentials={credentials ?? []} />
                        </HeaderButtonGroup>
                    </div>
                    <Table>
                        <TableHeader>
                            {profileTable.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="text-sm">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoadingProfiles ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={profileColumns.length}
                                        className="h-24 text-center"
                                    >
                                        {t("Loading")}...
                                    </TableCell>
                                </TableRow>
                            ) : profileTable.getRowModel().rows?.length ? (
                                profileTable.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="text-xsm">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={profileColumns.length}
                                        className="h-24 text-center"
                                    >
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="credential" className="space-y-4">
                    <div className="flex justify-end">
                        <HeaderButtonGroup
                            className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                            delete={{
                                fn: deleteDDNSCredentials,
                                id: selectedCredentialRows.map((row) => row.original.id),
                                mutate: mutateCredentials,
                            }}
                        >
                            <DDNSCredentialCard
                                mutate={mutateCredentials}
                                providers={providers}
                            />
                        </HeaderButtonGroup>
                    </div>
                    <Table>
                        <TableHeader>
                            {credentialTable.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="text-sm">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoadingCredentials ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={credentialColumns.length}
                                        className="h-24 text-center"
                                    >
                                        {t("Loading")}...
                                    </TableCell>
                                </TableRow>
                            ) : credentialTable.getRowModel().rows?.length ? (
                                credentialTable.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="text-xsm">
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={credentialColumns.length}
                                        className="h-24 text-center"
                                    >
                                        {t("NoResults")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    )
}
