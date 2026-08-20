type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

async function printavo(env: Env, query: string, variables: any = {}) {
  const response = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: env.PRINTAVO_EMAIL,
      token: env.PRINTAVO_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  return await response.json();
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function findContact(env: Env, name: string) {
  const result: any = await printavo(
    env,
    `query FindContact($query: String!) {
      contacts(first: 10, query: $query, primaryOnly: true) {
        nodes {
          id
          fullName
          email
          phone
        }
      }
    }`,
    { query: name }
  );

  return result?.data?.contacts?.nodes?.[0] || null;
}

async function createCustomer(env: Env, name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || name;
  const lastName = parts.join(" ");

  const result: any = await printavo(
    env,
    `mutation CreateCustomer($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        id
        companyName
        primaryContact {
          id
          fullName
        }
      }
    }`,
    {
      input: {
        companyName: name,
        primaryContact: {
          firstName,
          lastName
        }
      }
    }
  );

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }

  return result.data.customerCreate.primaryContact;
}

async function getOrCreateContact(env: Env, name: string) {
  const existing = await findContact(env, name);
  if (existing) return existing;

  return await createCustomer(env, name);
}

async function createQuote(env: Env, order: any) {
  const contact = await getOrCreateContact(env, order.customer);

  const result: any = await printavo(
    env,
    `mutation CreateQuote($input: QuoteCreateInput!) {
      quoteCreate(input: $input) {
        id
        visualId
        nickname
        customerDueAt
        dueAt
        publicUrl
        contact {
          id
          fullName
        }
        lineItemGroups(first: 20) {
          nodes {
            id
            lineItems(first: 50) {
              nodes {
                id
                description
                itemNumber
                color
                items
                price
              }
            }
          }
        }
      }
    }`,
    {
      input: {
        contact: { id: contact.id },
        nickname: order.nickname,
        customerDueAt: order.customerDueAt,
        dueAt: `${order.customerDueAt}T17:00:00-04:00`,
        customerNote: order.customerNote || "",
        productionNote: order.productionNote || "",
        lineItemGroups: [
          {
            position: 1,
            lineItems: order.items.map((item: any, index: number) => ({
              position: index + 1,
              itemNumber: item.itemNumber || "",
              description: item.description,
              color: item.color || "",
              price: 0,
              taxed: false,
              sizes: [
                {
                  size: "OS",
                  count: item.quantity
                }
              ]
            }))
          }
        ]
      }
    }
  );

  return result;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Thread House Printavo bridge running");
    }

    if (url.pathname === "/test") {
      return json(
        await printavo(
          env,
          `query {
            account {
              id
            }
          }`
        )
      );
    }

    if (url.pathname === "/customers") {
      return json(
        await printavo(
          env,
          `query {
            customers(first: 100) {
              nodes {
                id
                companyName
                primaryContact {
                  id
                  fullName
                  email
                  phone
                }
              }
            }
          }`
        )
      );
    }

    if (url.pathname === "/create-order" && request.method === "POST") {
      try {
        const order: any = await request.json();

        if (!order.customer || !order.nickname || !order.customerDueAt) {
          return json(
            { error: "customer, nickname and customerDueAt required" },
            400
          );
        }

        if (!Array.isArray(order.items) || order.items.length === 0) {
          return json({ error: "At least one item required" }, 400);
        }

        return json(await createQuote(env, order));
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : String(error)
          },
          500
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
