const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('habesha_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: json.error || `Request failed with status ${res.status}` };
    }

    return { data: json };
  } catch (err: any) {
    return { error: err.message || 'Network error connecting to API server.' };
  }
}
