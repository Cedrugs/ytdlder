import { NextRequest } from "next/server";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import ytdl from "@distube/ytdl-core";

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

export async function GET(request: NextRequest)  {
    try {
        const searchParams = request.nextUrl.searchParams;
        const videoId = searchParams.get("videoId");
        const itag = searchParams.get("itag");
    
        if (!videoId || !itag || typeof videoId !== 'string' || typeof itag !== 'string') {
            return new Response(JSON.stringify({ error: "Video ID and format tag (itag) are required"}), { status: 400 });
        }
    
        const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`[${videoId}] Incoming download request | itag: ${itag}`);

        let tempVideoPath = '';
        let tempAudioPath = '';
        let mergedPath = '';
        
        console.log(`[${videoId}] Fetching video info`);
        const info = await ytdl.getInfo(videoURL);
        const videoFormat = ytdl.chooseFormat(info.formats, { quality: itag });
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

        if (!videoFormat) {
            return new Response(JSON.stringify({ error: "Requested video format (itag) not found"}), { status: 404 });
        }

        if (!audioFormat) {
            return new Response(JSON.stringify({ error: "Requested video doesn't have audio"}), { status: 404 });
        }

        const videoTitle = info.videoDetails.title.replace(/[^a-zA-Z0-9\-_ ]/g, '_').replace(/ /g, '_');
        const fileExtension = videoFormat.container || 'mp4';

        const uniqueSuffix = `${videoId}_${itag}_${Date.now()}`;

        tempVideoPath = path.join(tempDir, `${uniqueSuffix}_video.${fileExtension}`);
        tempAudioPath = path.join(tempDir, `${uniqueSuffix}_audio${fileExtension}`);

        const clientFilename = `${videoTitle}_${videoFormat.qualityLabel || itag}.${fileExtension}`;
        mergedPath = path.join(tempDir, `${clientFilename}`);

        const baseURL = new URL(process.env.SITE_URL || request.nextUrl);
        const publicUrl = `${baseURL.origin}/api/files/${clientFilename}`;

        console.log(`[${videoId}] Format chosen: ${videoFormat.qualityLabel} (${videoFormat.mimeType}).`);
        
        if (fs.existsSync(mergedPath)) {
            return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });
        }

        console.log(`[${videoId}] Starting server-side video download from YouTube`);
        await new Promise<void>((resolve, reject) => {
            const stream = ytdl(videoURL, { format: videoFormat });
            const out = fs.createWriteStream(tempVideoPath);
            stream.pipe(out);
            stream.on('error', reject);
            out.on('finish', resolve);
            out.on('error', reject);
        });

        console.log(`[${videoId}] Starting server-side audio download from YouTube`);
        await new Promise<void>((resolve, reject) => {
            const stream = ytdl(videoURL, { format: audioFormat });
            const out = fs.createWriteStream(tempAudioPath);
            stream.pipe(out);
            stream.on('error', reject);
            out.on('finish', resolve);  
            out.on('error', reject);
        });

        console.log(`[${videoId}] Starting server-side merging with ffmpeg`);
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(tempVideoPath)
                .input(tempAudioPath)
                .videoCodec('copy')
                .audioCodec('aac')
                .on('end', () => {
                    console.log(`[${videoId}] Merge complete`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`[${videoId}] ffmpeg error:`, err.message);
                    reject(err);
                })
                .save(mergedPath);
        });

        console.log(`[${videoId}] Done. Available at ${publicUrl}`);

        fs.unlinkSync(tempVideoPath);
        fs.unlinkSync(tempAudioPath);
        
        return new Response(JSON.stringify({ url: publicUrl, filename: clientFilename }), { status: 200 });
    } catch (error: unknown) {
        console.error(`Download error:`, error);

        let message = 'An unknown error occurred';
        let status = 500;
    
        if (error instanceof Error) {
            if (error.message.includes('private') || error.message.includes('unavailable')) {
                status = 404;
                message = 'Video not found, is private, or unavailable.';
            } else if (error.message.includes('confirm your age')) {
                status = 403;
                message = 'Age-restricted video. Cannot process.';
            } else if (error.message.includes('Failed to fetch video stream')) {
                status = 502;
                message = 'Server error: Could not fetch video from source.';
            } else {
                message = 'An unexpected server error occurred during download.';
            }
        }
    
        return new Response(JSON.stringify({ error: message }), { status: status });
    }
}