const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

async function callApi(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch (_) {
      // ignore invalid JSON bodies
    }
    throw new Error(message);
  }

  return response.json();
}

export function searchSources({ query, filter, limit }) {
  return callApi("/search", { query, filter, limit });
}

export function answerQuestion({ question, filter, mode, limit }) {
  return callApi("/answer", { question, filter, mode, limit });
}
