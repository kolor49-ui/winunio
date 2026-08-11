export const WINUNIO_ANDROID_CLIENT_HEADER = "x-winunio-client";
export const WINUNIO_ANDROID_CLIENT_VALUE = "android";

export function isWinunioAndroidClient(request: Request): boolean {
  return (
    request.headers.get(WINUNIO_ANDROID_CLIENT_HEADER)?.trim().toLowerCase() ===
    WINUNIO_ANDROID_CLIENT_VALUE
  );
}
