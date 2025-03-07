import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

async function handle(req: NextRequest) {
  if (req.method === "POST") {
    try {
      // 解析请求体
      const body = await req.json();

      // 获取 prompts.json 文件路径
      const promptsFilePath = path.join(
        process.cwd(),
        "public",
        "prompts.json",
      );

      // 直接写入新的内容，全量更新
      fs.writeFileSync(promptsFilePath, JSON.stringify(body, null, 2));

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
