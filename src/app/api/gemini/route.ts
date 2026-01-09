import { NextResponse } from 'next/server';

const AI_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const AI_API_KEY = process.env.AI_API_KEY;

if (!AI_API_KEY) {
    console.error('AI_API_KEY is not defined in environment variables');
}

// POST /api/gemini
export async function POST(request: Request) {
    try {
        const { message, context, history = [] } = await request.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        console.log(`[AI] Processing request: "${message.substring(0, 50)}..."`);

        // Build messages array with context and history
        const messages = [
            {
                role: 'system',
                content: context || '你是一个专业的马斯克推文分析助手，帮助用户分析推文趋势和预测。请用中文回复。'
            },
            ...history.map((h: { role: string; content: string }) => ({
                role: h.role === 'user' ? 'user' : 'assistant',
                content: h.content
            })),
            { role: 'user', content: message }
        ];

        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'qwen3-max-preview',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] API error: ${response.status} - ${errorText}`);
            return NextResponse.json({ error: `Provider error: ${response.status} - ${errorText.substring(0, 100)}` }, { status: response.status });
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] API error: ${response.status} - ${errorText}`);
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        let aiResponse = data.choices?.[0]?.message?.content || '抱歉，无法生成回复。';

        // Post-process: Convert Unix timestamps to readable dates
        aiResponse = aiResponse.replace(/\b(176\d{7})\b/g, (match: string, timestamp: string) => {
            try {
                const ts = parseInt(timestamp);
                if (ts > 1700000000 && ts < 1800000000) {
                    const date = new Date(ts * 1000);
                    const month = date.toLocaleDateString('zh-CN', { timeZone: 'America/New_York', month: 'numeric' });
                    const day = date.toLocaleDateString('zh-CN', { timeZone: 'America/New_York', day: 'numeric' });
                    const time = date.toLocaleTimeString('zh-CN', {
                        timeZone: 'America/New_York',
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `${month}月${day}日 ${time} ET`;
                }
            } catch {
                // Ignore conversion errors
            }
            return match;
        });

        console.log(`[AI] Response received: "${aiResponse.substring(0, 50)}..."`);

        return NextResponse.json({
            response: aiResponse,
            model: data.model,
            usage: data.usage
        });

    } catch (error) {
        console.error('[AI] Request failed:', (error as Error).message);
        return NextResponse.json(
            { error: 'AI request failed', message: (error as Error).message },
            { status: 500 }
        );
    }
}
