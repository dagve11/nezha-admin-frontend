import { createUser, updateUser } from "@/api/user"
import { Button } from "@/components/ui/button"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { IconButton } from "@/components/xui/icon-button"
import { defaultUserPermissions, permissionsForRole, userPermissionKeys } from "@/lib/permissions"
import { ModelUser, ModelUserPermissions } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

interface UserCardProps {
    data?: ModelUser
    mutate: KeyedMutator<ModelUser[]>
}

const permissionSchema = z.object({
    service: z.boolean(),
    task: z.boolean(),
    notification: z.boolean(),
    ddns: z.boolean(),
    bestip: z.boolean(),
    nat: z.boolean(),
    vpn: z.boolean(),
    server_group: z.boolean(),
    server_transfer: z.boolean(),
})

type UserFormInput = {
    username: string
    role: number
    password: string
    permissions: ModelUserPermissions
}

const baseUserFormSchema = {
    username: z.string().min(1),
    role: z.number().int().min(0).max(1),
    permissions: permissionSchema,
}

export const UserCard: React.FC<UserCardProps> = ({ data, mutate }) => {
    const { t } = useTranslation()
    const userFormSchema = useMemo(
        () =>
            z.object({
                ...baseUserFormSchema,
                password: data ? z.string().max(72) : z.string().min(8).max(72),
            }),
        [data],
    )
    const defaultValues = useMemo<UserFormInput>(
        () => ({
            username: data?.username ?? "",
            role: data?.role ?? 1,
            password: "",
            permissions: permissionsForRole(data?.role ?? 1, data?.permissions),
        }),
        [data],
    )
    const form = useForm<UserFormInput>({
        resolver: zodResolver(userFormSchema),
        defaultValues,
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)
    const role = form.watch("role")

    useEffect(() => {
        if (open) {
            form.reset(defaultValues)
        }
    }, [defaultValues, form, open])

    useEffect(() => {
        if (role === 0) {
            form.setValue("permissions", permissionsForRole(role), {
                shouldDirty: true,
                shouldValidate: true,
            })
        }
    }, [form, role])

    const onSubmit = async (values: UserFormInput) => {
        try {
            const permissions = permissionsForRole(values.role, values.permissions)
            if (data) {
                await updateUser(data.id, {
                    username: values.username,
                    role: values.role,
                    password:
                        form.formState.dirtyFields.password && values.password
                            ? values.password
                            : undefined,
                    permissions,
                })
            } else {
                await createUser({
                    username: values.username,
                    role: values.role,
                    password: values.password,
                    permissions,
                })
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
        form.reset(defaultValues)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <IconButton icon={data ? "edit" : "plus"} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{data ? t("EditUser") : t("NewUser")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Username")}</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Password")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="password"
                                                    autoComplete="new-password"
                                                    placeholder={data ? t("LeaveEmptyNoChange") : ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Role")}</FormLabel>
                                            <Select
                                                onValueChange={(value) =>
                                                    field.onChange(parseInt(value))
                                                }
                                                defaultValue={field.value.toString()}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={t("SelectRole")}
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="0">{t("Admin")}</SelectItem>
                                                    <SelectItem value="1">{t("User")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="rounded-md border p-3">
                                    <div className="mb-3 text-sm font-medium">
                                        {t("UserPermissions")}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {userPermissionKeys.map((key) => (
                                            <label
                                                key={key}
                                                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                                            >
                                                <span className="text-sm">
                                                    {t(`UserPermission.${key}`)}
                                                </span>
                                                <Switch
                                                    checked={
                                                        role === 0 ||
                                                        form.watch(`permissions.${key}`) ||
                                                        false
                                                    }
                                                    disabled={role === 0}
                                                    onCheckedChange={(checked) => {
                                                        form.setValue(
                                                            `permissions.${key}`,
                                                            checked,
                                                            {
                                                                shouldDirty: true,
                                                                shouldValidate: true,
                                                            },
                                                        )
                                                    }}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    {role !== 0 && (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="mt-3"
                                            onClick={() => {
                                                form.setValue("permissions", defaultUserPermissions, {
                                                    shouldDirty: true,
                                                    shouldValidate: true,
                                                })
                                            }}
                                        >
                                            {t("UseDefaultPermissions")}
                                        </Button>
                                    )}
                                </div>
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
