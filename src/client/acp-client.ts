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
  SetSessionModeRequest,
  SetSessionModeResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "@zed-industries/agent-client-protocol/typescript/acp.js";
import { Deferred } from "../utils/deferred.js";

export interface AcpClientOptions {
  onRequestPermission: (params: IdentifiedPermissionRequest) => void;
  onSessionNotification: (params: SessionNotification) => void;
  readTextFile?: (params: ReadTextFileRequest) => Promise<ReadTextFileResponse>;
  writeTextFile?: (params: WriteTextFileRequest) => Promise<WriteTextFileResponse>;
}

export interface IdentifiedPermissionRequest extends RequestPermissionRequest {
  id: string;
}

export type PermissionRequestId = IdentifiedPermissionRequest["id"];

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
    this.options.onRequestPermission({ ...params, id: permissionId });

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
} & {};

export class ListeningAgent implements Required<Agent> {
  constructor(
    private readonly agent: Agent,
    private readonly callbacks: Partial<ListeningAgentCallbacks>,
  ) {}

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
    return this.agent.setSessionMode?.(params).then((response) => {
      this.callbacks.on_setSessionMode_response?.(response, params);
      return response;
    });
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    this.callbacks.on_initialize_start?.(params);
    return this.agent.initialize(params).then((response) => {
      this.callbacks.on_initialize_response?.(response, params);
      return response;
    });
  }
  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    this.callbacks.on_newSession_start?.(params);
    return this.agent.newSession(params).then((response) => {
      this.callbacks.on_newSession_response?.(response, params);
      return response;
    });
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    this.callbacks.on_loadSession_start?.(params);
    if (this.agent.loadSession) {
      return this.agent.loadSession(params).then((response) => {
        this.callbacks.on_loadSession_response?.(response, params);
        return response;
      });
    }
    throw new Error("Agent does not support loadSession capability");
  }

  async authenticate(params: AuthenticateRequest): Promise<void> {
    this.callbacks.on_authenticate_start?.(params);
    return this.agent.authenticate(params).then(() => {
      this.callbacks.on_authenticate_response?.(undefined, params);
    });
  }
  async prompt(params: PromptRequest): Promise<PromptResponse> {
    this.callbacks.on_prompt_start?.(params);
    return this.agent.prompt(params).then((response) => {
      this.callbacks.on_prompt_response?.(response, params);
      return response;
    });
  }
  async cancel(params: CancelNotification): Promise<void> {
    this.callbacks.on_cancel_start?.(params);
    return this.agent.cancel(params).then(() => {
      this.callbacks.on_cancel_response?.(undefined, params);
    });
  }
}
