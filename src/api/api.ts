interface CommonResponse<T> {
    success: boolean
    error: string
    data: T
}

function buildUrl(path: string, data?: any): string {
    if (!data) return path
    const url = new URL(window.location.origin + path)
    for (const key in data) {
        url.searchParams.append(key, data[key])
    }
    return url.toString()
}

const csrfCookieName = "nz-csrf"
const csrfHeaderName = "X-CSRF-Token"

function getCookie(name: string): string {
    if (typeof document === "undefined" || !document.cookie) return ""
    const prefix = `${encodeURIComponent(name)}=`
    const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix))
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ""
}

function buildUnsafeHeaders(includeJson: boolean): HeadersInit {
    const headers: Record<string, string> = {}
    if (includeJson) {
        headers["Content-Type"] = "application/json"
    }
    const csrfToken = getCookie(csrfCookieName)
    if (csrfToken) {
        headers[csrfHeaderName] = csrfToken
    }
    return headers
}

export enum FetcherMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
}

let lastestRefreshTokenAt = 0

function clearCookies() {
    document.cookie.split(";").forEach((cookie) => {
        document.cookie = cookie
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
}

function redirectToLogin() {
    if (typeof window === "undefined") return
    clearCookies()
    if (!window.location.pathname.startsWith("/dashboard/login")) {
        window.location.replace("/dashboard/login")
    }
}

export async function fetcher<T>(method: FetcherMethod, path: string, data?: any): Promise<T> {
    let response
    if (method === FetcherMethod.GET || method === FetcherMethod.DELETE) {
        response = await fetch(buildUrl(path, data), {
            method: "GET",
        })
    } else {
        response = await fetch(path, {
            method: method,
            headers: buildUnsafeHeaders(true),
            body: data ? JSON.stringify(data) : null,
        })
    }
    if (response.status === 401 || response.status === 403) {
        redirectToLogin()
        throw new Error("ApiErrorUnauthorized")
    }
    if (!response.ok) {
        throw new Error(response.statusText)
    }
    const responseData: CommonResponse<T> = await response.json()
    if (!responseData.success) {
        if (responseData.error === "ApiErrorUnauthorized") {
            redirectToLogin()
        }
        throw new Error(responseData.error)
    }

    // auto refresh token
    if (
        document.cookie &&
        (!lastestRefreshTokenAt || Date.now() - lastestRefreshTokenAt > 1000 * 60 * 60)
    ) {
        lastestRefreshTokenAt = Date.now()
        fetch("/api/v1/refresh-token")
    }

    return responseData.data
}

export async function swrFetcher<T>(input: string | URL | globalThis.Request, init?: RequestInit) {
    return fetcher<T>(init?.method as FetcherMethod, input.toString(), init?.body)
}
