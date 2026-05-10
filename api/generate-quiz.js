// api/generate-quiz.js

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    subject,
    examType = "midterm",
    topics = "",
    questionCount = 10,
    difficulty = "balanced",
  } = req.body || {};

  if (!subject) {
    return res.status(400).json({ error: "Subject is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY is not configured. Add it in Vercel Project Settings → Environment Variables, then redeploy.",
    });
  }

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

    const prompt = `
You are an expert COMSATS University exam coach.

Create a high-quality ${safeQuestionCount}-question multiple-choice quiz for:

Subject: ${subject}
Exam Type: ${examType}
Difficulty: ${difficulty}
${topics ? `Focus Topics: ${topics}` : ""}

Return ONLY valid JSON. No markdown. No explanation outside JSON.

Use this exact format:

{
  "title": "COMSATS ${subject} ${String(examType).charAt(0).toUpperCase() + String(examType).slice(1)} Quiz",
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
        throw new Error(`Question ${index + 1} does not have exactly 4 options.`);
      }

      const correctAnswer = Number.isInteger(q.correctAnswer)
        ? q.correctAnswer
        : 0;

      return {
        question: String(q.question || "").trim(),
        options,
        correctAnswer:
          correctAnswer >= 0 && correctAnswer <= 3 ? correctAnswer : 0,
        explanation: String(q.explanation || "No explanation provided.").trim(),
      };
    });

    quizData.metadata = {
      subject,
      examType,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      provider: `Google Gemini - ${GEMINI_MODEL}`,
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
