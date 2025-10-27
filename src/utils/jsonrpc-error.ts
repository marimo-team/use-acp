/**
 * JSON-RPC 2.0 error structure
 */
export interface JsonRpcErrorData {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  error: JsonRpcErrorData;
}

/**
 * Custom Error class for JSON-RPC errors
 */
export class JsonRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;
  public readonly id?: number | string | null;

  constructor(error: JsonRpcErrorData, id?: number | string | null) {
    super(typeof error.data === "string" ? error.data : error.message);
    this.name = "JsonRpcError";
    this.code = error.code;
    this.data = error.data;
    this.id = id;
  }

  /**
   * Check if an error is a JSON-RPC error
   */
  static isJsonRpcError(error: unknown): error is JsonRpcError {
    return error instanceof JsonRpcError;
  }

  /**
   * Convert to a plain object
   */
  toJSON(): JsonRpcErrorResponse {
    return {
      jsonrpc: "2.0",
      id: this.id ?? null,
      error: {
        code: this.code,
        message: this.message,
        data: this.data,
      },
    };
  }
}

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
