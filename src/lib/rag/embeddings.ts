const EMBEDDING_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';
const EMBEDDING_API_KEY = process.env.AI_API_KEY; // Reuse the same Alibaba API key

/**
 * Generate embedding vector for text using Alibaba text-embedding-v3
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await fetch(EMBEDDING_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EMBEDDING_API_KEY}`
            },
            body: JSON.stringify({
                model: 'text-embedding-v3',
                input: {
                    texts: [text]
                },
                parameters: {
                    dimension: 1024,
                    text_type: 'document'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Embedding] API error:', response.status, errorText);
            throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();

        // Alibaba API returns: { output: { embeddings: [{ embedding: [...], text_index: 0 }] } }
        if (data.output?.embeddings?.[0]?.embedding) {
            return data.output.embeddings[0].embedding;
        }

        console.error('[Embedding] Unexpected response structure:', JSON.stringify(data).substring(0, 200));
        throw new Error('Invalid embedding response');
    } catch (error) {
        console.error('[Embedding] Generation failed:', error);
        throw error;
    }
}

/**
 * Generate embedding for a query (uses 'query' text_type for better search)
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
    try {
        const response = await fetch(EMBEDDING_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EMBEDDING_API_KEY}`
            },
            body: JSON.stringify({
                model: 'text-embedding-v3',
                input: {
                    texts: [text]
                },
                parameters: {
                    dimension: 1024,
                    text_type: 'query'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Embedding] Query API error:', response.status, errorText);
            throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.output?.embeddings?.[0]?.embedding) {
            return data.output.embeddings[0].embedding;
        }

        throw new Error('Invalid embedding response');
    } catch (error) {
        console.error('[Embedding] Query generation failed:', error);
        throw error;
    }
}
