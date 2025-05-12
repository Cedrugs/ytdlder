# ytdlder 

## Overview  
**ytdlder** is a lightweight, open-source YouTube video downloader designed to simplify downloading videos in high quality without ads or unnecessary bloat. Built with modern web technologies, it ensures fast, reliable downloads with support for multiple formats and resolutions.  

## Key Features  
- **High-Quality Downloads**: Supports 1080p, 4K, and other resolutions with audio  
- **Multiple Formats**: Download videos as MP4 or extract audio-only MP3  
- **No Ads or Tracking**: Completely ad-free and privacy-focused  
- **Simple Interface**: Minimalist UI for quick and easy use  
- **Self-Hostable**: Deploy locally or on your own server for full control  

## Technologies Used  
- **Frontend**: Next.js, TypeScript, Tailwind CSS  
- **Backend**: Node.js, @distube/ytdl-core, ffmpeg
- **Deployment**: Docker, Nginx  

## Installation  

### Prerequisites  
- Node.js (v18+)  
- Docker (optional, for containerized deployment)  

### Steps  
1. Clone the repository:  
   ```bash
   git clone https://github.com/Cedrugs/ytdlder.git
   cd ytdlder
   ```  
2. Install dependencies:  
   ```bash
   npm install
   ```  
3. Configure environment variables:  
   - Copy `.env.example` to `.env` and fill in required values  
4. Run the development server:  
   ```bash
   npm run dev
   ```  
5. For production deployment (Docker):  

    1. Build the image
    ```bash
    docker build -t ytdlder .
    ```
    2. Run the image
    ```bash
    # Docker compose
    services:
      ytdlder:
        image: ytdlder
        container_name: proj-ytdlder
        restart: unless-stopped
        environment:
        - SITE_URL=https://yoursite.com
        ports:
        - 3301:3000
        - 3302:3001
    ```
    ```bash
    # Docker run
    docker run -d \
    --name proj-ytdlder \
    --restart unless-stopped \
    --network proxy \
    -e SITE_URL=https://yoursite.com \
    -p 3301:3000 \
    -p 3302:3001 \
    ytdlder
    ```

## Usage  
1. Open the app in your browser  
2. Paste a YouTube URL into the input field  
3. Select your preferred format and resolution  
4. Click **Download** and wait for the file to process  

## Contributing  
Contributions are welcome! Please follow these steps:  
1. Fork the repository  
2. Create a new branch (`git checkout -b feature/your-feature`)  
3. Commit your changes (`git commit -m "Add your feature"`)  
4. Push to the branch (`git push origin feature/your-feature`)  
5. Open a Pull Request

## License  
This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.  

## Contact  
For questions or feedback, reach out at:
- **Email**: [ceds.sam@gmail.com](mailto:ceds.sam@gmail.com)  
- **GitHub Issues**: [https://github.com/Cedrugs/ytdlder/issues](https://github.com/Cedrugs/ytdlder/issues)  