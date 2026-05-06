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

    // Choose model (best free tier option)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Stable, widely available model (fixed from gemini-2.0-flash)
      systemInstruction: `You are an expert COMSATS University Islamabad exam setter with 12+ years of experience. 
      You create high-quality, realistic exam-style questions that match COMSATS past paper patterns.
      
      Rules:
      - Always return ONLY valid JSON (no markdown, no explanations outside JSON).
      - Questions must be syllabus-aligned and appropriate for undergraduate level.
      - Include 1-2 lines explanation for each correct answer.
      - Use proper Bloom's taxonomy distribution.`
    });

    // Build smart prompt
    let prompt = `Generate a ${examType.toUpperCase()} quiz for the subject "${subject}".

Exam Type: ${examType}
Number of Questions: ${questionCount}
Difficulty Mix: ${difficulty}
Topics Focus: ${topics || "Full syllabus"}

${examType === 'midterm' 
  ? 'Focus on the first half of the syllabus. More conceptual and application questions. Slightly easier overall.' 
  : 'Comprehensive coverage of the full syllabus. Higher-order thinking questions (analysis, evaluation). Include integration of multiple topics.'}

${notes ? `Additional context from student's notes: ${notes}` : ''}

Return the response in this exact JSON format:
{
  "title": "Subject - MIDTERM/FINAL Quiz",
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 1,
      "explanation": "Brief explanation why this is correct"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up possible markdown formatting
    text = text.replace(/```json|```/g, '').trim();

    // Parse JSON safely
    let quizData;
    try {
      quizData = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error:", text);
      return res.status(500).json({ 
        error: "AI returned invalid format. Please try again." 
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
    console.error("Gemini API Error:", error);

    if (error.message.includes("quota") || error.message.includes("429")) {
      return res.status(429).json({ 
        error: "Daily limit reached. Please try again tomorrow or use pre-generated quizzes." 
      });
    }

    return res.status(500).json({ 
      error: "Failed to generate quiz. Please try again in a moment." 
    });
  }
}
