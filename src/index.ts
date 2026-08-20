type Env = {
  PRINTAVO_TOKEN: string;
  PRINTAVO_EMAIL: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Thread House Printavo API bridge is running");
    }

    if (url.pathname === "/test-printavo") {
      try {
        const response = await fetch("https://www.printavo.com/api/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            email: env.PRINTAVO_EMAIL,
            token: env.PRINTAVO_TOKEN
          },
          body: JSON.stringify({
            query: `
              query {
                account {
                  id
                }
              }
            `
          })
        });

        const body = await response.text();

        return new Response(body, {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
