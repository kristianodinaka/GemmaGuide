const axios = require("axios");

async function askGemma(prompt) {
  const response = await axios.post(
    "http://localhost:11434/api/generate",
    {
      model: "gemma3:4b",
      prompt,
      stream: false
    }
  );

  return response.data.response;
}

module.exports = askGemma;