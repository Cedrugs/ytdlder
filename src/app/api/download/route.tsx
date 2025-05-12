import { NextRequest } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import ytdl from "@distube/ytdl-core";
import { sendProgress, ensureWebSocketServerRunning } from "@/app/lib/websocket";


// Test directory for the first time
const tempDir = path.join('./public', 'downloads');
if (!fs.existsSync(tempDir)) {
    try {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`[ytdlder] Created temporary directory: ${tempDir}`);
    } catch (err) {
        console.error(`[ytdlder] Could not create temporary directory ${tempDir}. Please check permissions.`, err);
        process.exit(1);
    }
}

// GET /api/download
export async function GET(request: NextRequest) {
    // Check and try to connect to WebSocket for progress update
    try {
        ensureWebSocketServerRunning();
    } catch (err: unknown) {
        const error = err as Error;
         console.error("[API Download] WebSocket server not ready:", error.message);
         return new Response(JSON.stringify({ error: "WebSocket service not available." }), { status: 503 });
    }

    // Get necessary things
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get("videoId");
    const itag = searchParams.get("itag");
    const downloadId = searchParams.get("downloadId") ?? crypto.randomUUID();

    // Path initialization
    let tempVideoPath = '';
    let tempAudioPath = '';
    let mergedPath = '';

    if (!videoId || !itag || !downloadId || typeof videoId !== 'string' || typeof itag !== 'string' || typeof downloadId !== 'string') {
        return new Response(JSON.stringify({ error: "Video ID and format tag (itag) are required" }), { status: 400 });
    }

    try {
        console.log(`[${downloadId}] [${videoId}] Fetching video info`);

        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
        const videoFormat = ytdl.chooseFormat(info.formats, { quality: itag });
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

        // TODO: Add frontend handler for return error.
        if (!videoFormat) {
            return new Response(JSON.stringify({ error: "Requested video format (itag) not found" }), { status: 404 });
        }

        // TODO: Fix this whether to skip audio or return error
        if (!audioFormat && videoFormat.hasAudio === false) {
            return new Response(JSON.stringify({ error: "Requested video format doesn't have audio" }), { status: 404 });
        }
        
        // TODO: Fix this to use format that can't be duplicated: Current use video title to serve video to the client (can be duplicated)
        const videoTitle = info.videoDetails.title.replace(/[^a-zA-Z0-9\-_ ]/g, '_').replace(/ /g, '_');
        const fileExtension = videoFormat.container || 'mp4';
        const uniqueSuffix = `${videoId}_${itag}_${Date.now()}`;

        tempVideoPath = path.join(tempDir, `${uniqueSuffix}_video.${fileExtension}`);

        const audioFileExtension = audioFormat?.container || 'm4a';
        tempAudioPath = path.join(tempDir, `${uniqueSuffix}_audio.${audioFileExtension}`);

        const clientFilename = `${videoTitle}_${videoFormat.qualityLabel || itag}.${fileExtension}`;
        // TODO: Fix this to use format that can't be duplicated: Current use video title to serve video to the client (can be duplicated)
        mergedPath = path.join(tempDir, `${clientFilename}`);

        const baseURL = new URL(process.env.SITE_URL || request.nextUrl.origin);
        const publicUrl = `${baseURL.origin}/api/files/${clientFilename}`;

        console.log(`[${downloadId}] [${videoId}] Format chosen: ${videoFormat.qualityLabel} (${videoFormat.mimeType}).`);
        
        if (fs.existsSync(mergedPath)) {
            sendProgress(downloadId, "File already exists, providing link.", { url: publicUrl, filename: clientFilename });
            return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });
        }

        console.log(`[${downloadId}] [${videoId}] Starting server-side video download`);
        sendProgress(downloadId, "Downloading video stream");
        await new Promise<void>((resolve, reject) => {
            const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { format: videoFormat });
            const out = fs.createWriteStream(tempVideoPath);
            stream.pipe(out);
            stream.on('error', (err) => { console.error(`[${downloadId}] [${videoId}] Video stream error:`, err); reject(err); });
            out.on('finish', resolve);
            out.on('error', (err) => { console.error(`[${downloadId}] [${videoId}] Video write stream error:`, err); reject(err); });
        });

        if (videoFormat.hasAudio === false && audioFormat) {
            console.log(`[${downloadId}] [${videoId}] Starting server-side audio download`);
            sendProgress(downloadId, "Downloading audio stream");
            await new Promise<void>((resolve, reject) => {
                const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { format: audioFormat });
                const out = fs.createWriteStream(tempAudioPath);
                stream.pipe(out);
                stream.on('error', (err) => { console.error(`[${downloadId}] [${videoId}] Audio stream error:`, err); reject(err);});
                out.on('finish', resolve);
                out.on('error', (err) => { console.error(`[${downloadId}] [${videoId}] Audio write stream error:`, err); reject(err);});
            });

            console.log(`[${downloadId}] [${videoId}] Starting server-side merging with ffmpeg`);
            sendProgress(downloadId, "Merging video and audio");
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(tempVideoPath)
                    .input(tempAudioPath)
                    .videoCodec('copy')
                    .audioCodec('aac')
                    .on('end', () => {
                        console.log(`[${downloadId}] [${videoId}] Merge complete`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`[${downloadId}] [${videoId}] ffmpeg error:`, err.message);
                        reject(err);
                    })
                    .save(mergedPath);
            });
        } else if (videoFormat.hasAudio === true) {
             console.log(`[${downloadId}] [${videoId}] Video format includes audio. Skipping separate audio download and merge.`);
             sendProgress(downloadId, "Video includes audio, skipping merge.");
             fs.renameSync(tempVideoPath, mergedPath);
        } else {
            throw new Error("No audio available for the video.");
        }

        console.log(`[${downloadId}] [${videoId}] Done. Available at: ${publicUrl}`);

        // TODO: Implement cleanup feature and S3 caching
        // Clean up temporary files
        // if (fs.existsSync(tempVideoPath) && tempVideoPath !== mergedPath) fs.unlinkSync(tempVideoPath);
        // if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
        return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });

    } catch (err: unknown) { // Catch specific errors if possible
        const error = err as Error;

        console.error(`[${downloadId}] [${videoId}] Download error:`, error);
        sendProgress(downloadId, `Error: ${error.message || 'An unknown error occurred.'}`, { error: true, final: true });

        // Clean up temp files on error
        // if (tempVideoPath && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        // if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);

        // TODO: QC on All Error
        let message = 'An unknown error occurred during download.';
        let status = 500;
    
        if (error.message) {
            if (error.message.includes('private') || error.message.includes('unavailable')) {
                status = 404; message = 'Video not found, is private, or unavailable.';
            } else if (error.message.includes('confirm your age')) {
                status = 403; message = 'Age-restricted video. Cannot process.';
            } else if (error.message.includes('Failed to fetch video stream') || error.message.includes('Status code: 403')) {
                status = 502; message = 'Server error: Could not fetch video from source (possibly due to restrictions).';
            } else {
                message = error.message;
            }
        }
        return new Response(JSON.stringify({ error: message }), { status: status });
    }
}