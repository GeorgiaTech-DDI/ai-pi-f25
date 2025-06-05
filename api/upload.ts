import { put } from "@vercel/blob";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url, `https://${request.headers.get('host') || 'localhost'}`);
  const { searchParams } = url;
  const filename = searchParams.get("filename");

  if (!filename) {
    return new Response(JSON.stringify({ error: "Filename is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!request.body) {
    return new Response(JSON.stringify({ error: "Request body is empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const blob = await put(filename, request.body, {
      access: "public",
    });

    return new Response(JSON.stringify(blob), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
