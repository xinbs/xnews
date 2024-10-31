export function proxyPicture(url: string) {
  return `/api/proxy/img.png?url=${encodeBase64URL(url)}`
}
