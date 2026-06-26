/**
 * Client-side service to communicate with our server-side Gemini API endpoints.
 */

export interface ExtractedScamDetails {
  phoneNumber: string;
  category: string;
  operator: string;
  reason: string;
}

/**
 * Convert a File object to a base64 encoded string (without mime prefix)
 */
export function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const parts = reader.result.split(",");
        const data = parts[1] || "";
        const mimeType = file.type;
        resolve({ data, mimeType });
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Calculates the cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Local cache of embeddings to minimize server roundtrips and conserve API quota
 */
const EMBEDDING_CACHE_KEY = "ug_momo_embeddings_cache";

function getCachedEmbeddings(): Record<string, number[]> {
  try {
    const saved = localStorage.getItem(EMBEDDING_CACHE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function cacheEmbedding(text: string, embedding: number[]): void {
  try {
    const cache = getCachedEmbeddings();
    cache[text] = embedding;
    localStorage.setItem(EMBEDDING_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Failed to write to embedding local cache", e);
  }
}

/**
 * Fetches the embedding vector for a given text from our backend API, using local storage cache if available.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const normalizedText = text.trim();
  if (!normalizedText) return [];

  // Check cache first
  const cache = getCachedEmbeddings();
  if (cache[normalizedText]) {
    return cache[normalizedText];
  }

  // Call server proxy
  const response = await fetch("/api/gemini/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: normalizedText }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to generate text embedding from server");
  }

  const data = await response.json();
  const embedding = data.embedding;
  if (Array.isArray(embedding)) {
    cacheEmbedding(normalizedText, embedding);
    return embedding;
  }
  throw new Error("Invalid embedding response format from server");
}

/**
 * Calls the structured extraction endpoint with optional text and screenshot
 */
export async function extractScamDetails(
  rawText?: string,
  screenshotFile?: File
): Promise<ExtractedScamDetails> {
  const payload: any = {};

  if (rawText) {
    payload.rawText = rawText;
  }

  if (screenshotFile) {
    const base64Data = await fileToBase64(screenshotFile);
    payload.imagePart = base64Data;
  }

  const response = await fetch("/api/gemini/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Structured extraction failed");
  }

  return response.json();
}

/**
 * Scans a new incident report reason against a list of existing reports/incidents
 * using text-embedding-004 cosine similarity.
 */
export interface SimilarityResult {
  matchedItem: {
    idOrNumber: string;
    reason: string;
    status: string;
  };
  similarity: number;
}

export async function detectSimilarScam(
  newReason: string,
  existingItems: { idOrNumber: string; reason: string; status: string }[],
  similarityThreshold: number = 0.82
): Promise<SimilarityResult | null> {
  if (!newReason || newReason.trim().length < 5 || existingItems.length === 0) {
    return null;
  }

  try {
    // Get candidate embedding
    const candidateVector = await getEmbedding(newReason);
    if (candidateVector.length === 0) return null;

    let highestSimilarity = -1;
    let bestMatch: typeof existingItems[0] | null = null;

    // Compare with each existing item
    for (const item of existingItems) {
      if (!item.reason || item.reason.trim().length < 5) continue;
      
      try {
        const itemVector = await getEmbedding(item.reason);
        if (itemVector.length === 0) continue;

        const sim = cosineSimilarity(candidateVector, itemVector);
        if (sim > highestSimilarity) {
          highestSimilarity = sim;
          bestMatch = item;
        }
      } catch (e) {
        console.warn(`Failed to process similarity comparison for item ${item.idOrNumber}:`, e);
      }
    }

    if (bestMatch && highestSimilarity >= similarityThreshold) {
      return {
        matchedItem: bestMatch,
        similarity: highestSimilarity
      };
    }
  } catch (error) {
    console.error("Error during duplicate pattern detection:", error);
  }

  return null;
}
