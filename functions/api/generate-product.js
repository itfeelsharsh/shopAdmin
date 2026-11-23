function getCORSHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-AppCheck",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

/**
 * AI models sometimes answer with US-dollar pricing even when asked for INR.
 * Normalise every generated price to whole Indian Rupees before it reaches the
 * admin form. Explicit $ / USD values are converted; plain numbers are treated
 * as INR as instructed by the prompt.
 */
function parseMoney(value) {
  if (value === null || value === undefined || value === "") {
    return { amount: null, currency: null };
  }

  if (typeof value === "number") {
    return { amount: Number.isFinite(value) ? value : null, currency: null };
  }

  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  const currency = raw.includes("$") || lower.includes("usd")
    ? "USD"
    : raw.includes("₹") || lower.includes("inr")
      ? "INR"
      : null;

  const cleaned = raw
    .replace(/[₹$,\s]/g, "")
    .replace(/usd/gi, "")
    .replace(/inr/gi, "")
    .trim();

  const amount = Number.parseFloat(cleaned);
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

function normalizeAiPricing(product, env) {
  if (!product || typeof product !== "object") return product;

  const rate = Number(env.USD_TO_INR || 83) || 83;
  const selling = parseMoney(product.sellingPrice ?? product.price);
  const mrp = parseMoney(product.mrp ?? product.sellingPrice ?? product.price);

  const declaredCurrency = String(product.currency || product.priceCurrency || "").toUpperCase();
  const usesUsd =
    declaredCurrency === "USD" ||
    selling.currency === "USD" ||
    mrp.currency === "USD";

  const convert = (amount) => {
    if (amount === null) return null;
    const value = usesUsd ? amount * rate : amount;
    return Math.max(1, Math.round(value));
  };

  const sellingPrice = convert(selling.amount);
  const mrpValue = convert(mrp.amount);

  if (sellingPrice !== null) {
    product.sellingPrice = sellingPrice;
    product.price = sellingPrice;

    if (mrpValue !== null) {
      // Never show a fake negative discount.
      product.mrp = Math.max(sellingPrice, mrpValue);
    } else {
      product.mrp = sellingPrice;
    }
  }

  product.currency = "INR";
  delete product.priceCurrency;
  return product;
}

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCORSHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: getCORSHeaders(request),
    });
  }

  try {
    const body = await request.json();
    const { name, imageUrl, mode, modelChoice } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Product name/title is required" }), {
        status: 400,
        headers: getCORSHeaders(request),
      });
    }

    const targetMode = mode || "professional";
    const isMeme = targetMode === "meme";

    let apiKey = "";
    let xaiApiKey = "";

    if (isMeme) {
      xaiApiKey = env.XAI_API_KEY || env.REACT_APP_XAI_API_KEY || env.GROK_API_KEY || env.REACT_APP_GROK_API_KEY;
      if (!xaiApiKey) {
        return new Response(
          JSON.stringify({
            error: "XAI_API_KEY is not configured in the server environment. Please set it in wrangler.toml or Cloudflare Settings.",
          }),
          {
            status: 500,
            headers: getCORSHeaders(request),
          }
        );
      }
    } else {
      apiKey = env.GEMINI_API_KEY || env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "GEMINI_API_KEY is not configured in the server environment. Please set it in wrangler.toml or Cloudflare Settings.",
          }),
          {
            status: 500,
            headers: getCORSHeaders(request),
          }
        );
      }
    }

    // Also read xAI/Grok key into variable for possible primary or fallback use
    const primaryXaiKey = env.XAI_API_KEY || env.REACT_APP_XAI_API_KEY || env.GROK_API_KEY || env.REACT_APP_GROK_API_KEY;

    let modeInstructions = "";
    if (isMeme) {
      modeInstructions = `The copy style MUST be "Meme Material". Make the description, features, tags, and additional notes highly entertaining, funny, and meme-worthy. Use clever puns, internet cultural references, and witty dry humor suitable for a Gen-Z/Gen-Alpha audience, but always maintain e-commerce utility and structure (do not spam emojis or write unreadable slang. It must remain professional+meme a sweet combo, readable, and look like a high-quality product someone would actually buy, just humorous).`;
    } else {
      modeInstructions = `The copy style MUST be "Professional". Write formal, clear, factual, and persuasive e-commerce descriptions and key features. Avoid jokes, memes, slang, or casual language. Keep the tone completely business-like.`;
    }

    // Prepare text instructions
    const textPrompt = `Analyze the product name: "${name}". Generate a complete and SEO-optimized e-commerce listing for it. If an image is attached, align the brand, category, description, and features/specifications with what is shown in the image.

${modeInstructions}

Generate reasonable pricing suggestions STRICTLY in Indian Rupees (INR):
- Every monetary field MUST be a whole number in INR, with no currency symbols, no commas and no decimals.
- NEVER use US dollars. NEVER return values such as 199 for a premium imported product just because its US price is $199.
- Think like an Indian retailer: MRP is the standard Indian retail price and sellingPrice is a realistic Indian discounted price.
- Typical scale: everyday accessories ₹299–₹2,999; premium stationery ₹499–₹9,999; phones/laptops ₹15,000–₹2,50,000; luxury watches/bags ₹50,000–₹10,00,000.
- If the product is imported, still quote the Indian landed retail price in INR.

Generate a random stock quantity between 1 and 999.
Generate a realistic country of origin (e.g., India, Japan, Germany, USA, etc.).
Generate some additional notes/information suitable for this product.
Generate 0-4 PURCHASABLE OPTION GROUPS in "options". These must be real choices the customer has to make before buying this exact product (for example size, colour, capacity, pack count, material — only where they genuinely apply). Use the product name and its category/brand to decide. Each group must have a clear short name and 2-8 concrete values. Use an empty array when the product has no real variations. Do NOT put marketing copy, price or stock in option values.
Randomly determine if the product has a warranty and/or guarantee (do not make them identical or always active; make it realistic for the type of product, e.g., some items have neither, some have 6-month warranty, some have a 30-day money-back guarantee, etc.).

Do not generate or modify the product name. In your response, the name field MUST be exactly the input product name: "${name}".

You must return a valid JSON object matching the schema below. Do not include markdown wraps or backticks (e.g. no \`\`\`json). Just the raw JSON.

Schema:
{
  "name": "${name}",
  "brand": "Suggested Brand name",
  "category": "Suggested Category name",
  "description": "Engaging description (3-4 sentences)",
  "sellingPrice": 1499,
  "mrp": 1999,
  "currency": "INR",
  "tags": ["tag1", "tag2", "tag3"],
  "features": ["Key feature 1", "Key feature 2", "Key feature 3"],
  "specifications": [
    {"key": "Material", "value": "e.g., Premium Leather"},
    {"key": "Color", "value": "e.g., Matte Black"}
  ],
  "options": [
    {"name": "Size", "values": ["S", "M", "L"], "required": true},
    {"name": "Colour", "values": ["Black", "White"], "required": true}
  ],
  "stock": 427,
  "origin": "India",
  "additionalInfo": "Any additional notes/information...",
  "showOnHome": false,
  "warranty": {
    "available": true,
    "period": "1 year",
    "details": "Covers manufacturing defects"
  },
  "guarantee": {
    "available": false,
    "period": "",
    "details": ""
  },
  "importDetails": {
    "isImported": false,
    "country": "India",
    "deliveryNote": ""
  }
}`;

    let productDetails;

    if (isMeme) {
      const grokModel = env.GROK_MODEL || "grok-4-1-fast-non-reasoning-latest";
      console.log(`[AI Generator] Calling Grok API with model: ${grokModel}`);

      // Generate purely from title/text prompt (no image analysis)
      const content = [{ type: "text", text: textPrompt }];

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${xaiApiKey}`
        },
        body: JSON.stringify({
          model: grokModel,
          messages: [
            {
              role: "user",
              content: content
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AI Generator] Grok API error:", errorText);
        return new Response(
          JSON.stringify({ error: "Grok API returned an error", details: errorText }),
          { status: response.status, headers: getCORSHeaders(request) }
        );
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;

      if (!generatedText) {
        return new Response(
          JSON.stringify({ error: "Failed to generate content from Grok response structure", raw: data }),
          { status: 500, headers: getCORSHeaders(request) }
        );
      }

      try {
        productDetails = normalizeAiPricing(JSON.parse(generatedText.trim()), env);
      } catch (parseError) {
        console.error("[AI Generator] Failed to parse generated JSON from Grok:", generatedText);
        return new Response(
          JSON.stringify({ error: "Generated output from Grok was not valid JSON", rawText: generatedText }),
          { status: 500, headers: getCORSHeaders(request) }
        );
      }
    } else {
      // Prepare Gemini request contents (title-only)
      const contentsParts = [{ text: textPrompt }];

      // Choose model based on requested modelChoice or environment defaults
      // Require explicit model env vars to avoid using potentially unsupported defaults
      const chosenModel = (() => {
        if (modelChoice === 'xai') return { provider: 'xai' };
        if (modelChoice === 'gemini_old') return { provider: 'gemini', model: env.GEMINI_OLD_MODEL };
        // default to newer Gemini configured via env
        return { provider: 'gemini', model: env.GEMINI_MODEL };
      })();

      if (chosenModel.provider === 'gemini' && !chosenModel.model) {
        return new Response(
          JSON.stringify({ error: 'Gemini model not configured', details: 'Set GEMINI_MODEL or GEMINI_OLD_MODEL in environment variables to a valid model name.' }),
          { status: 500, headers: getCORSHeaders(request) }
        );
      }

      let geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel.model}:generateContent`;
      if (chosenModel.provider !== 'gemini') geminiUrl = null;
      const callGemini = async (modelUrl, keyQueryParam) => {
        const url = keyQueryParam ? `${modelUrl}?key=${keyQueryParam}` : modelUrl;
        return await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: contentsParts
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });
      };

      // Primary call: if chosen provider is xai, call Grok/xAI directly; otherwise call Gemini
      let response;
      if (chosenModel.provider === 'xai') {
        if (!primaryXaiKey) {
          return new Response(
            JSON.stringify({ error: 'xAI API key not configured', details: 'Set XAI_API_KEY or GROK_API_KEY in environment.' }),
            { status: 500, headers: getCORSHeaders(request) }
          );
        }

        try {
          const grokModel = env.GROK_MODEL || 'grok-4-1-fast-non-reasoning-latest';
          const xaiResp = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${primaryXaiKey}` },
            body: JSON.stringify({ model: grokModel, messages: [{ role: 'user', content: [{ type: 'text', text: textPrompt }] }], response_format: { type: 'json_object' } })
          });

          if (!xaiResp.ok) {
            const eText = await xaiResp.text();
            console.error('[AI Generator] xAI primary call error:', eText);
            response = { status: xaiResp.status, ok: false, text: async () => eText };
          } else {
            const xaiData = await xaiResp.json();
            const generatedText = xaiData.choices?.[0]?.message?.content;
            if (!generatedText) {
              return new Response(JSON.stringify({ error: 'Failed to generate content from xAI response structure', raw: xaiData }), { status: 500, headers: getCORSHeaders(request) });
            }
            try {
              productDetails = normalizeAiPricing(JSON.parse(generatedText.trim()), env);
              return new Response(JSON.stringify({ success: true, product: productDetails }), { status: 200, headers: getCORSHeaders(request) });
            } catch (parseError) {
              console.error('[AI Generator] Failed to parse xAI JSON:', generatedText);
              return new Response(JSON.stringify({ error: 'Generated output from xAI was not valid JSON', rawText: generatedText }), { status: 500, headers: getCORSHeaders(request) });
            }
          }
        } catch (xErr) {
          console.error('[AI Generator] Error calling xAI primary:', xErr.message || xErr);
          response = { status: 500, ok: false, text: async () => String(xErr.message || xErr) };
        }
      } else {
        // chosenModel.provider === 'gemini'
        response = await callGemini(geminiUrl, apiKey);
      }

      // If service unavailable (503) try configured fallback model/key or try Grok/XAI if available
      if (response.status === 503) {
        console.warn('[AI Generator] Gemini returned 503. Attempting fallback model...');

        // Attempt Gemini fallback if configured
        const fbModel = env.GEMINI_FALLBACK_MODEL;
        const fbKey = env.GEMINI_FALLBACK_API_KEY;
        if (fbModel && fbKey) {
          try {
            const fbUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fbModel}:generateContent`;
            response = await callGemini(fbUrl, fbKey);
            console.log('[AI Generator] Called Gemini fallback model:', fbModel);
          } catch (fbErr) {
            console.error('[AI Generator] Error calling Gemini fallback:', fbErr.message || fbErr);
          }
        }

        // If still 503 or no fallback, try Grok/XAI if key present
        if ((response.status === 503 || !response.ok) && (env.XAI_API_KEY || env.GROK_API_KEY)) {
          try {
            const xaiKey = env.XAI_API_KEY || env.GROK_API_KEY;
            console.log('[AI Generator] Falling back to Grok/XAI API');
            const grokModel = env.GROK_MODEL || 'grok-4-1-fast-non-reasoning-latest';
            const content = [{ type: 'text', text: textPrompt }];

            const xaiResp = await fetch('https://api.x.ai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${xaiKey}` },
              body: JSON.stringify({ model: grokModel, messages: [{ role: 'user', content: content }], response_format: { type: 'json_object' } })
            });

            if (xaiResp.ok) {
              const xaiData = await xaiResp.json();
              const generatedText = xaiData.choices?.[0]?.message?.content;
              if (!generatedText) {
                return new Response(JSON.stringify({ error: 'Failed to generate content from Grok response structure', raw: xaiData }), { status: 500, headers: getCORSHeaders(request) });
              }
              try {
                productDetails = normalizeAiPricing(JSON.parse(generatedText.trim()), env);
                return new Response(JSON.stringify({ success: true, product: productDetails }), { status: 200, headers: getCORSHeaders(request) });
              } catch (parseError) {
                console.error('[AI Generator] Failed to parse Grok JSON:', generatedText);
                return new Response(JSON.stringify({ error: 'Generated output from Grok was not valid JSON', rawText: generatedText }), { status: 500, headers: getCORSHeaders(request) });
              }
            } else {
              const errTxt = await xaiResp.text();
              console.error('[AI Generator] Grok/XAI API error:', errTxt);
            }
          } catch (xErr) {
            console.error('[AI Generator] Error calling Grok/XAI fallback:', xErr.message || xErr);
          }
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Generator] Gemini API error:', errorText);
        // If model not found (404), provide a clearer hint
        if (response.status === 404) {
          console.error('[AI Generator] Gemini model not found. Attempting to list available models...');
          // Attempt to list available models to advise user
          try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (listRes.ok) {
              const listData = await listRes.json();
              const modelNames = (listData.models || []).map(m => m.name).slice(0, 50);
              return new Response(
                JSON.stringify({ error: 'Gemini model not found', details: errorText, availableModels: modelNames }),
                { status: 404, headers: getCORSHeaders(request) }
              );
            }
          } catch (lmErr) {
            console.error('[AI Generator] Failed to list Gemini models:', lmErr.message || lmErr);
          }

          console.error('[AI Generator] Gemini model not found. Consider setting GEMINI_MODEL or GEMINI_OLD_MODEL to a valid model.');
        }
        return new Response(
          JSON.stringify({ error: 'Gemini API returned an error', details: errorText }),
          { status: response.status, headers: getCORSHeaders(request) }
        );
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate content from Gemini response structure', raw: data }),
          { status: 500, headers: getCORSHeaders(request) }
        );
      }

      // Parse the JSON returned by Gemini
      try {
        productDetails = normalizeAiPricing(JSON.parse(generatedText.trim()), env);
      } catch (parseError) {
        console.error("[AI Generator] Failed to parse generated JSON:", generatedText);
        return new Response(
          JSON.stringify({ error: "Generated output was not valid JSON", rawText: generatedText }),
          { status: 500, headers: getCORSHeaders(request) }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: productDetails
      }),
      {
        status: 200,
        headers: getCORSHeaders(request)
      }
    );

  } catch (error) {
    console.error("[AI Generator] Internal Server Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      {
        status: 500,
        headers: getCORSHeaders(request)
      }
    );
  }
}
