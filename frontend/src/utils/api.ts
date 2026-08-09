const API_BASE = "/api";

/**
 * Talks to the API. Anything other than a success is turned into an error
 * carrying the message the server sent, which is what the pages show.
 *
 * A plain function rather than something built per render, so anything that
 * reloads when it changes never has to.
 */
export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));

    throw new Error(problem.error || `HTTP ${response.status}`);
  }

  return response.json();
}
