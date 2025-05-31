import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";

const s3 = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
});

export async function uploadFile(fileName: string, filePath: string) {
    const fileStream = fs.createReadStream(filePath);
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            console.log("[ytdlder] Uploading file to S3");
            const command = new PutObjectCommand({
                Bucket: "ytdlder",
                Key: fileName,
                Body: fileStream
            });

            const response = await s3.send(command);
            console.log("[ytdlder] File uploaded successfully to S3: ");

            return response;
        } catch(err) {
            retryCount++;
            console.error(`[ytdlder] File upload failed: ${err}. Retry attempt ${retryCount} of ${maxRetries}`);
            if (retryCount === maxRetries) {
                console.error("[ytdlder] File upload failed after maximum retries: ", err);
                throw err;
            }
            // Wait for a short period before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
    }
}