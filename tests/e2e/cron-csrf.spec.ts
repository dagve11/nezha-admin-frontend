import { expect } from "@playwright/test"

import { CommonResponse, browserApiPost, responseSummary, test } from "./fixtures"

test("manual cron trigger goes through POST, not GET", async ({ adminPage: page }) => {
    const created = await browserApiPost<CommonResponse<number>>(page, "/api/v1/cron", {
        name: "e2e-cron-csrf",
        task_type: 0,
        scheduler: "@every 1h",
        command: "true",
        servers: [],
        cover: 0,
        push_successful: false,
        notification_group_id: 0,
    })
    expect(created.ok && (created.body as CommonResponse<number>).success, `create cron via POST must succeed: ${responseSummary(created)}`).toBeTruthy()
    const cronID = (created.body as CommonResponse<number>).data
    expect(typeof cronID).toBe("number")

    try {
        const getResp = await page.request.get(`/api/v1/cron/${cronID}/manual`, {
            failOnStatusCode: false,
        })
        expect(
            getResp.status() === 404 || getResp.status() === 405,
            `GET must no longer be routable (got ${getResp.status()})`,
        ).toBeTruthy()

        const postResp = await browserApiPost<CommonResponse>(page, `/api/v1/cron/${cronID}/manual`)
        expect(postResp.ok, `POST must succeed: ${responseSummary(postResp)}`).toBeTruthy()
        const body = postResp.body as CommonResponse
        expect(body.success).toBe(true)
    } finally {
        await browserApiPost(page, "/api/v1/batch-delete/cron", [cronID])
    }
})
