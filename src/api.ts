const TOKEN_KEY = "artwall-api-token";
const VISITOR_KEY = "artwall-visitor-id";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function authenticate(role: "buyer" | "artist" | "admin") {
  const telegram = window.Telegram?.WebApp;
  const endpoint = telegram?.initData ? "/api/auth/telegram" : import.meta.env.DEV ? "/api/auth/preview" : "/api/auth/visitor";
  const startParam = telegram?.initDataUnsafe?.start_param?.toLowerCase() ?? "";
  const requestedRole = startParam.startsWith("artist") ? "artist" : "buyer";
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }
  const body = telegram?.initData ? { initData: telegram.initData, requestedRole } : import.meta.env.DEV ? { role } : { visitorId };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new ApiError(response.status, (await response.json()).error || "Authentication failed");
  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || `Request failed with ${response.status}`);
  }
  return response.json();
}

