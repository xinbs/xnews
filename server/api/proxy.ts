export default defineEventHandler(async (event) => {
  const img = getQuery(event).img
  if (img) {
    const url = decodeURIComponent(img as string)
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
