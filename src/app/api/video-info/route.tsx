
import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;
    
        if (!url || typeof url !== "string") {
          return new Response(JSON.stringify({ error: "URL must be a valid string"}), { status: 400 });
        }
    
        if (!ytdl.validateURL(url)) {
            return new Response(JSON.stringify({ error: "Invalid URL"}), { status: 400 });
        }
    
        console.log(`[ytdlder] Fetching video info for: ${url}`);
        const info = await ytdl.getInfo(url);
    
        const formats = info.formats.filter(
          (format) => format.container === "mp4" && format.hasVideo
        );
    
        formats.sort((a, b) => {
          const aHasLabel = !!a.qualityLabel;
          const bHasLabel = !!b.qualityLabel;
          if (aHasLabel !== bHasLabel) return aHasLabel ? -1 : 1;
    
          const parseQuality = (label: string | null | undefined) =>
            parseInt(label?.split('p')[0] || '0');
          const qualityA = parseQuality(a.qualityLabel);
          const qualityB = parseQuality(b.qualityLabel);
          if (qualityA !== qualityB) return qualityB - qualityA;
    
          const fpsA = a.fps || 0;
          const fpsB = b.fps || 0;
          if (fpsA !== fpsB) return fpsB - fpsA;
    
          const parseNumeric = (val: string | number | null | undefined): number =>
            typeof val === "string" ? parseInt(val, 10) || 0 : Number(val) || 0;
    
          const measureA = parseNumeric(a.contentLength) || parseNumeric(a.bitrate) || 0;
          const measureB = parseNumeric(b.contentLength) || parseNumeric(b.bitrate) || 0;
    
          return measureB - measureA;
        });
    
        const cleanedFormat = Object.values(
          formats.reduce((acc, format) => {
            const key = format.qualityLabel ?? "unknown";
    
            const getSize = (f: typeof format) =>
              parseInt(f.contentLength ?? '0') || f.bitrate || 0;
    
            if (!acc[key] || getSize(format) > getSize(acc[key])) {
              acc[key] = format;
            }
    
            return acc;
          }, {} as Record<string, typeof formats[number]>)
        );
    
        const videoInfo = {
          videoDetails: {
            title: info.videoDetails.title,
            videoId: info.videoDetails.videoId,
            thumbnail: info.videoDetails.thumbnails.at(-1)?.url ?? '',
          },
          formats: cleanedFormat.map((format) => ({
            itag: format.itag,
            quality: format.qualityLabel,
            type: format.container,
            codecs: format.codecs,
            bitrate: format.bitrate,
            size: +format.contentLength!,
            fps: format.fps,
          })),
        };

        return new Response(JSON.stringify(videoInfo), { status: 200 });
    } catch (err) {
        console.error("[ytdlder] error:", err);
        return new Response(JSON.stringify({ error: "Internal Server Error"}), { status: 500 });
    }
}