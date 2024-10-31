export default defineEventHandler(async (event) => {
  const img = getQuery(event).url
  if (img) {
    const url = decodeBase64URL(img as string)
    return sendProxy(event, url, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    })
  }
})
