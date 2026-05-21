import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3456";

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/examples`, { cache: "no-store" });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ examples: [] }, { status: 200 });
  }
}
