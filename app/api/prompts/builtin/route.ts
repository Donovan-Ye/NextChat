import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { rows } = await sql`SELECT id, title, content FROM builtin_prompts;`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
