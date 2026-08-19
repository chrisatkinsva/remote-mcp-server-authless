import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

async function printavo(env: Env, query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: env.PRINTAVO_EMAIL,
      token: env.PRINTAVO_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Printavo returned ${response.status}: ${text}`);
  }

  const data = JSON.parse(text);

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data;
}

export class PrintavoMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "Thread House Printavo",
    version: "1.0.0",
  });

  async init() {
    this.server.tool(
      "test_printavo_connection",
      "Test the connection to Thread House Printavo.",
      {},
      async () => {
        const result = await printavo(
          this.env,
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
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );

    this.server.tool(
      "find_orders",
      "Search Thread House Printavo quotes and invoices.",
      {
        query: z.string().describe("Customer, order, or job search"),
      },
      async ({ query }) => {
        const result = await printavo(
          this.env,
          `query SearchOrders($query: String!) {
            orders(first: 20, query: $query) {
              nodes {
                ... on Quote {
                  id
                  visualId
                  customerDueAt
                }
                ... on Invoice {
                  id
                  visualId
                  customerDueAt
                }
              }
            }
          }`,
          { query }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return PrintavoMCP.mount("/mcp").fetch(request, env, ctx);
  },
};
