if (url.pathname === "/customers") {
  const result = await api(
    env,
    `query {
      customers(first: 10) {
        nodes {
          id
        }
      }
    }`
  );

  return json(result.body, result.status);
}
