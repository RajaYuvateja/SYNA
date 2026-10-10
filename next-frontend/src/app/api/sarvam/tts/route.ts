import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inputs, target_language_code, speaker, model } = body;

    const apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
      // Mock TTS endpoint returning empty audio or placeholder for demo
      return NextResponse.json({
        audios: [],
        mode: "demonstration_mock",
        message: "TTS available with valid SARVAM_API_KEY",
      });
    }

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        inputs: inputs || ["మీ సమాచారం ధృవీకరించబడింది"],
        target_language_code: target_language_code || "te-IN",
        speaker: speaker || "meera",
        model: model || "bulbul:v1",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: "Sarvam TTS failed", details: errText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "TTS proxy error", message: error.message },
      { status: 500 }
    );
  }
}
