/**
 * Public Firebase web config for the admin console.
 *
 * These values are browser identifiers, not secrets. Serving them at runtime
 * means production builds never depend on build-time environment injection and
 * no API key ever needs to be committed to the repository.
 */
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getHeaders(),
    });
  }

  const config = {
    apiKey:
      env.REACT_APP_FIREBASE_API_KEY ||
      env.FIREBASE_API_KEY,
    authDomain:
      env.REACT_APP_FIREBASE_AUTH_DOMAIN ||
      env.FIREBASE_AUTH_DOMAIN,
    projectId:
      env.REACT_APP_FIREBASE_PROJECT_ID ||
      env.FIREBASE_PROJECT_ID,
    storageBucket:
      env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
      env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId:
      env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ||
      env.FIREBASE_MESSAGING_SENDER_ID,
    appId:
      env.REACT_APP_FIREBASE_APP_ID ||
      env.FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'Firebase web configuration is incomplete on the server.',
        missing,
      }),
      { status: 500, headers: getHeaders() }
    );
  }

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: getHeaders(),
  });
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
