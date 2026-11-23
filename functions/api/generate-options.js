function getCORSHeaders(request) {
  const origin = request?.headers?.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-AppCheck",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

const MAX_GROUPS = 5;
const MAX_VALUES = 12;
const MAX_NAME_LENGTH = 48;
const MAX_VALUE_LENGTH = 48;

const cleanText = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeOptions = (input) => {
  const list = Array.isArray(input)
    ? input
    : Array.isArray(input?.options)
      ? input.options
      : [];

  const byName = new Map();

  for (const raw of list.slice(0, MAX_GROUPS * 2)) {
    const name = cleanText(raw?.name).slice(0, MAX_NAME_LENGTH);
    if (!name) continue;

    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { name, values: [], required: raw?.required !== false });
    }

    const group = byName.get(key);
    for (const rawValue of Array.isArray(raw?.values) ? raw.values : []) {
      const isObject = rawValue && typeof rawValue === "object";
      const label = cleanText(
        isObject ? rawValue.label ?? rawValue.value ?? rawValue.name : rawValue
      ).slice(0, MAX_VALUE_LENGTH);
      if (!label) continue;
      if (group.values.some((existing) => existing.label.toLowerCase() === label.toLowerCase())) continue;
      if (group.values.length >= MAX_VALUES) break;

      const rawDelta = isObject
        ? rawValue.priceDelta ?? rawValue.price_delta ?? rawValue.extraPrice ?? 0
        : 0;
      const numericDelta = Number(rawDelta);

      group.values.push({
        label,
        priceDelta: Number.isFinite(numericDelta) ? Math.round(numericDelta) : 0,
      });
    }
  }

  return Array.from(byName.values())
    .filter((group) => group.values.length >= 1)
    .slice(0, MAX_GROUPS)
    .map((group) => {
      const cheapest = Math.min(...group.values.map((value) => value.priceDelta));
      if (cheapest !== 0) {
        group.values = group.values.map((value) => ({
          ...value,
          priceDelta: value.priceDelta - cheapest,
        }));
      }
      return group;
    });
};

const stripCodeFence = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

async function callGemini({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.35,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini ${response.status}: ${details.slice(0, 240)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callXai({ apiKey, model, prompt }) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.35,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`xAI ${response.status}: ${details.slice(0, 240)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function buildPrompt({ name, category, brand, basePrice, existingOptions, catalogueOptions }) {
  return `You are KamiKoto's product merchandising engine. Work out the REAL purchasable option groups for one product.

Product name: ${name || "Unknown"}
Category: ${category || "Unknown"}
Brand: ${brand || "Unknown"}
Base selling price (INR): ${basePrice ? `₹${basePrice}` : "Unknown"}

Options currently on this product:
${JSON.stringify(existingOptions).slice(0, 2500)}

Options already used by products in this category/brand (reuse their naming and values when they genuinely fit):
${JSON.stringify(catalogueOptions).slice(0, 3500)}

Return ONLY valid JSON in exactly this shape:
{"options":[{"name":"Storage","values":[{"label":"256GB","priceDelta":0},{"label":"512GB","priceDelta":20000}],"required":true}]}

Rules:
- 0 to 4 groups. Use [] when the product truly has no purchasable variations.
- Every group is a choice the customer MUST make before buying (size, colour, capacity, pack count, material, etc.).
- Do not include stock, warranty, marketing copy or generic specifications.
- Reuse existing catalogue names/values where appropriate so the store stays consistent.
- 2 to 8 concrete values per group. Short, human-readable labels only.
- Every value needs "label" and "priceDelta" (whole INR, can be 0 or negative).
- The cheapest/base variant must have priceDelta 0. Upgrades add realistic INR amounts on top of the base price.
- Examples: a MacBook with a ₹1,14,900 base and 512GB upgrade might use +₹20,000; an iPhone 1TB option might use +₹40,000.
- Mark a group required unless it is genuinely optional.`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = getCORSHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers,
    });
  }

  const name = cleanText(body?.name);
  const category = cleanText(body?.category);
  const brand = cleanText(body?.brand);
  const basePrice = Math.max(0, Math.round(Number(body?.basePrice) || 0));
  const existingOptions = normalizeOptions(body?.existingOptions);
  const catalogueOptions = normalizeOptions(body?.catalogueOptions);

  if (!name && !category) {
    return new Response(
      JSON.stringify({ error: "Provide at least a product name or category" }),
      { status: 400, headers }
    );
  }

  const geminiKey = env.GEMINI_API_KEY || env.REACT_APP_GEMINI_API_KEY;
  const fallbackGeminiKey = env.GEMINI_FALLBACK_API_KEY;
  const xaiKey =
    env.XAI_API_KEY ||
    env.REACT_APP_XAI_API_KEY ||
    env.GROK_API_KEY ||
    env.REACT_APP_GROK_API_KEY;

  const candidates = [];
  const seen = new Set();
  const addGemini = (apiKey, model) => {
    if (!apiKey || !model || seen.has(`gemini:${model}:${apiKey.slice(0, 6)}`)) return;
    seen.add(`gemini:${model}:${apiKey.slice(0, 6)}`);
    candidates.push({ provider: "gemini", apiKey, model });
  };

  addGemini(geminiKey, env.GEMINI_MODEL);
  addGemini(geminiKey, env.GEMINI_OLD_MODEL);
  addGemini(fallbackGeminiKey, env.GEMINI_FALLBACK_MODEL);

  if (xaiKey) {
    candidates.push({
      provider: "xai",
      apiKey: xaiKey,
      model: env.GROK_MODEL || "grok-4-1-fast-non-reasoning-latest",
    });
  }

  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No AI provider configured",
        details: "Set GEMINI_MODEL or GROK_MODEL plus the matching API key.",
      }),
      { status: 500, headers }
    );
  }

  const prompt = buildPrompt({
    name,
    category,
    brand,
    basePrice,
    existingOptions,
    catalogueOptions,
  });

  const errors = [];
  let rawText = "";

  for (const candidate of candidates) {
    try {
      rawText = candidate.provider === "gemini"
        ? await callGemini({ ...candidate, prompt })
        : await callXai({ ...candidate, prompt });

      if (rawText) break;
    } catch (error) {
      errors.push(error.message || String(error));
      console.warn(`[AI Options] ${candidate.provider}/${candidate.model} failed:`, error.message || error);
    }
  }

  if (!rawText) {
    return new Response(
      JSON.stringify({
        error: "AI option generation is unavailable right now",
        details: errors.slice(0, 3),
      }),
      { status: 502, headers }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(rawText));
  } catch (parseError) {
    console.error("[AI Options] Invalid JSON:", rawText.slice(0, 800));
    return new Response(
      JSON.stringify({
        error: "AI returned invalid JSON",
        details: parseError.message,
        rawText: rawText.slice(0, 800),
      }),
      { status: 502, headers }
    );
  }

  const options = normalizeOptions(parsed);

  return new Response(
    JSON.stringify({ success: true, options }),
    { status: 200, headers }
  );
}
