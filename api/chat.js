const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Función para convertir la imagen de Base64 (que nos da el navegador)
// a un formato que entiende Gemini.
function fileToGenerativePart(base64Data, mimeType) {
  // Quitamos el prefijo 'data:image/jpeg;base64,'
  const data = base64Data.split(',')[1];
  return {
    inlineData: {
      data: data,
      mimeType
    },
  };
}

export default async function handler(req, res) {
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { mi_pregunta, mi_imagen } = req.body; // Recibimos la pregunta y (opcionalmente) la imagen

    let model;
    let promptParts;

    if (mi_imagen) {
      // ¡Tenemos una imagen! Usamos el modelo de VISIÓN
      model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
      
      // Creamos la parte de la imagen
      const imagePart = fileToGenerativePart(mi_imagen, "image/jpeg");
      
      // Enviamos la pregunta Y la imagen
      promptParts = [ mi_pregunta, imagePart ];

    } else {
      // NO hay imagen. Usamos el modelo de TEXTO (como antes)
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      promptParts = [ mi_pregunta ];
    }
    
    // Generamos la respuesta
    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const text = response.text();

    // Enviamos la respuesta de vuelta
    res.status(200).json({ respuesta: text });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "¡Algo salió mal en la cocina!", details: error.message });
  }
}
