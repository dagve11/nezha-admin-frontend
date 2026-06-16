import { getServerConfig, setServerConfig } from "@/api/server"
import { Button, ButtonProps } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { IconButton } from "@/components/xui/icon-button"
import { ModelServerTaskResponse } from "@/types"
import { AgentConfigSchema, GroupedBoolFields, type AgentConfig } from "@/types/server"
import { zodResolver } from "@hookform/resolvers/zod"
import { CogIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const parseServerConfig = (value: unknown): AgentConfig => {
    if (typeof value !== "string" || !value.trim()) {
        return {}
    }
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
}

const formatJSONField = (value: unknown) => {
    if (value === undefined || value === null) {
        return ""
    }
    return JSON.stringify(value)
}

const parseJSONField = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
        return undefined
    }
    return JSON.parse(value)
}

interface ServerConfigCardProps extends ButtonProps {
    sid: number
    menuItem?: boolean
}

export const ServerConfigCard = ({ sid, menuItem = false, ...props }: ServerConfigCardProps) => {
    const { t } = useTranslation()
    const [data, setData] = useState<AgentConfig | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await getServerConfig(sid)
                setData(parseServerConfig(result))
            } catch (error) {
                console.error(error)
                toast(t("Error"), {
                    description: (error as Error).message,
                })
                setOpen(false)
                return
            } finally {
                setLoading(false)
            }
        }
        if (open) fetchData()
    }, [open, sid, t])

    const form = useForm({
        resolver: zodResolver(AgentConfigSchema) as any,
        defaultValues: {
            ...data,
            hard_drive_partition_allowlist_raw: formatJSONField(
                data?.hard_drive_partition_allowlist,
            ),
            nic_allowlist_raw: formatJSONField(data?.nic_allowlist),
        },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    useEffect(() => {
        if (data) {
            form.reset({
                ...data,
                hard_drive_partition_allowlist_raw: formatJSONField(
                    data.hard_drive_partition_allowlist,
                ),
                nic_allowlist_raw: formatJSONField(data.nic_allowlist),
            })
        }
    }, [data, form])

    const onSubmit = async (values: any) => {
        let resp: ModelServerTaskResponse = {}
        try {
            values.nic_allowlist = parseJSONField(values.nic_allowlist_raw)
            values.hard_drive_partition_allowlist = parseJSONField(
                values.hard_drive_partition_allowlist_raw,
            )
            resp = await setServerConfig({ config: JSON.stringify(values), servers: [sid] })
        } catch (e) {
            console.error(e)
            toast(t("Error"), {
                description: t("Results.UnExpectedError"),
            })
            return
        }
        toast(t("Done"), {
            description:
                t("Results.ForceUpdate") +
                (resp.success?.length ? t(`Success`) + ` [${resp.success.join(",")}]` : "") +
                (resp.failure?.length ? t(`Failure`) + ` [${resp.failure.join(",")}]` : "") +
                (resp.offline?.length ? t(`Offline`) + ` [${resp.offline.join(",")}]` : ""),
        })
        setOpen(false)
        form.reset()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {menuItem ? (
                    <button
                        type="button"
                        className="flex w-full items-center text-sm px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setOpen(true)}
                    >
                        <CogIcon className="h-4 w-4 mr-2" />
                        <span>{t("Config")}</span>
                    </button>
                ) : (
                    <IconButton {...props} icon="cog" />
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                {loading ? (
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>Loading...</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                        <div className="items-center mx-1">
                            <DialogHeader>
                                <DialogTitle>{t("EditServerConfig")}</DialogTitle>
                                <DialogDescription />
                            </DialogHeader>
                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-2 my-2"
                                >
                                    <FormField
                                        control={form.control}
                                        name="ip_report_period"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ip_report_period</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="report_delay"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>report_delay</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="hard_drive_partition_allowlist_raw"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    hard_drive_partition_allowlist
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea className="resize-y" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="nic_allowlist_raw"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>nic_allowlist</FormLabel>
                                                <FormControl>
                                                    <Textarea className="resize-y" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {GroupedBoolFields.map((group, idx) => (
                                        <div className="flex gap-8" key={idx}>
                                            {group.map((field) => (
                                                <FormField
                                                    key={field}
                                                    control={form.control}
                                                    name={field}
                                                    render={({ field: controllerField }) => (
                                                        <FormItem className="flex items-center w-full">
                                                            <FormControl>
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        checked={
                                                                            !!controllerField.value
                                                                        }
                                                                        onCheckedChange={
                                                                            controllerField.onChange
                                                                        }
                                                                    />
                                                                    <Label className="text-sm">
                                                                        {t(field)}
                                                                    </Label>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                    <DialogFooter className="justify-end">
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                className="my-2"
                                                variant="secondary"
                                            >
                                                {t("Close")}
                                            </Button>
                                        </DialogClose>
                                        <Button type="submit" className="my-2">
                                            {t("Submit")}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    )
}
