import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

function createServer() {
  const server = new McpServer({
    name: "Thread House Printavo",
    version: "1.0.0",
  });

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(createServer, {
      route: "/mcp",
    })(request, env, ctx);
  },
};
