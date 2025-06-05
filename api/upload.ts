import { put } from "@vercel/blob";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { filename } = req.query;

  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "Filename is required" });
  }

  if (!req.body) {
    return res.status(400).json({ error: "Request body is empty" });
  }

  try {
    const blob = await put(filename, req.body, {
      access: "public",
    });

    return res.status(200).json(blob);
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}