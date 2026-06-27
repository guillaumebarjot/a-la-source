const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    // Intercepteur global 401/403 (session expirée ou accès interdit).
    // On émet un événement personnalisé que l'app peut écouter pour notifier l'utilisateur.
    if (res.status === 401 || res.status === 403) {
      window.dispatchEvent(new CustomEvent('als:auth-error', { detail: { status: res.status } }))
    }
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  // Tolere les reponses sans corps (204, ou 200 vide) : ne pas tenter de parser
  // du JSON vide (sinon « Unexpected end of JSON input » sur add/remove/order...).
  const texte = await res.text()
  return (texte ? JSON.parse(texte) : null) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Upload multipart : on vide les headers pour laisser le navigateur poser la boundary.
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData, headers: {} }),
}
