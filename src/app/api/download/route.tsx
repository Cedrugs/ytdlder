import { NextRequest } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import ytdl from "@distube/ytdl-core";
import { sendProgress, ensureWebSocketServerRunning } from "@/app/lib/websocket";
import { uploadFile } from "@/app/services/s3";

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

    // Check if videoId, itag, and downloadId is present
    if (!videoId || !itag || !downloadId || typeof videoId !== 'string' || typeof itag !== 'string' || typeof downloadId !== 'string') {
        return new Response(JSON.stringify({ error: "Video ID and format tag (itag) are required" }), { status: 400 });
    }

    try {
        // Make folder for grouping per videoId
        fs.mkdirSync(path.join(tempDir, `/${videoId}`), { recursive: true });

        console.log(`[${downloadId}] [${videoId}] Fetching video info`);

        // Set video & audio format
        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
        const videoFormat = ytdl.chooseFormat(info.formats, { quality: itag });
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

        // TODO: Fix this whether to skip audio or return error
        if (!audioFormat && videoFormat.hasAudio === false) {
            return new Response(JSON.stringify({ error: "Requested video format doesn't have audio" }), { status: 404 });
        }

        const videoTitle = info.videoDetails.title.replace(/[^a-zA-Z0-9\-_ ]/g, '_').replace(/ /g, '_');
        
        const fileExtension = videoFormat.container || 'mp4';
        const uniqueSuffix = `${videoId}_${itag}_${Date.now()}`;
        tempVideoPath = path.join(tempDir, `${videoId}/${uniqueSuffix}_video.${fileExtension}`);

        const audioFileExtension = audioFormat?.container || 'm4a';
        tempAudioPath = path.join(tempDir, `${videoId}/${uniqueSuffix}_audio.${audioFileExtension}`);

        let clientFilename = `${videoTitle}_${videoFormat.qualityLabel || itag}.${fileExtension}`;
        
        if (videoFormat.mimeType?.includes("audio")) {
            clientFilename = `${videoTitle}.mp3`;
        }
        
        mergedPath = path.join(tempDir, `${videoId}/${clientFilename}`);

        const baseURL = new URL(process.env.SITE_URL || request.nextUrl.origin);
        let publicUrl = `${baseURL.origin}/api/files/${videoId}/${clientFilename}`;

        console.log(`[${downloadId}] [${videoId}] Format chosen: ${videoFormat.qualityLabel} (${videoFormat.mimeType}).`);

        // If video already exists then just serve the video
        if (fs.existsSync(mergedPath)) {
            sendProgress(downloadId, "File already exists, providing link.", { url: publicUrl, filename: clientFilename });
            return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });
        }

        // Check if the user is only downloading the audio
        if (!videoFormat.mimeType?.includes("audio")) {
            // Download the video
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
        }

        // Download the audio
        if ((videoFormat.hasAudio === false && audioFormat) || videoFormat.mimeType?.includes("audio")) {
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
        } else if (videoFormat.hasAudio === true) { // Skip if video comes with audio
             console.log(`[${downloadId}] [${videoId}] Video format includes audio. Skipping separate audio download and merge.`);
             sendProgress(downloadId, "Video includes audio, skipping merge.");
             fs.renameSync(tempVideoPath, mergedPath);
        } else {
            throw new Error("No audio available for the video.");
        }

        // Only convert to mp3
        if (videoFormat.mimeType?.includes("audio")) {
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(tempAudioPath)
                    .audioCodec('libmp3lame')
                    .toFormat('mp3')
                    .on('end', () => {
                        console.log(`[${downloadId}] [${videoId}] MP3 Conversion complete`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`[${downloadId}] [${videoId}] ffmpeg error:`, err.message);
                        reject(err);
                    })
                    .save(mergedPath);
            })
        }

        if (!videoFormat.mimeType?.includes("audio")) {
            // Merge with ffmpeg
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
        }

        // Implemented S3 storage
        if (process.env.STORAGE === "s3") {
            await uploadFile(`${videoId}/${clientFilename}`, mergedPath);
            publicUrl = `${process.env.S3_ENDPOINT}/ytdlder/${videoId}/${clientFilename}`;
            if (fs.existsSync(mergedPath)) fs.unlinkSync(mergedPath);
        }

        console.log(`[${downloadId}] [${videoId}] Done. Available at: ${publicUrl}`);

        return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });
    } catch (err: unknown) {
        const error = err as Error;

        if (error.message.includes("Video unavailable")) {
            return new Response(JSON.stringify({ error: "This video is unavailable" }), { status: 404 });
        } else if (error.message.includes("This is a private video")) {
            return new Response(JSON.stringify({ error: "This video is private" }), { status: 403 });
        } else if (error.message.includes("Sign in to confirm your age")) {
            return new Response(JSON.stringify({ error: "This video is age restricted" }), { status: 403 });
        } else if (error.message.includes("No audio available")) {
            return new Response(JSON.stringify({ error: "No audio available for the video" }), { status: 404 });
        } else {
            console.error(`[${downloadId}] [${videoId}] Download error:`, error);
            return new Response(JSON.stringify({ error: "An unknown error occurred during download." }), { status: 500 });
        }
    } finally {
        // Clean up temp files
        if (fs.existsSync(tempVideoPath) && tempVideoPath !== mergedPath) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    }
}