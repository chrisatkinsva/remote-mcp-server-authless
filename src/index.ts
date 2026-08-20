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

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Thread House Printavo bridge running");
    }

    if (url.pathname === "/test-printavo") {
      return printavo(
        env,
        `query {
          account {
            id
          }
        }`
      );
    }

    if (url.pathname === "/customers" && request.method === "GET") {
      const search = url.searchParams.get("search") || "";

      return printavo(
        env,
        `query Customers($search: String) {
          customers(search: $search) {
            id
            firstName
            lastName
            company
            email
            phone
          }
        }`,
        { search }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
};
