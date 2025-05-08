"use client"
import React, { useState } from "react"
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
    const [selectedFormat, setSelectedFormat] = useState({
        "videoId": "",
        "itag": 0
    })
    const [formData, setFormData] = useState({
        url: "",
    });

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
            setVideoData(data);
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
    
        try {
            const res = await fetch(`/api/download?videoId=${selectedFormat.videoId}&itag=${selectedFormat.itag}`);

            const data = await res.json();
            const a = document.createElement("a");

            console.log(data);

            a.href = data.url;
            a.download = data.filename;

            console.log(a);
            a.click();
        } catch (err) {
            console.error(err);
            setError("Failed to download video");
        } finally {
            setIsDownloading(false);
            setIsLoading(false);
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
                        </motion.div>
                    </AnimatePresence>
                )}
            </section>
        </>
    )
}