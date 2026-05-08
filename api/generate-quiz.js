// api/generate-quiz.js
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, examType, topics, questionCount, difficulty, notes } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const apiKey = process.env.YOU_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'You.com API key (YOU_API_KEY) not configured' });
    }

    // Build a more direct prompt for the Smart endpoint
    const prompt = `Create a ${questionCount}-question multiple choice quiz for "${subject}" (${examType} level). 
Return ONLY a JSON object: {"title": "Quiz", "questions": [{"question": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "..."}]}`;

    // Call You.com Smart API (Faster and more stable)
    const response = await axios.get('https://api.ydc-index.io/smart', {
      params: { q: prompt },
      headers: { 'X-API-Key': apiKey }
    });

    // You.com returns an array of hits or a research summary. 
    // We look for the model's generated text in the response.
    const rawText = response.data.answer || response.data.content || "";

    if (!rawText) {
      throw new Error("No response from You.com API");
    }

    // Parse JSON safely
    let quizData;
    try {
      const startIdx = rawText.indexOf('{');
      const endIdx = rawText.lastIndexOf('}');

      if (startIdx !== -1 && endIdx !== -1) {
        const jsonContent = rawText.substring(startIdx, endIdx + 1);
        quizData = JSON.parse(jsonContent);
      } else {
        quizData = JSON.parse(rawText);
      }
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", rawText);
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
      provider: "You.com Research"
    };

    return res.status(200).json(quizData);

  } catch (error) {
    console.error('Quiz Generation Error:', error);
    return res.status(500).json({
      error: `Generation failed: ${error.message}`
    });
  }
}



