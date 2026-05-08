// api/generate-quiz.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, examType, topics, questionCount, difficulty, notes } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    // Choose model (most stable with highest quota)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // Build smart prompt with instructions embedded
    let prompt = `You are an expert COMSATS University Islamabad exam setter.
Create a high-quality, realistic exam-style quiz in JSON format.

RULES:
- Return ONLY valid JSON.
- Questions must be syllabus-aligned and undergraduate level.
- Include 1-2 lines explanation for each correct answer.

QUIZ SPECS:
- Subject: "${subject}"
- Exam Type: ${examType}
- Number of Questions: ${questionCount}
- Difficulty: ${difficulty}
- Topics: ${topics || "Full syllabus"}

${examType === 'midterm' 
  ? 'Focus on the first half of the syllabus. Conceptual and application questions.' 
  : 'Comprehensive coverage of the full syllabus. High-order thinking (analysis, evaluation).'}

${notes ? `Context from notes: ${notes}` : ''}

JSON FORMAT:
{
  "title": "${subject} - ${examType.toUpperCase()} Quiz",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation"
    }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const response = await result.response;
    let text = response.text();

    // Parse JSON safely
    let quizData;
    try {
      quizData = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", text);
      return res.status(500).json({ 
        error: "AI returned invalid format. Please try again with simpler topics." 
      });
    }

    // Add metadata
    quizData.metadata = {
      subject,
      examType,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      model: "gemini-1.5-flash"
    };

    return res.status(200).json(quizData);

  } catch (error) {
    console.error("Gemini API Error details:", error);

    // Specific error handling
    if (error.message.includes("API key")) {
      return res.status(401).json({ error: "Invalid or missing GEMINI_API_KEY. Check your environment variables." });
    }

    if (error.message.includes("quota") || error.message.includes("429")) {
      return res.status(429).json({ 
        error: "Daily limit reached. Please try again in an hour or use pre-generated quizzes." 
      });
    }

    if (error.message.includes("safety") || error.message.includes("blocked")) {
      return res.status(400).json({ error: "The request was blocked by AI safety filters. Try changing the topics." });
    }

    return res.status(500).json({ 
      error: `Generation failed: ${error.message}` 
    });
  }
}


