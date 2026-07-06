/**
 * ApiError carries a user-friendly message that is safe to show in the UI.
 * API routes catch these and return { error: message } — never a stack trace.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 502,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const FRIENDLY = {
  spotifyDown: "Spotify isn't responding right now. Please try again in a moment.",
  spotifyBusy: "Spotify is limiting requests right now. Please try again in a little while.",
  groqDown: "The session generator isn't responding right now. Please try again in a moment.",
  groqUnreadable: "We couldn't put a session together this time. Please try again.",
  sessionFailed: "We couldn't build a full session this time. Please try again.",
  saveFailed: "Couldn't save to the playlist right now. Please try again in a moment.",
  notConfigured: "This feature isn't set up on the server yet.",
} as const;

/** Wraps unknown errors (network failures, timeouts) into a friendly ApiError. */
export function toApiError(err: unknown, fallbackMessage: string): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(fallbackMessage);
}
