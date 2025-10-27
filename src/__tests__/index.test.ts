import { expect, test } from "vitest";
import * as exports from "../index.js";

test("snapshot exports", () => {
  expect(exports).toMatchInlineSnapshot(`
    {
      "JsonRpcError": [Function],
      "JsonRpcErrorCodes": {
        "INTERNAL_ERROR": -32603,
        "INVALID_PARAMS": -32602,
        "INVALID_REQUEST": -32600,
        "METHOD_NOT_FOUND": -32601,
        "PARSE_ERROR": -32700,
      },
      "groupNotifications": [Function],
      "mergeToolCalls": [Function],
      "useAcpClient": [Function],
      "useAcpStore": [Function],
    }
  `);
});
