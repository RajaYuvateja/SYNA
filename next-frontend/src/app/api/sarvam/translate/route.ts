import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { input, source_language_code, target_language_code } = body;

    if (!input || !input.trim()) {
      return NextResponse.json({
        source_text: "",
        translated_text: "",
        target_language_code: target_language_code || "en-IN",
      });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Detect script if text is Devanagari (Hindi) or Telugu, etc.
    let cleanSrc = (source_language_code || "").split("-")[0].toLowerCase();
    if (/[\u0900-\u097F]/.test(input) && cleanSrc !== "mr") {
      cleanSrc = "hi";
    } else if (/[\u0C00-\u0C7F]/.test(input)) {
      cleanSrc = "te";
    } else if (/[\u0B80-\u0BFF]/.test(input)) {
      cleanSrc = "ta";
    } else if (/[\u0C80-\u0CFF]/.test(input)) {
      cleanSrc = "kn";
    }
    if (!cleanSrc) cleanSrc = "hi";

    const cleanTgt = (target_language_code || "en").split("-")[0].toLowerCase();
    const sarvamSrcCode = cleanSrc === "en" ? "en-IN" : `${cleanSrc}-IN`;
    const sarvamTgtCode = cleanTgt === "en" ? "en-IN" : `${cleanTgt}-IN`;

    if (sarvamSrcCode === sarvamTgtCode) {
      return NextResponse.json({
        source_text: input,
        source_language_code: cleanSrc,
        translated_text: input,
        target_language_code: cleanTgt,
        confidence: 1.0,
      });
    }

    // 1. Primary: Sarvam Mayura Translation
    if (apiKey) {
      try {
        const response = await fetch("https://api.sarvam.ai/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": apiKey,
          },
          body: JSON.stringify({
            input: input.trim(),
            source_language_code: sarvamSrcCode,
            target_language_code: sarvamTgtCode,
            model: "mayura:v1",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.translated_text && data.translated_text.trim()) {
            return NextResponse.json({
              source_text: input,
              source_language_code: cleanSrc,
              translated_text: data.translated_text.trim(),
              target_language_code: sarvamTgtCode,
              confidence: data.confidence || 0.95,
            });
          }
        } else {
          const tErr = await response.text();
          console.warn("[Next Translate Proxy] Sarvam translation HTTP error:", response.status, tErr);
        }
      } catch (err) {
        console.warn("[Next Translate Proxy] Sarvam translation error:", err);
      }
    }

    // 2. Secondary: Groq LLM Translation (supports Telugu, Hindi, Tamil, Kannada, Bengali, etc.)
    if (groqKey) {
      try {
        const LANG_NAMES: Record<string, string> = {
          te: "Telugu",
          hi: "Hindi",
          ta: "Tamil",
          kn: "Kannada",
          ml: "Malayalam",
          bn: "Bengali",
          mr: "Marathi",
          en: "English",
        };
        const srcName = LANG_NAMES[cleanSrc] || cleanSrc;
        const tgtName = LANG_NAMES[cleanTgt] || "English";

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
            messages: [
              {
                role: "system",
                content: `You are an expert multilingual clinical triage translator. Translate accurately from ${srcName} into ${tgtName}. Preserve symptoms, severity, and clinical meaning faithfully. Respond ONLY with the direct translation text.`,
              },
              { role: "user", content: input.trim() },
            ],
            temperature: 0.1,
            max_tokens: 250,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const translated = groqData.choices?.[0]?.message?.content?.trim()?.replace(/^"|"$/g, "");
          if (translated) {
            return NextResponse.json({
              source_text: input,
              source_language_code: cleanSrc,
              translated_text: translated,
              target_language_code: sarvamTgtCode,
              confidence: 0.93,
            });
          }
        }
      } catch (err) {
        console.warn("[Next Translate Proxy] Groq translation error:", err);
      }
    }

    // 3. Fallback: Return original text safely rather than hardcoding incorrect clinical conditions
    return NextResponse.json({
      source_text: input,
      source_language_code: cleanSrc,
      translated_text: input,
      target_language_code: sarvamTgtCode,
      confidence: 0.70,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Translate proxy error", message: error.message },
      { status: 500 }
    );
  }
}
