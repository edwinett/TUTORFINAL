// **NOTA:** Aunque el archivo es .ts, Vercel lo compilará como JavaScript.
// Usamos require() para la compatibilidad con Node.js en Vercel.

// Importamos el cocinero de Google
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ¡El cocinero usa la llave secreta que guardaste en Vercel!
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Esta función maneja la solicitud y es la que Vercel llama.
// En tu proyecto, esta función es la que llama a la IA.

// Si tu código de Front-end (index.html) llama a /services/geminiService
// NECESITAS exportar una función que Vercel pueda usar.

export default async function handler(req, res) {
  try {
    // 1. Elegimos el modelo
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 2. Le damos el prompt (la pregunta)
    // Puedes recibir el prompt desde el front-end aquí. Por ahora, es fijo:
    const prompt = "Escribe un cuento corto sobre un robot amigable.";

    // 3. Generamos la respuesta
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 4. Enviamos la respuesta de vuelta
    res.status(200).json({ respuesta: text });
  } catch (error) {
    // Esto captura fallas como la llave incorrecta o un error de código.
    console.error(error);
    res.status(500).json({ error: "¡Algo salió mal en el servidor! Detalle: " + error.message });
  }
}