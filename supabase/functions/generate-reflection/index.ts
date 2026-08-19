// supabase/functions/generate-reflection/index.ts
//
// 用途：接收「課程名稱」+「關鍵字」，呼叫 Google Gemini API，
//       回傳一段 50~80 字、口吻溫馨的樂齡學員心得短文。
//
// 安全性重點：
// 1. GEMINI_API_KEY 只存在 Supabase Edge Function 的環境變數（secrets），
//    前端永遠拿不到這把 key。
// 2. 呼叫者必須帶有效的 Supabase Auth JWT（登入後的 access token），
//    未登入者會被擋下，避免被濫用來打 Gemini 額度。
//
// 部署方式：
//   supabase functions deploy generate-reflection
//   supabase secrets set GEMINI_API_KEY=你的Gemini金鑰
//
// 前端呼叫方式（於已登入狀態）：
//   const { data, error } = await supabase.functions.invoke("generate-reflection", {
//     body: { courseName, keywords },
//   });

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.5-flash";

function buildPrompt(courseName: string, keywords: string) {
  return `你是一位參加「${courseName}」課程的樂齡（銀髮）學員，個性溫暖、講話真誠自然，帶一點長輩特有的樸實語氣。
請根據以下幾個關鍵字，幫忙寫一段「上課心得」：
關鍵字：${keywords}

寫作規則：
- 字數約 50～80 字（中文字數），不要超過太多。
- 用第一人稱、口吻溫馨真誠，像長輩在分享心得，不要用制式或過度華麗的詞藻。
- 內容要通順、有畫面感，圍繞關鍵字與課程名稱展開，不要條列，寫成一段完整短文即可。
- 不要加上任何標題、引號、星號、Emoji 或多餘說明文字。
- 直接輸出心得本文，不要有「好的」「以下是」這類開場白。`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 1. 驗證使用者是否已登入 ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "請先登入後台再使用此功能" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "登入狀態已失效，請重新登入" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 2. 解析輸入 ----
    const body = await req.json().catch(() => null);
    const courseName = (body?.courseName ?? "").toString().trim();
    const keywords = (body?.keywords ?? "").toString().trim();

    if (!courseName) {
      return new Response(JSON.stringify({ error: "缺少課程名稱" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!keywords) {
      return new Response(JSON.stringify({ error: "請輸入幾個心得關鍵字" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 3. 呼叫 Gemini API ----
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set");
      return new Response(JSON.stringify({ error: "伺服器尚未設定 AI 金鑰" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(courseName, keywords);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return new Response(JSON.stringify({ error: "AI 生成失敗，請稍後再試" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiJson = await geminiRes.json();
    const rawText: string | undefined =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return new Response(JSON.stringify({ error: "AI 沒有回傳內容，請重試" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 去除多餘的引號、星號、前後空白，回傳乾淨文字
    const cleanText = rawText
      .replace(/^["'「『\s]+|["'」』\s]+$/g, "")
      .replace(/\*\*/g, "")
      .trim();

    return new Response(JSON.stringify({ content: cleanText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-reflection unexpected error:", err);
    return new Response(JSON.stringify({ error: "伺服器發生未預期錯誤" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
