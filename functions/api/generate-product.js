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
    const { name, imageUrl, mode } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Product name/title is required" }), {
        status: 400,
        headers: getCORSHeaders(request),
      });
    }

    const apiKey = env.GEMINI_API_KEY || env.REACT_APP_GEMINI_API_KEY;
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

    const targetMode = mode || "professional";

    let modeInstructions = "";
    if (targetMode === "meme") {
      modeInstructions = `The copy style MUST be "Meme Material". Make the description, features, tags, and additional notes highly entertaining, funny, and meme-worthy. Use clever puns, internet cultural references, and witty dry humor suitable for a Gen-Z/Gen-Alpha audience, but always maintain e-commerce utility and structure (do not spam emojis or write unreadable slang. It must remain professional+meme a sweet combo, readable, and look like a high-quality product someone would actually buy, just humorous).`;
    } else {
      modeInstructions = `The copy style MUST be "Professional". Write formal, clear, factual, and persuasive e-commerce descriptions and key features. Avoid jokes, memes, slang, or casual language. Keep the tone completely business-like.`;
    }

    // Prepare Gemini request contents
    const contentsParts = [];

    // Add main text instructions
    contentsParts.push({
      text: `Analyze the product name: "${name}". Generate a complete and SEO-optimized e-commerce listing for it. If an image is attached, align the brand, category, description, and features/specifications with what is shown in the image.

${modeInstructions}

Suggest a category and a brand that best fits this product. You can suggest a custom category/brand if none of the standard ones fit.

Generate reasonable pricing suggestions in INR (₹):
- MRP should be a standard retail price.
- sellingPrice should be a realistic discounted price.

Generate a random stock quantity between 1 and 999.
Generate a realistic country of origin (e.g., India, Japan, Germany, USA, etc.).
Generate some additional notes/information suitable for this product.
Randomly determine if the product has a warranty and/or guarantee (do not make them identical or always active; make it realistic for the type of product, e.g., some items have neither, some have 6-month warranty, some have a 30-day money-back guarantee, etc.).

Do not generate or modify the product name. In your response, the name field MUST be exactly the input product name: "${name}".

You must return a valid JSON object matching the schema below. Do not include markdown wraps or backticks (e.g. no \`\`\`json). Just the raw JSON.

Schema:
{
  "name": "${name}",
  "brand": "Suggested Brand name",
  "category": "Suggested Category name",
  "description": "Engaging description (3-4 sentences)",
  "sellingPrice": 199.00,
  "mrp": 249.00,
  "tags": ["tag1", "tag2", "tag3"],
  "features": ["Key feature 1", "Key feature 2", "Key feature 3"],
  "specifications": [
    {"key": "Material", "value": "e.g., Premium Leather"},
    {"key": "Color", "value": "e.g., Matte Black"}
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
}`
    });

    // If image URL is provided, try to fetch it and attach it to the Gemini payload
    if (imageUrl) {
      try {
        console.log(`[AI Generator] Fetching image from: ${imageUrl}`);
        const imgResponse = await fetch(imageUrl);
        if (imgResponse.ok) {
          const arrayBuffer = await imgResponse.arrayBuffer();
          const base64Data = Buffer.from(arrayBuffer).toString("base64");
          const contentType = imgResponse.headers.get("content-type") || "image/jpeg";

          contentsParts.push({
            inlineData: {
              mimeType: contentType,
              data: base64Data
            }
          });
          console.log("[AI Generator] Successfully attached image to Gemini payload");
        } else {
          console.warn(`[AI Generator] Image fetch failed with status ${imgResponse.status}. Proceeding with text-only generation.`);
        }
      } catch (imgError) {
        console.error("[AI Generator] Error fetching image URL. Proceeding with text-only generation:", imgError.message);
      }
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI Generator] Gemini API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Gemini API returned an error", details: errorText }),
        { status: response.status, headers: getCORSHeaders(request) }
      );
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "Failed to generate content from Gemini response structure", raw: data }),
        { status: 500, headers: getCORSHeaders(request) }
      );
    }

    // Parse the JSON returned by Gemini
    let productDetails;
    try {
      productDetails = JSON.parse(generatedText.trim());
    } catch (parseError) {
      console.error("[AI Generator] Failed to parse generated JSON:", generatedText);
      return new Response(
        JSON.stringify({ error: "Generated output was not valid JSON", rawText: generatedText }),
        { status: 500, headers: getCORSHeaders(request) }
      );
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
