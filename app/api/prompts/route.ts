import { sql } from "@vercel/postgres";
import console from "console";
import { NextRequest, NextResponse } from "next/server";

async function handle(req: NextRequest) {
  if (req.method === "POST") {
    try {
      // 解析请求体
      const body = await req.json();
      const { id, title, content } = body;

      await sql`UPDATE builtin_prompts SET title = ${title}, content = ${content} WHERE id = ${id};`;
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error updating prompts:", error);
      return NextResponse.json(
        { error: "Failed to update prompts" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
