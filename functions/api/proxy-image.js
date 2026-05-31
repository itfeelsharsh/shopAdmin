export async function onRequest(context) {
  const { request } = context;
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-AppCheck",
      },
    });
  }

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing URL parameter" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: status ${response.status}` }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to proxy image", details: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
