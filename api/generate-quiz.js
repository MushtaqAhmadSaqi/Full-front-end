// api/generate-quiz.js
// ─────────────────────────────────────────────────────────────────────────────
// Secure AI quiz generation endpoint.
// Requires a valid Supabase user session (Bearer token) and enforces a
// per-user 10-generation limit via an atomic Postgres function.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const AI_QUIZ_LIMIT = 10;

// ── Supabase admin client (server-side only, never sent to browser) ───────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helper: extract Bearer token from Authorization header ────────────────────
function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Check for required server env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({
      error:
        "Server configuration error. Contact the site administrator.",
    });
  }

  // 2. Require auth token
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "Please sign in to generate AI quizzes.",
    });
  }

  // 3. Validate request body
  const {
    subject,
    subjectCode = "",
    examType = "midterm",
    topics = "",
    questionCount = 10,
    difficulty = "balanced",
  } = req.body || {};

  if (!subject) {
    return res.status(400).json({ error: "Subject is required" });
  }

  // 4. Require Gemini API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY is not configured. Add it in Vercel Project Settings → Environment Variables, then redeploy.",
    });
  }

  // 5. Verify the Supabase session token
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({
      error: "Your session is invalid or expired. Please sign in again.",
    });
  }

  const userId = userData.user.id;

  // 6. Atomically check + increment generation count (prevents race conditions)
  const { data: usageRows, error: usageError } = await supabaseAdmin.rpc(
    "reserve_ai_quiz_generation",
    {
      p_user_id: userId,
      p_limit: AI_QUIZ_LIMIT,
    }
  );

  if (usageError) {
    console.error("AI quiz usage RPC error:", usageError);
    return res.status(500).json({
      error: "Could not verify your AI quiz usage limit. Please try again.",
    });
  }

  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;

  if (!usage?.allowed) {
    return res.status(429).json({
      error: `You have reached your free AI quiz generation limit (${AI_QUIZ_LIMIT} quizzes per account). Contact support if you need more.`,
      usage: {
        used: usage?.used ?? AI_QUIZ_LIMIT,
        remaining: 0,
        limit: AI_QUIZ_LIMIT,
      },
    });
  }

  // 7. Call Gemini AI
  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const safeQuestionCount = Math.min(
      Math.max(Number(questionCount) || 10, 1),
      20
    );

    const subjectLabel = subjectCode ? `${subject} (${subjectCode})` : subject;

    const prompt = `
You are an expert COMSATS University exam coach.

Create a high-quality ${safeQuestionCount}-question multiple-choice quiz for:

Subject: ${subjectLabel}
Exam Type: ${examType}
Difficulty: ${difficulty}
${topics ? `Focus Topics: ${topics}` : ""}

Return ONLY valid JSON. No markdown. No explanation outside JSON.

Use this exact format:
{
  "title": "COMSATS ${subjectLabel} ${String(examType).charAt(0).toUpperCase() + String(examType).slice(1)} Quiz",
  "questions": [
    {
      "question": "Clear question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief educational explanation of the correct answer."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result?.response?.text?.();

    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    let quizData;

    try {
      quizData = JSON.parse(responseText.replace(/```json|```/g, "").trim());
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Gemini did not return valid JSON.");
      }
      quizData = JSON.parse(jsonMatch[0]);
    }

    if (!quizData || !Array.isArray(quizData.questions)) {
      throw new Error("AI returned invalid quiz format.");
    }

    if (quizData.questions.length === 0) {
      throw new Error("AI returned zero questions.");
    }

    quizData.questions = quizData.questions.map((q, index) => {
      const options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];

      if (options.length !== 4) {
        throw new Error(
          `Question ${index + 1} does not have exactly 4 options.`
        );
      }

      const correctAnswer = Number.isInteger(q.correctAnswer)
        ? q.correctAnswer
        : 0;

      return {
        question: String(q.question || "").trim(),
        options,
        correctAnswer:
          correctAnswer >= 0 && correctAnswer <= 3 ? correctAnswer : 0,
        explanation: String(
          q.explanation || "No explanation provided."
        ).trim(),
      };
    });

    quizData.metadata = {
      subject,
      subjectCode,
      examType,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      provider: `Google Gemini - ${GEMINI_MODEL}`,
    };

    // Return usage info so the frontend can show the remaining count
    quizData.usage = {
      used: usage.used,
      remaining: usage.remaining,
      limit: AI_QUIZ_LIMIT,
    };

    return res.status(200).json(quizData);
  } catch (error) {
    console.error("Gemini quiz generation error:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Failed to generate quiz. Please try again or simplify the topics.",
    });
  }
}
