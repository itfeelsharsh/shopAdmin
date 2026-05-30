/**
 * Payment Gateway Data Proxy — Cloudflare Pages Function (Hosted under admin portal)
 * 
 * Securely proxies requests to Razorpay REST API endpoints:
 * - Payments: GET /v1/payments
 * - Orders: GET /v1/orders
 * - Refunds: GET /v1/refunds
 * - Settlements: GET /v1/settlements
 * - Customers: GET /v1/customers
 * - Invoices: GET /v1/invoices
 * - Disputes: GET /v1/disputes
 * 
 * Supports CORS so it can be queried from localhost development origins as well.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCORSHeaders(request),
    });
  }

  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: getCORSHeaders(request),
    });
  }

  // Read keys. Fallback to REACT_APP prefix if configured that way
  const keyId = env.RAZORPAY_KEY_ID || env.REACT_APP_RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return new Response(
      JSON.stringify({ error: "Razorpay keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) not configured in Cloudflare Pages dashboard for this project." }),
      {
        status: 500,
        headers: getCORSHeaders(request),
      }
    );
  }

  // Extract query parameters
  const type = url.searchParams.get("type"); // e.g. payments, orders, refunds, settlements, customers, invoices, disputes
  
  if (!type) {
    return new Response(
      JSON.stringify({ error: "Missing required query parameter: type" }),
      {
        status: 400,
        headers: getCORSHeaders(request),
      }
    );
  }

  const validTypes = ["payments", "orders", "refunds", "settlements", "customers", "invoices", "disputes"];
  if (!validTypes.includes(type)) {
    return new Response(
      JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }),
      {
        status: 400,
        headers: getCORSHeaders(request),
      }
    );
  }

  try {
    // Reconstruct the search params to forward to Razorpay (like count, skip, from, to, etc.)
    const razorpayParams = new URLSearchParams();
    for (const [key, val] of url.searchParams.entries()) {
      if (key !== "type") {
        razorpayParams.append(key, val);
      }
    }

    const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
    const razorpayUrl = `https://api.razorpay.com/v1/${type}${razorpayParams.toString() ? `?${razorpayParams.toString()}` : ""}`;

    console.log(`[Razorpay Proxy] Fetching from: ${razorpayUrl}`);
    const razorpayResponse = await fetch(razorpayUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error(`[Razorpay Proxy] API error for ${type}:`, errorText);
      return new Response(
        JSON.stringify({ error: `Razorpay API error: ${errorText}` }),
        {
          status: razorpayResponse.status,
          headers: getCORSHeaders(request),
        }
      );
    }

    const data = await razorpayResponse.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: getCORSHeaders(request),
    });
  } catch (err) {
    console.error(`[Razorpay Proxy] Exception in fetching ${type}:`, err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      {
        status: 500,
        headers: getCORSHeaders(request),
      }
    );
  }
}

function getCORSHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
