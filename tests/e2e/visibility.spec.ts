import { expect } from "@playwright/test"

import { CommonResponse, browserApiPost, responseSummary, test } from "./fixtures"

test("server-group hides guest-empty groups from anonymous callers", async ({ adminPage: page, browser }) => {
    const tag = Date.now().toString(36)
    const visibleName = `e2e-visible-${tag}`
    const hiddenName = `e2e-hidden-${tag}`

    // Admin creates one group with no servers (will be guest-empty) and one with a public server.
    // First make sure there's at least one public server visible to guests; if not, this whole
    // scenario boils down to "no group is guest-visible", which the assertion below still covers.
    const serversResp = await page.request.get("/api/v1/server")
    expect(serversResp.ok()).toBeTruthy()
    const serversBody = (await serversResp.json()) as { data: Array<{ id: number; hide_for_guest?: boolean }> }
    const publicServer = serversBody.data?.find((s) => !s.hide_for_guest)

    const createdGroupIDs: number[] = []
    if (publicServer) {
        const visibleResp = await browserApiPost<CommonResponse<number>>(page, "/api/v1/server-group", { name: visibleName, servers: [publicServer.id] })
        expect(visibleResp.ok && (visibleResp.body as CommonResponse<number>).success, responseSummary(visibleResp)).toBeTruthy()
        createdGroupIDs.push((visibleResp.body as CommonResponse<number>).data as number)
    }
    const hiddenResp = await browserApiPost<CommonResponse<number>>(page, "/api/v1/server-group", { name: hiddenName, servers: [] })
    expect(hiddenResp.ok && (hiddenResp.body as CommonResponse<number>).success, responseSummary(hiddenResp)).toBeTruthy()
    createdGroupIDs.push((hiddenResp.body as CommonResponse<number>).data as number)

    try {
        const guestCtx = await browser.newContext()
        try {
            const guestResp = await guestCtx.request.get("/api/v1/server-group")
            expect(guestResp.ok()).toBeTruthy()
            const guestBody = (await guestResp.json()) as {
                data: Array<{ group: { name: string }; servers: number[] }>
            }
            const names = (guestBody.data || []).map((it) => it.group.name)
            expect(names, "guest must NOT see groups with zero visible servers").not.toContain(hiddenName)
            if (publicServer) {
                expect(names, "guest still sees groups that contain a guest-visible server").toContain(visibleName)
            }
        } finally {
            await guestCtx.close()
        }
    } finally {
        if (createdGroupIDs.length > 0) {
            await browserApiPost(page, "/api/v1/batch-delete/server-group", createdGroupIDs)
        }
    }
})
