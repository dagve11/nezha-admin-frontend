import { expectTypeOf, test } from "vitest"

import type { ModelSettingResponse } from "@/types"

test("setting response includes TSDB status", () => {
    expectTypeOf<ModelSettingResponse>().toHaveProperty("tsdb_enabled").toEqualTypeOf<boolean>()
})
