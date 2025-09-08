import { expect, test } from "vitest";
import * as exports from "../index.js";

test("snapshot exports", () => {
  expect(exports).toMatchInlineSnapshot(`
    {
      "groupNotifications": [Function],
      "mergeToolCalls": [Function],
      "useAcpClient": [Function],
      "useAcpStore": [Function],
    }
  `);
});
