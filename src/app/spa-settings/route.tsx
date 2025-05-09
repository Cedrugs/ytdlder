import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
    const SITE_URL = process.env.SITE_URL
    return new Response(JSON.stringify({ SITE_URL: SITE_URL  }));
}