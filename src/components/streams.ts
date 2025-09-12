/**
 * Browser-compatible ReadableStream and WritableStream utilities
 * Uses native browser Streams API instead of Node.js streams
 */
import type { ReadableStream, WritableStream } from "node:stream/web";

export const BrowserReadableStream = globalThis.ReadableStream;
export const BrowserWritableStream = globalThis.WritableStream;

export function isStreamsSupported(): boolean {
  return (
    typeof globalThis.ReadableStream !== "undefined" &&
    typeof globalThis.WritableStream !== "undefined"
  );
}

export interface NodeReadableStream extends ReadableStream<Uint8Array> {
  values: () => AsyncGenerator<Uint8Array, undefined, unknown>;
  [Symbol.asyncIterator]: () => AsyncGenerator<Uint8Array, undefined, unknown>;
}

export function createWebSocketWritableStream(ws: WebSocket): WritableStream<Uint8Array> {
  return new BrowserWritableStream({
    write(chunk: Uint8Array) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    },
    close() {
      ws.close();
    },
    abort() {
      ws.close();
    },
  });
}

export function createWebSocketReadableStream(ws: WebSocket): NodeReadableStream {
  const stream = new BrowserReadableStream<Uint8Array>({
    start(controller) {
      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          controller.enqueue(new Uint8Array(event.data));
        } else if (event.data instanceof Uint8Array) {
          controller.enqueue(event.data);
        } else {
          const encoder = new TextEncoder();
          // HACK append newline b/c of a bug in the ACP server
          controller.enqueue(encoder.encode(`${event.data}\n`));
        }
      };

      ws.onclose = () => {
        controller.close();
      };

      ws.onerror = (error) => {
        controller.error(error);
      };
    },
    cancel() {
      ws.close();
    },
  }) as NodeReadableStream;

  // Add .values() and [Symbol.asyncIterator]
  const values = async function* () {
    const reader = stream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
    return undefined;
  };

  // Attach methods
  stream.values = values;
  stream[Symbol.asyncIterator] = values;

  return stream;
}

// Polyfill check and warning
if (!isStreamsSupported()) {
  console.warn("Streams API not supported in this browser. Consider using a polyfill.");
}
