/** Validated environment helpers (client-safe values only) */

export function getGoogleClientId(): string {
  const id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. " +
        "See README for Google Cloud setup instructions."
    );
  }
  return id;
}
