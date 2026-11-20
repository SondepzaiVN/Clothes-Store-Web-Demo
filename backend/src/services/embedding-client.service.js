const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
// The first request may also download/load the local model; later requests are fast.
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 300000);

async function request(path, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_SERVICE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.detail || `Embedding service error ${response.status}`);
      error.status = response.status === 400 ? 400 : 503;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Embedding service phản hồi quá thời gian cho phép.");
      timeoutError.status = 503;
      throw timeoutError;
    }
    if (error.status) throw error;
    const unavailable = new Error(`Không kết nối được AI service tại ${AI_SERVICE_URL}.`);
    unavailable.status = 503;
    unavailable.cause = error;
    throw unavailable;
  } finally {
    clearTimeout(timer);
  }
}

function embed(texts) {
  return request("/embed", { method: "POST", body: JSON.stringify({ texts }) });
}

function health() {
  return request("/health");
}

module.exports = { embed, health };
