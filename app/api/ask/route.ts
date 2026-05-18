import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

export async function POST(req: NextRequest) {
  const { question, models } = await req.json();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const upstream = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, models }),
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
