// api/generate-quiz.js

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
      return res.status(401).json({ error: 'YOU_API_KEY is missing in environment variables. Please check your configuration.' });
    }

    // Build the research prompt
    const prompt = `You are an expert COMSATS University Islamabad exam setter.
Generate a high-quality, undergraduate-level quiz for the following:
- Subject: "${subject}"
- Exam Type: ${examType} (${examType === 'midterm' ? 'First half of syllabus' : 'Full syllabus coverage'})
- Topics: ${topics || "All major chapters/full course"}
- Difficulty: ${difficulty}
- Number of Questions: ${questionCount}

Context/Notes: ${notes || 'None provided'}

RULES:
1. Ensure questions are challenging, conceptual, and fair for COMSATS students.
2. Provide exactly 4 distinct options per question.
3. Include a helpful 1-2 line explanation for the correct answer.
4. Output the result in the exact JSON structure requested.`;

    const response = await fetch('https://api.you.com/v1/research', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: prompt,
        research_effort: 'standard',
        output_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correctAnswer: { type: "number", minimum: 0, maximum: 3 },
                  explanation: { type: "string" }
                },
                required: ["id", "question", "options", "correctAnswer", "explanation"],
                additionalProperties: false
              }
            }
          },
          required: ["title", "questions"],
          additionalProperties: false
        }
      }),
    });

    if (!response.ok) {
      let errorMessage = `You.com API Error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // 1. Try to get data from data.output (if output_schema worked directly)
    let quizData = data.output;
    
    // 2. If it's missing or doesn't look like our quiz, check data.output.content (common for Beta features)
    if (!quizData || !quizData.questions) {
      const rawContent = data.output?.content || '';
      
      try {
        // Attempt to extract JSON if it's wrapped in text or markdown backticks
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          quizData = JSON.parse(jsonMatch[0]);
        } else {
          quizData = JSON.parse(rawContent);
        }
      } catch (e) {
        console.error("Failed to parse AI content as JSON:", rawContent);
        throw new Error("AI returned a non-standard format. Please try again with a simpler topic.");
      }
    }

    // Double check we have questions
    if (!quizData || !Array.isArray(quizData.questions)) {
      throw new Error("AI failed to generate questions. Please try again.");
    }

    // Add metadata for the frontend
    quizData.metadata = {
      subject,
      examType,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      model: "you-research"
    };

    return res.status(200).json(quizData);

  } catch (error) {
    console.error("Quiz Generation Error:", error);

    // Provide user-friendly error messages
    if (error.message.includes("quota") || error.message.includes("429")) {
      return res.status(429).json({ error: "API limit reached. Please try again later." });
    }

    return res.status(500).json({ 
      error: error.message || "Failed to generate quiz. Please try again." 
    });
  }
}

