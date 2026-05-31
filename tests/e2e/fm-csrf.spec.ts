import { expect } from "@playwright/test"

import { CommonResponse, browserApiPost, responseSummary, test } from "./fixtures"

test("file manager creation only accepts POST", async ({ adminPage: page }) => {
    const getResp = await page.request.get("/api/v1/file?id=1", {
        failOnStatusCode: false,
    })
    expect(
        getResp.status() === 404 || getResp.status() === 405,
        `GET /api/v1/file must no longer be routable (got ${getResp.status()})`,
    ).toBeTruthy()

    const postResp = await browserApiPost<CommonResponse>(page, "/api/v1/file?id=1")
    expect(postResp.status, responseSummary(postResp)).toBe(200)
    const body = postResp.body as CommonResponse
    expect(body.success, "without a connected agent server the POST surfaces a Service error, but the route is reachable").not.toBe(true)
    expect(body.error).toBeTruthy()
})
