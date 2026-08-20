import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

async function printavo(
  env: Env,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const response = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: env.PRINTAVO_EMAIL,
      token: env.PRINTAVO_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Printavo HTTP ${response.status}: ${JSON.stringify(result)}`);
  }

  return result;
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "Thread House Printavo",
    version: "1.0.0"
  });

  server.registerTool(
    "test_printavo_connection",
    {
      description: "Test the Thread House connection to Printavo.",
      inputSchema: z.object({})
    },
    async () => {
      const result = await printavo(
        env,
        `query {
          account {
            id
          }
        }`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(() => createServer(env), {
      route: "/mcp"
    })(request, env, ctx);
  }
};
