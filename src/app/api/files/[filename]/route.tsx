import { NextRequest } from "next/server";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import { stat } from "fs/promises";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }>}) {
    const { filename } = await params
    const filePath = join(process.cwd(), "public", "downloads", filename);

    if (!existsSync(filePath)) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }

    const fileStat = await stat(filePath);
    const fileStream = createReadStream(filePath);

    return new Response(fileStream as unknown as ReadableStream, {
        status: 200,
        headers: {
        "Content-Type": "video/mp4",
        "Content-Length": fileStat.size.toString(),
        "Content-Disposition": `inline; filename="${filename}"`,
        },
    });
}
