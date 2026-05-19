export default async function (req: Request): Promise<Response> {
  const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://username.github.io";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors });
  }

  const payload = await req.json();
  const code = payload?.code;
  const redirectUri = payload?.redirect_uri;
  if (!code || !redirectUri) {
    return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: Deno.env.get("GITHUB_CLIENT_ID"),
      client_secret: Deno.env.get("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri
    })
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}
