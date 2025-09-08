# use-acp

React hooks for [Agent Client Protocol](https://agentclientprotocol.com/) (ACP) over WebSockets.

## Features

- WebSocket connection management
- Reactive state management
- Notifications timeline for ACP events
- Permission request/response handling
- Full TypeScript support

## Installation

```bash
npm install use-acp
# or
pnpm add use-acp
```

## Usage

### Basic Usage

```tsx
import { useAcpClient } from 'use-acp';

function App() {
  const {
    connect,
    disconnect,
    connectionState,
    notifications,
    pendingPermission,
    resolvePermission,
  } = useAcpClient({
    wsUrl: 'ws://localhost:8080',
    autoConnect: true
  });

  return (
    <div>
      <div>Status: {connectionState.status}</div>
      <button onClick={connectionState.status === 'connected' ? disconnect : connect}>
        {connectionState.status === 'connected' ? 'Disconnect' : 'Connect'}
      </button>

      {pendingPermission && (
        <div>
          <h3>Permission Request</h3>
          {pendingPermission.options.map((option) => (
            <button key={option.optionId} onClick={() => resolvePermission(option)}>
              {option.name}
            </button>
          ))}
        </div>
      )}

      <div>Notifications: {notifications.length}</div>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>{JSON.stringify(notification)}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API Reference

### `useAcpClient({ wsUrl, autoConnect?, reconnectAttempts?, reconnectDelay? })`

**Returns:** `{ connect(), disconnect(), connectionState, notifications, clearNotifications(), pendingPermission, resolvePermission(), rejectPermission(), agent }`

### Utils

```tsx
import { groupNotifications, mergeToolCalls } from 'use-acp';

// Group notifications by their type
// This helps when displaying notifications in a timeline
const groupedNotifications = groupNotifications(notifications);

// Merge tool calls with the same toolCallId
const mergedToolCalls = mergeToolCalls(toolCalls);
```

## Development

```bash
pnpm install
pnpm test      # run tests
pnpm build     # build library
pnpm dev       # run demo, http://localhost:5173
```

### Example Agents

```bash
# Gemini ACP
npx -y supergateway --stdio "npx @google/gemini-cli --experimental-acp" --outputTransport ws

# Claude Code ACP
npx -y supergateway --stdio "npx @zed-industries/claude-code-acp" --outputTransport ws
```

## License

Apache 2.0
