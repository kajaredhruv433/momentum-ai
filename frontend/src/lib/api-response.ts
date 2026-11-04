/** Read an API response without assuming that upstream failures contain JSON. */
export async function readApiJson<T = any>(response: Response): Promise<T> {
  const body = await response.text();
  let data: any = null;

  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      const message = body.trim().slice(0, 500);
      throw new Error(
        response.ok
          ? `The server returned an invalid JSON response (${response.status}).`
          : `API request failed (${response.status} ${response.statusText}): ${message || "No response body"}`,
      );
    }
  }

  if (!response.ok) {
    const message = data?.detail || data?.error || data?.message;
    throw new Error(
      `API request failed (${response.status} ${response.statusText})${message ? `: ${message}` : ""}`,
    );
  }

  return data as T;
}
