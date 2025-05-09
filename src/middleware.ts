import { NextRequest, NextResponse } from "next/server"

export const config = {
    matcher: ["/api/download", "/api/video-info"],
}

export function middleware(request: NextRequest) {
    const serverOrigin = process.env.SITE_URL || "";

    const referer = request.headers.get("referer") ?? "";

    if (!referer.startsWith(serverOrigin)) {
        return NextResponse.json({ error: "Some API are currently not available externally" }, { status: 403 });
    }

    const response = NextResponse.next()
    return response
}
