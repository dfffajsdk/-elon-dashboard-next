import { NextResponse } from 'next/server';
import { searchSimilar, getRecentDocuments, DocumentType } from '@/lib/rag';
import { generateQueryEmbedding } from '@/lib/rag';

// POST /api/rag/search
// Search for similar documents
export async function POST(request: Request) {
    try {
        const { query, type, limit = 5 } = await request.json();

        if (!query) {
            return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        console.log(`[RAG Search] Searching for: "${query.substring(0, 50)}..."`);

        // Generate embedding for the query
        const queryEmbedding = await generateQueryEmbedding(query);
        console.log(`[RAG Search] Generated query embedding with ${queryEmbedding.length} dimensions`);

        // Search for similar documents
        const documents = await searchSimilar(queryEmbedding, limit, type as DocumentType);
        console.log(`[RAG Search] Found ${documents.length} relevant documents`);

        return NextResponse.json({
            success: true,
            documents,
            count: documents.length
        });

    } catch (error) {
        console.error('[RAG Search] Error:', error);
        return NextResponse.json(
            { error: 'Failed to search documents', message: String(error) },
            { status: 500 }
        );
    }
}

// GET /api/rag/search?type=xxx&limit=10
// Get recent documents by type
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') as DocumentType;
        const limit = parseInt(searchParams.get('limit') || '10');

        if (!type) {
            return NextResponse.json({ error: 'type query parameter is required' }, { status: 400 });
        }

        const documents = await getRecentDocuments(type, limit);

        return NextResponse.json({
            success: true,
            documents,
            count: documents.length
        });

    } catch (error) {
        console.error('[RAG Get Recent] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get documents', message: String(error) },
            { status: 500 }
        );
    }
}
