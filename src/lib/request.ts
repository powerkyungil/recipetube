export function getAnonymousId(request: Request) {
  const anonymousId = request.headers.get("x-anonymous-id");

  if (!anonymousId || !/^[a-zA-Z0-9_-]{16,80}$/.test(anonymousId)) {
    return null;
  }

  return anonymousId;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
