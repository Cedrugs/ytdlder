"use client"
import React, { useState, useRef } from "react"
import { urlSchema } from "./types/validation";
import { VideoInfo } from "./types/videos";
import Dropdown from "./components/Dropdown";
import { motion, AnimatePresence } from 'framer-motion';
import Image from "next/image";

export default function Landing() {
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [videoData, setVideoData] = useState<VideoInfo | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<string>('');
    const [selectedFormat, setSelectedFormat] = useState({
        "videoId": "",
        "itag": 0
    })
    const [formData, setFormData] = useState({
        url: "",
    });

    const wsRef = useRef<WebSocket | null>(null);

    const setupWebSocket = async (downloadId: string) => {
        const siteURL = await fetch("/spa-settings").then((res) => res.json());

        const socket = new WebSocket(
            process.env.NODE_ENV === "development"
              ? `ws://localhost:3001?downloadId=${downloadId}`
              : `wss://${new URL(siteURL['SITE_URL'] ?? "").host}/ws?downloadId=${downloadId}`
        );
        wsRef.current = socket;

        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            setDownloadProgress(data.message);
        };

        socket.onerror = (err) => {
            console.error("WebSocket error:", err);
        };

        socket.onclose = () => {
            console.log("WebSocket closed");
        };
    };

    const resetSubmit = () => {
        setVideoData(null);
        setSelectedFormat({
            "videoId": "",
            "itag": 0
        });
        setError("");
        setIsLoading(false);
        setIsDownloading(false);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validation = urlSchema.safeParse(formData);

        if (!validation.success) {
            validation.error.issues.forEach(issue => {
                if (issue.path.includes("url")) {
                    setError("URL is required!");
                    return;
                }
            })
            return;
        }

        resetSubmit();
        setIsLoading(true);

        try {
            const res = await fetch("/api/video-info", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: formData.url }),
            });
    
            const data = await res.json();

            if (data["error"]){
                setError("Invalid URL!");
            } else {
                setVideoData(data);
            }
        } catch (err) {
            console.error("💥 Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        setIsLoading(true);
        setIsDownloading(true);
        setError("");

        const downloadId = Math.random().toString(36).substring(2, 10);
        setupWebSocket(downloadId);
        setDownloadProgress("Starting download");
    
        try {
            const res = await fetch(`/api/download?videoId=${selectedFormat.videoId}&itag=${selectedFormat.itag}&downloadId=${downloadId}`);

            const data = await res.json();
            const a = document.createElement("a");

            a.href = data.url;
            a.download = data.filename;

            a.click();
        } catch (err) {
            console.error(err);
            setError("Failed to download video");
        } finally {
            setIsDownloading(false);
            setIsLoading(false);

            setDownloadProgress("");
            wsRef.current?.close();
        }
    };    

    return (
        <>
            <section id="Download" className="flex items-center justify-center content-center h-[100vh] gap-8">
                <motion.div
                    animate={{
                        x: videoData ? -50 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="flex flex-col justify-center items-center bg-black p-20 rounded-2xl space-y-6 border-red-500 border-2 gap-2"
                >
                    <div className="flex flex-col gap-4 justify-center items-center">
                        <h1 className="text-7xl font-bold text-center text-red-500">ytdlder</h1>
                        <p className="text-red-500">Made with &lt;3 by cedric</p>
                    </div>
                    <form className="flex flex-col w-full gap-6" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            name="url"
                            placeholder="Paste YouTube URL here..."
                            value={formData.url}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-zinc-800 text-white rounded-xl focus:outline-none 
                                        focus:ring-2 focus:ring-red-500 placeholder-white"
                        />
                        <p className={error ? "text-red-500" : "hidden"}>{error}</p>
                        <button
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl 
                                        transition duration-300 disabled:cursor-no-drop disabled:bg-zinc-800"
                            disabled={isLoading}
                        >
                            Search
                        </button>
                    </form>
                </motion.div>

                {videoData && (
                    <AnimatePresence>
                        <motion.div
                            key="videoDataBox"
                            initial={{ x: -100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -100, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 80, damping: 15 }}
                            className="flex flex-col w-96 gap-4"
                        >
                            <Image 
                                src={videoData?.videoDetails?.thumbnail ?? ""}
                                alt={videoData?.videoDetails?.title} 
                                className="w-96 rounded-xl border-2 border-red-500" 
                                width={384}
                                height={216}
                                unoptimized
                            />
                            <p className="text-red-500 text-wrap">{videoData?.videoDetails?.title}</p>
                            <div className="flex flex-row w-full gap-4 items-center justify-center">
                                <div className="flex-grow">
                                    <Dropdown
                                        defaultValue={"Select video quality"}
                                        options={videoData?.formats?.map((format) => ({
                                            label: `${format.quality} - ${((format.size ?? 0) / (1024 * 1024) + 10).toFixed(2)} MB`,
                                            value: format.itag,
                                        })) ?? []}
                                        onChange={(itag) => {
                                            setSelectedFormat({
                                                videoId: videoData.videoDetails.videoId,
                                                itag: itag,
                                            });
                                        }}
                                    />
                                </div>
                                <button
                                    className={
                                        `text-white rounded-2xl w-16 h-14 flex justify-center items-center bg-red-500 hover:bg-red-600 
                                        disabled:bg-zinc-800 transition duration-300`
                                    }
                                    disabled={isDownloading}
                                    onClick={handleDownload}
                                >
                                    {isDownloading ? (
                                        <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined">download</span>
                                    )}
                                </button>
                            </div>
                            {isDownloading && (
                                <motion.div
                                key="videoDataBox"
                                initial={{ y: -100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -100, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 80, damping: 15 }}
                                className="flex flex-col w-96 gap-4"
                                >
                                    <p className="text-white bg-zinc-800 p-4 rounded-xl">[Log]: {downloadProgress}</p>
                                </motion.div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </section>
        </>
    )
}