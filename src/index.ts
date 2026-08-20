type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

async function api(env: Env, query: string, variables: any = {}) {
  const r = await fetch("https://www.printavo.com/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      email: env.PRINTAVO_EMAIL,
      token: env.PRINTAVO_TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  return {
    status: r.status,
    body: await r.text()
  };
}

function json(body: any, status = 200) {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Thread House Printavo bridge running");
    }

    if (url.pathname === "/test") {
      const result = await api(
        env,
        `query {
          account {
            id
          }
        }`
      );

      return json(result.body, result.status);
    }

    if (url.pathname === "/customers") {
  const result = await api(
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
  );

  return json(result.body, result.status);
}

    if (url.pathname === "/graphql" && request.method === "POST") {
      try {
        const body: any = await request.json();

        if (!body.query) {
          return json({ error: "query required" }, 400);
        }

        const result = await api(
          env,
          body.query,
          body.variables || {}
        );

        return json(result.body, result.status);
      } catch (e) {
        return json(
          {
            error: e instanceof Error ? e.message : String(e)
          },
          500
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
