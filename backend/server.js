
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const pool = require("./db");
const bcrypt = require("bcrypt");
const askGemma = require("./gemma");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Default Vite port
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

app.get("/test", (req, res) => {
  res.json({ message: "Backend updated" });
});

// Initialize OpenAI client for Groq
const apiKey = process.env.GROQ_API_KEY;
const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key-to-prevent-constructor-crash',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Register user
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "Username already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, hashedPassword]
    );

    res.json({
      success: true,
      message: "User registered successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Registration failed"
    });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    res.json({
      success: true,
      username: user.username
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Login failed"
    });
  }
});


// Endpoint to analyze options
app.post('/analyze', async (req, res) => {
  const { question, options } = req.body;

  // 1. Validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question must be a non-empty string.' });
  }

  if (!options || !Array.isArray(options) || options.length < 2 || options.length > 5) {
    return res.status(400).json({ error: 'Options must be an array of 2 to 5 items.' });
  }

  const cleanedOptions = options.map(opt => typeof opt === 'string' ? opt.trim() : '').filter(opt => opt.length > 0);
  if (cleanedOptions.length !== options.length) {
    return res.status(400).json({ error: 'All options must be non-empty strings.' });
  }

  // Check if API key is configured
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      error: 'Groq API key is missing on the server. Please add GROQ_API_KEY to your backend/.env file.'
    });
  }

  try {
    // 2. Call Groq API
    const systemPrompt = `You are GemmaGuide, an Academic Decision Support Assistant.

You help students make informed academic and career decisions in offline and low-connectivity environments.

You help students compare:
- courses
- project topics
- scholarships
- internships
- certifications
- career paths
- learning resources
- study plans

For each option:
- Evaluate learning value
- Consider career opportunities
- Consider skill development
- Consider accessibility and practicality
- Consider long-term benefits

Rank all options from best to worst.
Explain your reasoning clearly.
Provide pros and cons.
Give a final recommendation.

Rules:
1. Be concise and structured.
2. Focus on logical reasoning, not creativity.
3. Do not invent extra options.
4. Return ONLY valid JSON.
5. Use the exact option names provided by the user.

Output JSON Schema:
{
  "rankings": [
    {
      "rank": 1,
      "option": "Option name (exact match from inputs)",
      "explanation": "Explanation of rank",
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1", "con 2"]
    }
  ],
  "finalRecommendation": "Final recommendation string"
}`;
    const userPrompt = `Question: "${question}"
Options:
${cleanedOptions.map((opt, idx) => `${idx + 1}. "${opt}"`).join('\n')}`;

    const fullPrompt = `
      ${systemPrompt}

      ${userPrompt}

      Return ONLY valid JSON.
      `;

      console.log("USING GEMMA");

      const content = await askGemma(fullPrompt);

      console.log(content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("No JSON found in Gemma response");
      }

      const parsedData = JSON.parse(jsonMatch[0]);



return res.json(parsedData);

  } catch (error) {
    console.error('Error contacting Groq API:', error);
    return res.status(500).json({
      error: 'Failed to generate analysis from AI. ' + (error.message || '')
    });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
