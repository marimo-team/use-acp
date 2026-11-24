import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebSocketManager } from "../connection/websocket-manager.js";

// Minimal WebSocket stand-in: tests drive open/close/error by hand
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  readyState = 0;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  // Like the browser, closing fires the close event asynchronously
  close() {
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.());
  }

  fail() {
    this.onerror?.({});
    this.readyState = 3;
    this.onclose?.();
  }

  send() {}
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function createManager() {
  const states: string[] = [];
  const manager = new WebSocketManager({
    url: "ws://localhost:3003/message",
    onConnectionStateChange: (state) => states.push(state.status),
    onError: () => {},
    reconnectAttempts: 3,
    reconnectDelay: 100,
  });
  return { manager, states };
}

test("disconnect() does not trigger a reconnect when the close event arrives later", async () => {
  const { manager } = createManager();
  const connecting = manager.connect();
  FakeWebSocket.instances[0]?.open();
  await connecting;

  manager.disconnect();
  await vi.runAllTimersAsync();

  expect(FakeWebSocket.instances).toHaveLength(1);
});

test("disconnect() while still connecting stops retrying", async () => {
  const { manager } = createManager();
  const connecting = manager.connect().catch(() => {});

  manager.disconnect();
  FakeWebSocket.instances[0]?.fail();
  await connecting;
  await vi.runAllTimersAsync();

  expect(FakeWebSocket.instances).toHaveLength(1);
});

test("a failed connection attempt is still retried", async () => {
  const { manager } = createManager();
  const connecting = manager.connect().catch(() => {});

  FakeWebSocket.instances[0]?.fail();
  await connecting;
  await vi.advanceTimersByTimeAsync(100);

  expect(FakeWebSocket.instances).toHaveLength(2);
  manager.disconnect();
});
