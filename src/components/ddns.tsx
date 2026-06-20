import {
    createDDNSCredential,
    createDDNSProfile,
    updateDDNSCredential,
    updateDDNSProfile,
} from "@/api/ddns"
import { Button } from "@/components/ui/button"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { IconButton } from "@/components/xui/icon-button"
import { asOptionalField, conv } from "@/lib/utils"
import {
    ModelDDNSCredential,
    ModelDDNSCredentialForm,
    ModelDDNSForm,
    ModelDDNSProfile,
    ddnsRequestTypes,
    ddnsTypes,
} from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

interface DDNSCardProps {
    data?: ModelDDNSProfile
    credentials: ModelDDNSCredential[]
    mutate: KeyedMutator<ModelDDNSProfile[]>
}

interface DDNSCredentialCardProps {
    data?: ModelDDNSCredential
    providers: string[]
    mutate: KeyedMutator<ModelDDNSCredential[]>
}

const ddnsFormSchema = z.object({
    max_retries: z.coerce.number().int().min(1),
    enable_ipv4: asOptionalField(z.boolean()),
    enable_ipv6: asOptionalField(z.boolean()),
    name: z.string().min(1),
    credential_id: z.coerce.number().int().min(1),
    provider: asOptionalField(z.string()),
    domains: z.array(z.string()),
    domains_raw: z.string(),
})

const ddnsCredentialFormSchema = z.object({
    name: z.string().min(1),
    provider: z.string().min(1),
    access_id: asOptionalField(z.string()),
    access_secret: asOptionalField(z.string()),
    webhook_url: asOptionalField(z.string().url()),
    webhook_method: asOptionalField(z.coerce.number().int().min(1).max(255)),
    webhook_request_type: asOptionalField(z.coerce.number().int().min(1).max(255)),
    webhook_request_body: asOptionalField(z.string()),
    webhook_headers: asOptionalField(z.string()),
})

type DDNSFormInput = z.input<typeof ddnsFormSchema>
type DDNSFormData = z.output<typeof ddnsFormSchema>
type DDNSCredentialFormInput = z.input<typeof ddnsCredentialFormSchema>
type DDNSCredentialFormData = z.output<typeof ddnsCredentialFormSchema>

export const DDNSCard: React.FC<DDNSCardProps> = ({ data, credentials, mutate }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    const defaultValues = (): DDNSFormInput => ({
        max_retries: data?.max_retries ?? 3,
        enable_ipv4: data?.enable_ipv4 ?? false,
        enable_ipv6: data?.enable_ipv6 ?? false,
        name: data?.name ?? "",
        credential_id: data?.credential_id || credentials[0]?.id || 0,
        provider: data?.provider ?? credentials[0]?.provider ?? "dummy",
        domains: data?.domains ?? [],
        domains_raw: conv.arrToStr(data?.domains ?? []),
    })

    const form = useForm<DDNSFormInput, unknown, DDNSFormData>({
        resolver: zodResolver(ddnsFormSchema),
        defaultValues: defaultValues(),
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const onSubmit = async (values: DDNSFormData) => {
        const credential = credentials.find((item) => item.id === values.credential_id)
        if (!credential) {
            toast(t("Error"), {
                description: t("DDNSCredentialRequired"),
            })
            return
        }

        const payload: ModelDDNSForm = {
            name: values.name,
            credential_id: values.credential_id,
            provider: credential.provider,
            domains: conv.strToArr(values.domains_raw),
            enable_ipv4: values.enable_ipv4,
            enable_ipv6: values.enable_ipv6,
            max_retries: values.max_retries,
        }

        try {
            if (data?.id) {
                await updateDDNSProfile(data.id, payload)
            } else {
                await createDDNSProfile(payload)
            }
        } catch (e) {
            console.error(e)
            toast(t("Error"), {
                description: t("Results.UnExpectedError"),
            })
            return
        }
        setOpen(false)
        await mutate()
        form.reset(defaultValues())
    }

    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) {
            form.reset(defaultValues())
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{data ? t("EditDDNS") : t("CreateDDNS")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="My DDNS Profile" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="credential_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Credential")}</FormLabel>
                                            <Select
                                                value={field.value ? String(field.value) : undefined}
                                                onValueChange={(value) => field.onChange(Number(value))}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={
                                                                credentials.length
                                                                    ? t("Select")
                                                                    : t("DDNSCredentialsEmpty")
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {credentials.map((credential) => (
                                                        <SelectItem
                                                            key={credential.id}
                                                            value={String(credential.id)}
                                                        >
                                                            {credential.name} ({credential.provider})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="domains_raw"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t("Domains") + t("SeparateWithComma")}
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="www.example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_retries"
                                    render={({ field }) => {
                                        const { value, ...fieldProps } = field
                                        return (
                                            <FormItem>
                                                <FormLabel>{t("MaximumRetryAttempts")}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="3"
                                                        value={String(value ?? "")}
                                                        {...fieldProps}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="enable_ipv4"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={field.value === true}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <Label className="text-sm">
                                                        {t("Enable")} IPv4
                                                    </Label>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="enable_ipv6"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={field.value === true}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <Label className="text-sm">
                                                        {t("Enable")} IPv6
                                                    </Label>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2">
                                        {t("Confirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

export const DDNSCredentialCard: React.FC<DDNSCredentialCardProps> = ({
    data,
    providers,
    mutate,
}) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    const defaultValues = (): DDNSCredentialFormInput => ({
        name: data?.name ?? "",
        provider: data?.provider ?? providers[0] ?? "dummy",
        access_id: data?.access_id ?? "",
        access_secret: "",
        webhook_url: data?.webhook_url ?? "",
        webhook_method: data?.webhook_method,
        webhook_request_type: data?.webhook_request_type,
        webhook_request_body: data?.webhook_request_body ?? "",
        webhook_headers: data?.webhook_headers ?? "",
    })

    const form = useForm<DDNSCredentialFormInput, unknown, DDNSCredentialFormData>({
        resolver: zodResolver(ddnsCredentialFormSchema),
        defaultValues: defaultValues(),
        resetOptions: {
            keepDefaultValues: false,
        },
    })
    const provider = useWatch({ control: form.control, name: "provider" })

    const onSubmit = async (values: DDNSCredentialFormData) => {
        const payload: ModelDDNSCredentialForm = {
            name: values.name,
            provider: values.provider,
            access_id: values.access_id,
            access_secret: values.access_secret,
            webhook_url: values.webhook_url,
            webhook_method: values.webhook_method,
            webhook_request_type: values.webhook_request_type,
            webhook_request_body: values.webhook_request_body,
            webhook_headers: values.webhook_headers,
        }

        try {
            if (data?.id) {
                await updateDDNSCredential(data.id, payload)
            } else {
                await createDDNSCredential(payload)
            }
        } catch (e) {
            console.error(e)
            toast(t("Error"), {
                description: t("Results.UnExpectedError"),
            })
            return
        }
        setOpen(false)
        await mutate()
        form.reset(defaultValues())
    }

    const onOpenChange = (next: boolean) => {
        setOpen(next)
        if (next) {
            form.reset(defaultValues())
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditDDNSCredential") : t("CreateDDNSCredential")}
                            </DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Cloudflare Token" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="provider"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Provider")}</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select service type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {providers.map((provider) => (
                                                        <SelectItem key={provider} value={provider}>
                                                            {provider}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="access_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Credential")} 1</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Token ID" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="access_secret"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Credential")} 2</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder={
                                                        data
                                                            ? t("LeaveBlankToKeepExistingSecret")
                                                            : "Token Secret"
                                                    }
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {provider === "webhook" && (
                                    <>
                                        <FormField
                                            control={form.control}
                                            name="webhook_url"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook URL</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="https://ddns.example.com/?record=#record#"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_method"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Webhook {t("RequestMethod")}
                                                    </FormLabel>
                                                    <Select
                                                        value={
                                                            field.value
                                                                ? String(field.value)
                                                                : undefined
                                                        }
                                                        onValueChange={field.onChange}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Webhook Request Method" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(ddnsTypes).map(
                                                                ([key, value]) => (
                                                                    <SelectItem key={key} value={key}>
                                                                        {value}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_request_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestType")}</FormLabel>
                                                    <Select
                                                        value={
                                                            field.value
                                                                ? String(field.value)
                                                                : undefined
                                                        }
                                                        onValueChange={field.onChange}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Webhook Request Type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(ddnsRequestTypes).map(
                                                                ([key, value]) => (
                                                                    <SelectItem key={key} value={key}>
                                                                        {value}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_headers"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Webhook {t("RequestHeader")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            className="resize-y"
                                                            placeholder='{"User-Agent":"Nezha-Agent"}'
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_request_body"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestBody")}</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            className="resize-y"
                                                            placeholder='{&#13;&#10; "ip": #ip#,&#13;&#10; "domain": "#domain#"&#13;&#10;}'
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2">
                                        {t("Confirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
