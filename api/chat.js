// Este es tu archivo: /api/chat.js

// Importamos el cocinero de Google
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ¡El cocinero usa la llave secreta que guardaste en Vercel!
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Esto hace que Vercel entienda que esto es una "cocina" (API)
export default async function handler(req, res) {

  try {
    // 1. Elegimos el modelo
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});

    // 2. Le damos el prompt (la pregunta)
    // (Por ahora, la pregunta está fija, luego puedes cambiarla)
    const prompt = "Escribe un cuento corto sobre un robot amigable."; 

    // 3. Generamos la respuesta
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Enviamos la respuesta de vuelta al "Menú" (front-end)
    res.status(200).json({ respuesta: text });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "¡Algo salió mal en la cocina!" });
  }
}
