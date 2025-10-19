// Este es tu archivo: /api/chat.js
// ¡ASEGÚRATE DE QUE ESTÉ EN INGLÉS!

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ¡Error 1 corregido! Debe ser .env.GOOGLE_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Función para convertir la imagen de Base64
function fileToGenerativePart(base64Data, mimeType) {
  const data = base64Data.split(',')[1];
  return {
    inlineData: {
      data: data,
      mimeType
    },
  };
}

// ¡Error 2 corregido! Debe ser export default async function handler(req, res)
export default async function handler(req, res) {
  
  // ¡Error 3 corregido! Debe ser req.method !== 'POST'
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { mi_pregunta, mi_imagen } = req.body; // Recibimos la pregunta y la imagen

    let model;
    let promptParts;

    if (mi_imagen) {
      // Usamos el modelo de VISIÓN
      model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      const imagePart = fileToGenerativePart(mi_imagen, "image/jpeg");
      promptParts = [ mi_pregunta, imagePart ];

    } else {
      // Usamos el modelo de TEXTO
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      promptParts = [ mi_pregunta ];
    }
    
    // Generamos la respuesta
    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const text = response.text();

    // Enviamos la respuesta
    res.status(200).json({ respuesta: text });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "¡Algo salió mal en la cocina!", details: error.message });
  }
}
