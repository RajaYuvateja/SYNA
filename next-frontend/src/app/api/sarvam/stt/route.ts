import { NextRequest, NextResponse } from "next/server";

function detectLanguageFromText(text: string, fallback: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari (Hindi)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml"; // Malayalam
  if (/[\u0980-\u09FF]/.test(text)) return "bn"; // Bengali
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu"; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa"; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return "or"; // Odia
  return fallback;
}

function normalizeLangCode(code: string): string {
  const c = code.toLowerCase().trim();
  if (c.startsWith("hi")) return "hi";
  if (c.startsWith("te")) return "te";
  if (c.startsWith("ta")) return "ta";
  if (c.startsWith("kn")) return "kn";
  if (c.startsWith("ml")) return "ml";
  if (c.startsWith("bn")) return "bn";
  if (c.startsWith("mr")) return "mr";
  if (c.startsWith("gu")) return "gu";
  if (c.startsWith("pa")) return "pa";
  if (c.startsWith("or")) return "or";
  if (c.startsWith("en")) return "en";
  return c;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const rawLang = (formData.get("language_code") as string) || "hi";
    const cleanLang = normalizeLangCode(rawLang);

    const apiKey = process.env.SARVAM_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // 1. Primary: Sarvam AI Saaras/Saarika Speech-to-Text
    if (apiKey && file) {
      try {
        const sarvamLang = cleanLang === "en" ? "en-IN" : `${cleanLang}-IN`;
        const sarvamFormData = new FormData();
        sarvamFormData.append("file", file);
        sarvamFormData.append("language_code", sarvamLang);
        sarvamFormData.append("model", "saarika:v2.5");

        const response = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: {
            "api-subscription-key": apiKey,
          },
          body: sarvamFormData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transcript && data.transcript.trim()) {
            const transcript = data.transcript.trim();
            const detectedLang = detectLanguageFromText(transcript, cleanLang);
            return NextResponse.json({
              transcript,
              language_code: detectedLang,
              confidence: data.language_probability || data.confidence || 0.95,
              duration: data.duration || 5.0,
            });
          }
        } else {
          const errDetail = await response.text();
          console.warn("[Next STT Proxy] Sarvam STT HTTP error:", response.status, errDetail);
        }
      } catch (err) {
        console.warn("[Next STT Proxy] Sarvam STT exception:", err);
      }
    }

    // 2. Secondary: GroqCloud Whisper Large v3 (ultra-fast transcription for Hindi, Telugu, Tamil, etc.)
    if (groqKey && file) {
      try {
        const groqFormData = new FormData();
        groqFormData.append("file", file);
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("response_format", "verbose_json");
        if (cleanLang && cleanLang !== "en") {
          groqFormData.append("language", cleanLang);
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqFormData,
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          if (groqData.text && groqData.text.trim()) {
            const transcript = groqData.text.trim();
            const detectedLang = detectLanguageFromText(transcript, cleanLang);
            return NextResponse.json({
              transcript,
              language_code: detectedLang,
              confidence: 0.95,
              duration: groqData.duration || 5.0,
            });
          }
        } else {
          const gErr = await groqRes.text();
          console.warn("[Next STT Proxy] Groq Whisper HTTP error:", groqRes.status, gErr);
        }
      } catch (err) {
        console.warn("[Next STT Proxy] Groq Whisper failed:", err);
      }
    }

    // 3. Fallback: FastAPI backend endpoint
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const backendRes = await fetch(`${backendUrl}/api/speech/transcribe-translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: cleanLang,
        }),
      });
      if (backendRes.ok) {
        const bData = await backendRes.json();
        if (bData.original_text) {
          const transcript = bData.original_text;
          const detectedLang = detectLanguageFromText(transcript, cleanLang);
          return NextResponse.json({
            transcript,
            language_code: detectedLang,
            confidence: bData.confidence || 0.90,
          });
        }
      }
    } catch {
      // Backend unavailable
    }

    return NextResponse.json(
      { error: "Speech recognition unavailable. Please use manual entry or check microphone." },
      { status: 502 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "STT proxy error", message: error.message },
      { status: 500 }
    );
  }
}
