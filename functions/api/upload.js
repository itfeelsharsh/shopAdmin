import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function sanitizeFilename(filename) {
  const basename = filename.split("/").pop()?.split("\\").pop() || filename;
  const lastDot = basename.lastIndexOf(".");
  const ext = lastDot > 0 ? basename.slice(lastDot) : "";
  const stem = lastDot > 0 ? basename.slice(0, lastDot) : basename;

  const sanitizedStem = stem
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitizedStem ? `${sanitizedStem}${ext}` : `file${ext}`;
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
    const { filename, contentType } = body;

    if (!filename) {
      return new Response(JSON.stringify({ error: "Filename is required" }), {
        status: 400,
        headers: getCORSHeaders(request),
      });
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.REACT_APP_CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = env.R2_ACCESS_KEY_ID || env.REACT_APP_R2_ACCESS_KEY_ID;
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY || env.REACT_APP_R2_SECRET_ACCESS_KEY;
    const bucketName = env.R2_BUCKET_NAME || env.REACT_APP_R2_BUCKET_NAME;
    const cdnDomain = env.CDN_DOMAIN || env.REACT_APP_CDN_DOMAIN || "cdn.kamikoto.click";

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return new Response(
        JSON.stringify({
          error: "Cloudflare R2 is not fully configured on the server.",
          missing: {
            accountId: !accountId,
            accessKeyId: !accessKeyId,
            secretAccessKey: !secretAccessKey,
            bucketName: !bucketName
          }
        }),
        { status: 500, headers: getCORSHeaders(request) }
      );
    }

    const sanitized = sanitizeFilename(filename);
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const key = `uploads/${year}-${month}/${uniqueId}-${sanitized}`;

    const r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    let cdnUrl = "";
    if (cdnDomain) {
      let baseDomain = cdnDomain.endsWith("/") ? cdnDomain.slice(0, -1) : cdnDomain;
      if (!baseDomain.startsWith("http://") && !baseDomain.startsWith("https://")) {
        baseDomain = `https://${baseDomain}`;
      }
      cdnUrl = `${baseDomain}/${key}`;
    } else {
      cdnUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;
    }

    return new Response(
      JSON.stringify({
        uploadUrl,
        cdnUrl,
        key,
      }),
      {
        status: 200,
        headers: getCORSHeaders(request),
      }
    );
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate presigned upload URL", details: error.message }),
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Firebase-AppCheck",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}
