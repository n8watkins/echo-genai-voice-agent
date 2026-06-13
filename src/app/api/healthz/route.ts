import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'echo',
    hasDemoKey: !!process.env.GEMINI_API_KEY,
    model: process.env.ECHO_MODEL?.trim() || 'gemini-3.1-flash-lite',
    time: new Date().toISOString(),
  });
}
