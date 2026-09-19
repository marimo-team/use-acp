import type { Agent } from "@agentclientprotocol/sdk";
import { expect, test, vi } from "vitest";
import { ListeningAgent } from "../client/acp-client.js";

// Only the methods under test matter; the rest of Agent is never called
function fakeAgent(overrides: Partial<Agent>): Agent {
  return overrides as Agent;
}

test("deleteSession forwards to the agent and reports start/response", async () => {
  const deleteSession = vi.fn().mockResolvedValue({});
  const onStart = vi.fn();
  const onResponse = vi.fn();
  const agent = new ListeningAgent(fakeAgent({ deleteSession }), {
    on_deleteSession_start: onStart,
    on_deleteSession_response: onResponse,
  });

  await agent.deleteSession({ sessionId: "s1" });

  expect(deleteSession).toHaveBeenCalledWith({ sessionId: "s1" });
  expect(onStart).toHaveBeenCalledWith({ sessionId: "s1" });
  expect(onResponse).toHaveBeenCalledWith({}, { sessionId: "s1" });
});

test("deleteSession throws when the agent cannot delete sessions", async () => {
  const agent = new ListeningAgent(fakeAgent({}), {});
  await expect(agent.deleteSession({ sessionId: "s1" })).rejects.toThrow(
    "Agent does not support deleteSession capability",
  );
});

test("closeSession forwards to the agent", async () => {
  const closeSession = vi.fn().mockResolvedValue({});
  const agent = new ListeningAgent(fakeAgent({ closeSession }), {});

  await agent.closeSession({ sessionId: "s1" });

  expect(closeSession).toHaveBeenCalledWith({ sessionId: "s1" });
});
