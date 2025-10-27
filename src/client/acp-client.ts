import type {
  Agent,
  AuthenticateRequest,
  CancelNotification,
  Client,
  InitializeRequest,
  InitializeResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  SetSessionModelRequest,
  SetSessionModelResponse,
  SetSessionModeRequest,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@agentclientprotocol/sdk";
import { Deferred } from "../utils/deferred.js";
import { JsonRpcError } from "../utils/jsonrpc-error.js";

export interface AcpClientOptions {
  onRequestPermission: (params: IdentifiedPermissionRequest) => void;
  onSessionNotification: (params: SessionNotification) => void;
  onRpcError?: (error: JsonRpcError) => void;
  readTextFile?: (params: ReadTextFileRequest) => Promise<ReadTextFileResponse>;
  writeTextFile?: (params: WriteTextFileRequest) => Promise<WriteTextFileResponse>;
}

export interface IdentifiedPermissionRequest extends RequestPermissionRequest {
  deferredId: string;
}

export type PermissionRequestId = IdentifiedPermissionRequest["deferredId"];

export class AcpClient implements Client {
  public agent: Agent;
  private readonly options: AcpClientOptions;
  private readonly pendingPermissions = new Map<
    PermissionRequestId,
    Deferred<RequestPermissionResponse>
  >();

  constructor(agent: Agent, options: AcpClientOptions) {
    this.agent = agent;
    this.options = options;
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    this.options.onSessionNotification(params);
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    if (this.options.writeTextFile) {
      return this.options.writeTextFile(params);
    }
    throw new Error("Write text file handler not implemented");
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    if (this.options.readTextFile) {
      return this.options.readTextFile(params);
    }
    throw new Error("Read text file handler not implemented");
  }

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const permissionId: PermissionRequestId = `${Date.now()}-${Math.random()}`;
    const deferred = new Deferred<RequestPermissionResponse>();

    this.pendingPermissions.set(permissionId, deferred);
    this.options.onRequestPermission({ ...params, deferredId: permissionId });

    return deferred.promise;
  }

  resolvePermission(permissionId: PermissionRequestId, response: RequestPermissionResponse) {
    const deferred = this.pendingPermissions.get(permissionId);
    if (deferred) {
      this.pendingPermissions.delete(permissionId);
      deferred.resolve(response);
    }
  }

  rejectPermission(permissionId: PermissionRequestId, error: Error) {
    const deferred = this.pendingPermissions.get(permissionId);
    if (deferred) {
      this.pendingPermissions.delete(permissionId);
      deferred.reject(error);
    }
  }
}

type RequiredAgent = Required<Agent>;

type ListeningAgentCallbacks = {
  [K in keyof RequiredAgent as `on_${string & K}_response`]: RequiredAgent[K] extends (
    // biome-ignore lint/suspicious/noExplicitAny: any for typing
    ...args: any[]
  ) => infer R
    ? (response: Awaited<R>, request: Parameters<RequiredAgent[K]>[0]) => void
    : never;
} & {
  [K in keyof RequiredAgent as `on_${string & K}_start`]: RequiredAgent[K] extends (
    // biome-ignore lint/suspicious/noExplicitAny: any for typing
    ...args: any[]
  ) => unknown
    ? (request: Parameters<RequiredAgent[K]>[0]) => void
    : never;
} & {
  on_rpc_error?: (error: JsonRpcError) => void;
};

/**
 * Try to extract JSON-RPC error from any error object
 */
function toJsonRpcError(error: unknown): JsonRpcError | null {
  if (error instanceof JsonRpcError) {
    return error;
  }

  if (error instanceof Error) {
    return new JsonRpcError({
      code: -32603,
      message: error.message,
      data: error.stack,
    });
  }

  // Check if it's an error object with code, message, and optionally data
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "number" &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const errorObj = error as Record<string, unknown>;
    return new JsonRpcError(
      {
        code: errorObj.code as number,
        message: errorObj.message as string,
        data: errorObj.data,
      },
      undefined,
    );
  }

  return null;
}

export class ListeningAgent implements Required<Agent> {
  constructor(
    private readonly agent: Agent,
    private readonly callbacks: Partial<ListeningAgentCallbacks>,
  ) {}

  /**
   * Wraps an async agent call with JSON-RPC error handling
   */
  private handleCatchRpcError(methodName: string) {
    return (error: unknown) => {
      // Try to extract JSON-RPC error
      const jsonRpcError = toJsonRpcError(error);
      if (jsonRpcError) {
        console.error(`[acp] JSON-RPC error in ${methodName}:`, jsonRpcError);
        this.callbacks.on_rpc_error?.(jsonRpcError);
        throw jsonRpcError;
      }
      // Re-throw if not a JSON-RPC error
      throw error;
    };
  }

  extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.agent.extMethod) {
      return this.agent.extMethod(method, params);
    }
    return Promise.resolve({});
  }
  extNotification(method: string, params: Record<string, unknown>): Promise<void> {
    if (this.agent.extNotification) {
      return this.agent.extNotification(method, params);
    }
    return Promise.resolve();
  }

  async setSessionMode(params: SetSessionModeRequest) {
    this.callbacks.on_setSessionMode_start?.(params);
    const response = await this.agent
      .setSessionMode?.(params)
      .catch(this.handleCatchRpcError("setSessionMode"));
    this.callbacks.on_setSessionMode_response?.(response, params);
    return response;
  }

  async setSessionModel(
    params: SetSessionModelRequest,
    // biome-ignore lint/suspicious/noConfusingVoidType: Matches Agent interface signature
  ): Promise<SetSessionModelResponse | void> {
    this.callbacks.on_setSessionModel_start?.(params);
    const result = await this.agent
      .setSessionModel?.(params)
      .catch(this.handleCatchRpcError("setSessionModel"));
    this.callbacks.on_setSessionModel_response?.(result, params);
    return result;
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    this.callbacks.on_initialize_start?.(params);
    const response = await this.agent
      .initialize(params)
      .catch(this.handleCatchRpcError("initialize"));
    this.callbacks.on_initialize_response?.(response, params);
    return response;
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    this.callbacks.on_newSession_start?.(params);
    const response = await this.agent
      .newSession(params)
      .catch(this.handleCatchRpcError("newSession"));
    this.callbacks.on_newSession_response?.(response, params);
    return response;
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.callbacks.on_loadSession_start?.(params);
    if (this.agent.loadSession) {
      const response = await this.agent
        .loadSession(params)
        .catch(this.handleCatchRpcError("loadSession"));
      this.callbacks.on_loadSession_response?.(response, params);
      return response;
    }
    throw new Error("Agent does not support loadSession capability");
  }

  async authenticate(params: AuthenticateRequest): Promise<void> {
    this.callbacks.on_authenticate_start?.(params);
    await this.agent.authenticate(params).catch(this.handleCatchRpcError("authenticate"));
    this.callbacks.on_authenticate_response?.(undefined, params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    this.callbacks.on_prompt_start?.(params);
    const response = await this.agent.prompt(params).catch(this.handleCatchRpcError("prompt"));
    this.callbacks.on_prompt_response?.(response, params);
    return response;
  }

  async cancel(params: CancelNotification): Promise<void> {
    this.callbacks.on_cancel_start?.(params);
    await this.agent.cancel(params).catch(this.handleCatchRpcError("cancel"));
    this.callbacks.on_cancel_response?.(undefined, params);
  }
}
