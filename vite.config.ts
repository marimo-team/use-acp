import { defineConfig } from "vitest/config";

export default defineConfig({
  root: process.env.VITEST ? "." : "demo",
  test: {
    environment: "jsdom",
    watch: false,
  },
  base: "/use-acp/",
});
