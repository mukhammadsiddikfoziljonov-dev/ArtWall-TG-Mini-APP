const TOKEN_KEY = "artwall-api-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export async function authenticate(role: "buyer" | "artist" | "admin") {
  const telegram = window.Telegram?.WebApp;
  const endpoint = telegram?.initData ? "/api/auth/telegram" : "/api/auth/preview";
  const startParam = telegram?.initDataUnsafe?.start_param?.toLowerCase() ?? "";
  const requestedRole = startParam.startsWith("artist") ? "artist" : "buyer";
  const body = telegram?.initData ? { initData: telegram.initData, requestedRole } : { role };
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json()).error || "Authentication failed");
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
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return response.json();
}

