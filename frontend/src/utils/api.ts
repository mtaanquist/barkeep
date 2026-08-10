const API_BASE = "/api";

/**
 * A failed request. Carries the status and, when the server sent one, a short
 * code the pages can branch on — telling a claimed name apart from a wrong
 * password without having to read the English message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Talks to the API. Anything other than a success is turned into an error
 * carrying the message the server sent, which is what the pages show.
 *
 * A plain function rather than something built per render, so anything that
 * reloads when it changes never has to.
 */
export async function apiCall<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    // Send the sign-in cookie along. Same-origin already would; this also
    // covers development, where the pages come from a different address.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const problem = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));

    throw new ApiError(
      problem.error || `HTTP ${response.status}`,
      response.status,
      problem.code
    );
  }

  return response.json();
}
