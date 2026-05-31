import { Page, Request, expect, test as base } from "@playwright/test"

export type ApiResponse<T = unknown> = {
    status: number
    ok: boolean
    body: T | string | null
}

export type CommonResponse<T = unknown> = {
    success: boolean
    error?: string
    data?: T
}

export type LoginContext = {
    username: string
    password: string
}

export const defaultAdmin: LoginContext = {
    username: process.env.E2E_ADMIN_USER || "admin",
    password: process.env.E2E_ADMIN_PASS || "admin",
}

export async function loginAs(page: Page, creds: LoginContext) {
    await page.goto("/dashboard/login")
    await page.locator('input[autocomplete="username"]').fill(creds.username)
    await page.locator('input[autocomplete="current-password"]').fill(creds.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/dashboard\/?(?:$|\?|#)/, { timeout: 10_000 })
}

export async function logout(page: Page) {
    await page.context().clearCookies()
}

export async function browserApi<T = unknown>(
    page: Page,
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    data?: unknown,
): Promise<ApiResponse<T>> {
    const result = await page.evaluate(
        async ({ method, path, data }) => {
            const init: RequestInit = { method }
            const headers: Record<string, string> = {}
            if (data !== undefined) {
                headers["Content-Type"] = "application/json"
                init.body = data === null ? null : JSON.stringify(data)
            }
            const csrfPrefix = "nz-csrf="
            const csrfCookie = document.cookie.split("; ").find((item) => item.startsWith(csrfPrefix))
            if (csrfCookie) {
                headers["X-CSRF-Token"] = decodeURIComponent(csrfCookie.slice(csrfPrefix.length))
            }
            if (Object.keys(headers).length > 0) {
                init.headers = headers
            }
            const response = await fetch(path, init)
            const text = await response.text()
            let body: unknown = null
            if (text) {
                try {
                    body = JSON.parse(text)
                } catch {
                    body = text
                }
            }
            return {
                status: response.status,
                ok: response.ok,
                body,
            }
        },
        { method, path, data },
    )
    return result as ApiResponse<T>
}

export async function browserApiPost<T = unknown>(page: Page, path: string, data?: unknown): Promise<ApiResponse<T>> {
    return await browserApi<T>(page, "POST", path, data)
}

export function responseSummary(resp: ApiResponse) {
    return `status=${resp.status} body=${typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body)}`
}

export async function expectAuthenticated(page: Page) {
    const resp = await page.request.get("/api/v1/profile")
    expect(resp.status(), "profile must respond 2xx while authenticated").toBeLessThan(400)
    const body = await resp.json()
    expect(body.success, "profile.success must be true").toBe(true)
    expect(body.data?.id, "profile.data.id must be present").toBeTruthy()
}

export async function expectUnauthenticated(page: Page) {
    const resp = await page.request.get("/api/v1/profile")
    const body = await resp.json()
    expect(body.success, "profile must NOT be authorized after revoke").not.toBe(true)
    expect(body.error, "profile must surface an error after revoke").toBeTruthy()
}

export async function findRequest(
    page: Page,
    matcher: (req: Request) => boolean,
    trigger: () => Promise<void>,
    timeoutMs = 5000,
): Promise<Request> {
    const waiter = page.waitForRequest(matcher, { timeout: timeoutMs })
    await trigger()
    return await waiter
}

export const test = base.extend<{ adminPage: Page }>({
    adminPage: async ({ page }, runFixture) => {
        await loginAs(page, defaultAdmin)
        await runFixture(page)
    },
})
