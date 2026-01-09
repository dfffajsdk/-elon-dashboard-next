import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Use service key for server-side operations (storing embeddings)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Document types for RAG
export type DocumentType = 'period_summary' | 'prediction' | 'feedback' | 'tweet_pattern';

export interface MemoryDocument {
    id?: string;
    type: DocumentType;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
    created_at?: string;
}

/**
 * Store a document with its embedding in the vector database
 */
export async function storeDocument(doc: MemoryDocument, embedding: number[]): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAdmin
            .from('memory_documents')
            .insert({
                type: doc.type,
                content: doc.content,
                embedding: embedding,
                metadata: doc.metadata || {}
            });

        if (error) {
            console.error('[RAG] Store error:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('[RAG] Store exception:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilar(
    queryEmbedding: number[],
    limit: number = 5,
    typeFilter?: DocumentType
): Promise<MemoryDocument[]> {
    try {
        // Use Supabase's built-in vector similarity search
        const { data, error } = await supabaseAdmin.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: limit,
            filter_type: typeFilter || null
        });

        if (error) {
            console.error('[RAG] Search error:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('[RAG] Search exception:', error);
        return [];
    }
}

/**
 * Get recent documents by type
 */
export async function getRecentDocuments(type: DocumentType, limit: number = 10): Promise<MemoryDocument[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('memory_documents')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[RAG] Get recent error:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('[RAG] Get recent exception:', error);
        return [];
    }
}
