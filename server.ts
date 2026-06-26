import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for screenshot base64 images
app.use(express.json({ limit: "10mb" }));

// Lazy initialization of the GoogleGenAI client to avoid crashing on start if the key is missing
let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// API endpoint for structured data extraction and multimodal screenshot analysis
app.post("/api/gemini/extract", async (req: express.Request, res: express.Response) => {
  try {
    const { rawText, imagePart } = req.body;
    
    const parts: any[] = [];
    if (imagePart && imagePart.data && imagePart.mimeType) {
      parts.push({
        inlineData: {
          data: imagePart.data, // base64 without prefix
          mimeType: imagePart.mimeType
        }
      });
    }
    if (rawText) {
      parts.push({
        text: `Raw Incident Description/SMS/Transaction Text:\n"${rawText}"`
      });
    }

    if (parts.length === 0) {
      return res.status(400).json({ error: "Either rawText or imagePart is required" });
    }

    const ai = getGeminiClient();
    const prompt = `You are a cybersecurity assistant specializing in mobile money security in Uganda.
Analyze the provided screenshot image and/or text details of a suspicious transaction or message.
Strictly extract and map the details to the following JSON structure:

1. "phoneNumber": A Ugandan mobile money phone number in format 07XXXXXXXX or +256XXXXXXXX (e.g. 0772109843). Extract the scammer's number. If not found, return empty string.
2. "category": Must match exactly one of these six categories:
   - "PIN Reversal Demand" (demanding pin to reverse wrong transaction)
   - "Impersonating Support" (posing as Airtel/MTN support)
   - "Fake Promotion/Lottery Wins" (congratulating wins, requesting fees)
   - "Upfront Loan Fees (Wewole)" (charging fee before loans)
   - "School Emergency Impersonator" (urgent hospital/school accident money)
   - "Other Fraud" (any other scam pattern)
3. "operator": Must be exactly one of: "MTN", "Airtel", "Lyca", "UTL", or "Unknown" (based on prefixes or content: MTN includes 077, 078, 076, Airtel includes 070, 075, 074).
4. "reason": A short, clean, human-readable summary of the scam pattern (e.g., "Calls victims claiming a wrong money transfer of 150k was sent and demands a manual refund PIN code").

Return ONLY valid JSON matching the schema. Do not wrap in markdown code blocks.`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phoneNumber: { type: Type.STRING },
            category: { type: Type.STRING },
            operator: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["phoneNumber", "category", "operator", "reason"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for generating text embeddings using text-embedding-004
app.post("/api/gemini/embed", async (req: express.Request, res: express.Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    const ai = getGeminiClient();
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text
    });
    const values = response.embedding?.values;
    res.json({ embedding: values });
  } catch (error: any) {
    console.error("Gemini Embedding Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static assets or mount Vite dev middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
