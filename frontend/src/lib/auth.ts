const KEY = "bt_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
  document.cookie = `${KEY}=${token}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax`;
}

export function clearToken() {
  localStorage.removeItem(KEY);
  document.cookie = `${KEY}=; path=/; max-age=0`;
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function authedFetcher(url: string) {
  return fetch(url, { headers: authHeaders() }).then((r) => {
    if (r.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return r.json();
  });
}
