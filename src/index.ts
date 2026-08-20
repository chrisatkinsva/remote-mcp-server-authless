import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "Thread House Printavo",
    version: "1.0.0",
  });

  server.tool(
    "ping",
    "Test that the Thread House Printavo MCP server is working.",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "Thread House Printavo MCP is working.",
          },
        ],
      };
    }
  );

  return server;
}

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const server = createServer();
    return createMcpHandler(server)(request, env, ctx);
  },
};
