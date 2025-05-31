import { NextRequest } from "next/server";
import { createReadStream, existsSync } from "fs";
import { join, extname } from "path";
import { stat } from "fs/promises";

export async function GET(req: NextRequest, { params }: { params: Promise<{ videoId: string, filename: string }>}) {
    const { videoId, filename } = await params
    const filePath = join(process.cwd(), "public", "downloads", videoId, filename);

    if (!existsSync(filePath)) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404 });
    }

    const fileStat = await stat(filePath);
    const fileStream = createReadStream(filePath);

    const fileExtension = extname(filename).toLowerCase();
    let contentType;

    if (fileExtension === '.mp4') {
        contentType = 'video/mp4';
    } else if (fileExtension === '.mp3') {
        contentType = 'audio/mpeg';
    } else {
        return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 400 });
    }

    return new Response(fileStream as unknown as ReadableStream, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": fileStat.size.toString(),
            "Content-Disposition": `inline; filename="${filename}"`,
            "Cache-Control": "public, max-age=31536000", // Cache for 1 year
        },
    });
}
