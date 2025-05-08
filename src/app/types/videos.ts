interface VideoDetails {
    title: string;
    videoId: string;
    thumbnail: string;
}
   
interface VideoFormat {
    itag: number;
    quality: string;
    type?: string;
    codecs?: string;
    bitrate?: number;
    size?: number;
    fps?: number;
}
   
export interface VideoInfo {
    videoDetails: VideoDetails;
    formats: VideoFormat[];
}
