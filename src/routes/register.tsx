import { register } from "@/api/user"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import i18next from "i18next"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"

const registerFormSchema = z
    .object({
        username: z.string().min(2, {
            message: i18next.t("Results.UsernameMin", { number: 2 }),
        }),
        password: z.string().min(6, {
            message: i18next.t("Results.PasswordMin", { number: 6 }),
        }),
        confirmPassword: z.string().min(1, {
            message: i18next.t("Results.PasswordRequired"),
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: i18next.t("Results.PasswordMismatch"),
        path: ["confirmPassword"],
    })

function Register() {
    const navigate = useNavigate()
    const { t } = useTranslation()

    const form = useForm<z.infer<typeof registerFormSchema>>({
        resolver: zodResolver(registerFormSchema),
        defaultValues: {
            username: "",
            password: "",
            confirmPassword: "",
        },
    })

    async function onSubmit(values: z.infer<typeof registerFormSchema>) {
        try {
            await register({
                username: values.username,
                password: values.password,
            })
            toast.success(t("RegisterSuccess"))
            navigate("/dashboard/login", { replace: true })
        } catch (error: any) {
            toast.error(error?.message || t("NetworkError"))
        }
    }

    return (
        <div className="mt-28 m-auto max-w-xs sm:max-w-sm">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">{t("Register")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{t("RegisterDescription")}</p>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("Username")}</FormLabel>
                                <FormControl>
                                    <Input autoComplete="username" {...field} />
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
                                    <Input type="password" autoComplete="new-password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("ConfirmPassword")}</FormLabel>
                                <FormControl>
                                    <Input type="password" autoComplete="new-password" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button
                        type="submit"
                        className="w-full rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    >
                        {t("CreateAccount")}
                    </Button>
                </form>
            </Form>
            <div className="mt-5 text-center text-sm text-muted-foreground">
                {t("AlreadyHaveAccount")}{" "}
                <Link to="/dashboard/login" className="font-medium text-primary hover:underline">
                    {t("Login")}
                </Link>
            </div>
        </div>
    )
}

export default Register
