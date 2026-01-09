import { NextResponse } from 'next/server';
import { storeDocument, DocumentType } from '@/lib/rag';
import { generateEmbedding } from '@/lib/rag';

// POST /api/rag/store
// Store a new document with its embedding
export async function POST(request: Request) {
    try {
        const { type, content, metadata } = await request.json();

        if (!type || !content) {
            return NextResponse.json({ error: 'type and content are required' }, { status: 400 });
        }

        // Validate document type
        const validTypes: DocumentType[] = ['period_summary', 'prediction', 'feedback', 'tweet_pattern'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
        }

        console.log(`[RAG Store] Storing ${type}: "${content.substring(0, 50)}..."`);

        // Generate embedding for the content
        const embedding = await generateEmbedding(content);
        console.log(`[RAG Store] Generated embedding with ${embedding.length} dimensions`);

        // Store in database
        const result = await storeDocument({ type, content, metadata }, embedding);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Document stored successfully' });

    } catch (error) {
        console.error('[RAG Store] Error:', error);
        return NextResponse.json(
            { error: 'Failed to store document', message: String(error) },
            { status: 500 }
        );
    }
}
