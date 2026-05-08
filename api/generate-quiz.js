// api/generate-quiz.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, examType = 'midterm', topics = '', questionCount = 10, difficulty = 'balanced' } = req.body || {};

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured. Please add it in your Vercel project settings (Settings → Environment Variables).'
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are an expert COMSATS University exam coach. Create a high-quality ${questionCount}-question multiple-choice quiz for "${subject}" (${examType} level).
${topics ? `Focus especially on these topics: ${topics}.` : ''}
Difficulty: ${difficulty}.
Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "title": "COMSATS ${subject} ${examType.charAt(0).toUpperCase() + examType.slice(1)} Quiz",
  "questions": [
    {
      "question": "Clear question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief educational explanation of the correct answer."
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let quizData;
    try {
      quizData = JSON.parse(responseText.replace(/```json|```/g, '').trim());
    } catch (parseErr) {
      // Fallback: try to extract JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      quizData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    }

    if (!quizData || !Array.isArray(quizData.questions)) {
      throw new Error('AI returned invalid quiz format');
    }

    quizData.metadata = {
      subject,
      examType,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      provider: "Google Gemini 1.5 Flash"
    };

    return res.status(200).json(quizData);
  } catch (error) {
    console.error('Gemini quiz generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate quiz. Please try again or simplify the topics.'
    });
  }
}
