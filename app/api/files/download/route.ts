import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new NextResponse("No URL", { status: 400 });

  const result = await get(url, { access: "private" });

  if (!result) {
    return NextResponse.json(
      { error: "Failed to download file." },
      { status: 404 }
    );
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${result.blob.pathname}"`,
    },
  });
}
