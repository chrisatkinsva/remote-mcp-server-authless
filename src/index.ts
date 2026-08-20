type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS
    }
  });
}

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
    body: JSON.stringify({
      query,
      variables
    })
  });

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(`Printavo HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data;
}

async function findContact(env: Env, name: string) {
  const result: any = await printavo(
    env,
    `
      query FindContact($query: String!) {
        contacts(
          first: 25
          query: $query
          primaryOnly: true
        ) {
          nodes {
            id
            fullName
            email
            phone
            customer {
              id
              companyName
            }
          }
        }
      }
    `,
    {
      query: name
    }
  );

  const contacts = result.data.contacts.nodes || [];

  if (contacts.length === 0) {
    return null;
  }

  const exact = contacts.find(
    (contact: any) =>
      String(contact.fullName || "").trim().toLowerCase() ===
      name.trim().toLowerCase()
  );

  return exact || contacts[0];
}

async function createCustomer(env: Env, name: string) {
  const parts = name.trim().split(/\s+/);

  const firstName = parts.shift() || name;
  const lastName = parts.join(" ");

  const result: any = await printavo(
    env,
    `
      mutation CreateCustomer($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
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
    `,
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

  return result.data.customerCreate.primaryContact;
}

async function getContact(
  env: Env,
  name: string,
  existingCustomer: boolean
) {
  const existing = await findContact(env, name);

  if (existing) {
    return existing;
  }

  if (existingCustomer) {
    throw new Error(
      `Existing customer "${name}" was not found. No duplicate was created.`
    );
  }

  return createCustomer(env, name);
}

async function createQuote(env: Env, order: any) {
  const contact = await getContact(
    env,
    order.customer,
    Boolean(order.existingCustomer)
  );

  const lineItems = order.items.map((item: any, index: number) => ({
    position: index + 1,
    itemNumber: item.itemNumber || "",
    description: item.description || "",
    color: item.color || "",
    price: Number(item.price ?? 0),
    taxed: Boolean(item.taxed ?? false),
    sizes: [
      {
        size: item.size || "OS",
        count: Number(item.quantity)
      }
    ]
  }));

  const input = {
    contact: {
      id: contact.id
    },
    nickname: order.nickname,
    customerDueAt: order.customerDueAt,
    dueAt: `${order.customerDueAt}T17:00:00-04:00`,
    customerNote: order.customerNote || "",
    productionNote: order.productionNote || "",
    lineItemGroups: [
      {
        position: 1,
        lineItems
      }
    ]
  };

  const result: any = await printavo(
    env,
    `
      mutation CreateQuote($input: QuoteCreateInput!) {
        quoteCreate(input: $input) {
          id
          visualId
          nickname
          customerDueAt
          dueAt
          publicUrl
          total
          totalQuantity
          contact {
            id
            fullName
            email
            phone
          }
        }
      }
    `,
    {
      input
    }
  );

  return result.data.quoteCreate;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/") {
        return new Response("Thread House Printavo bridge running", {
          headers: CORS_HEADERS
        });
      }

      if (url.pathname === "/test" && request.method === "GET") {
        const result = await printavo(
          env,
          `
            query {
              account {
                id
              }
            }
          `
        );

        return json(result);
      }

      if (url.pathname === "/customers" && request.method === "GET") {
        const result = await printavo(
          env,
          `
            query {
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
            }
          `
        );

        return json(result);
      }

      if (url.pathname === "/find-contact" && request.method === "GET") {
        const name = url.searchParams.get("name");

        if (!name) {
          return json({ error: "name is required" }, 400);
        }

        const contact = await findContact(env, name);

        return json({
          found: Boolean(contact),
          contact
        });
      }

      if (url.pathname === "/create-order" && request.method === "POST") {
        const order: any = await request.json();

        if (!order.customer) {
          return json({ error: "customer is required" }, 400);
        }

        if (!order.nickname) {
          return json({ error: "nickname is required" }, 400);
        }

        if (!order.customerDueAt) {
          return json({ error: "customerDueAt is required" }, 400);
        }

        if (!Array.isArray(order.items) || order.items.length === 0) {
          return json({ error: "items are required" }, 400);
        }

        for (const item of order.items) {
          if (!item.quantity || Number(item.quantity) < 1) {
            return json(
              {
                error: `Invalid quantity for item: ${
                  item.description || item.itemNumber || "unknown"
                }`
              },
              400
            );
          }
        }

        const quote = await createQuote(env, order);

        return json({
          success: true,
          quote
        });
      }

      return json({ error: "Not Found" }, 404);
    } catch (error) {
      return json(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  }
};
