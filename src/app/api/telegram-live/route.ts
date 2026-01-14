import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Revalidate every 30 seconds for near real-time data
export const revalidate = 30;

const TELEGRAM_URL = 'https://t.me/s/elonvitalikalerts';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

interface ParsedMessage {
    tweetId: string;
    text: string;
    timestamp: number;
    dateStr: string;
    isReply: boolean;
    link: string;
}

function parseMessages(html: string): ParsedMessage[] {
    const $ = cheerio.load(html);
    const messages: ParsedMessage[] = [];

    $('.tgme_widget_message').each((_, el) => {
        try {
            const $msg = $(el);

            // Get message text
            const text = $msg.find('.tgme_widget_message_text').text().trim();
            if (!text) return;

            // Get timestamp
            const timeEl = $msg.find('time');
            const datetime = timeEl.attr('datetime');
            if (!datetime) return;

            const date = new Date(datetime);
            const timestamp = Math.floor(date.getTime() / 1000);

            // Get tweet link
            const linkEl = $msg.find('a.tgme_widget_message_inline_button');
            const link = linkEl.attr('href') || '';

            // Extract tweet ID from link
            const tweetIdMatch = link.match(/status\/(\d+)/);
            if (!tweetIdMatch) return;
            const tweetId = tweetIdMatch[1];

            // Check if it's a reply
            const firstLine = text.split('\n')[0];
            const isReply = firstLine.includes('Reply') || firstLine.includes('replied');

            // Format date string for display (ET timezone)
            const etDate = new Date(date.getTime());
            const etFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: '2-digit'
            });
            const dateStr = etFormatter.format(etDate);

            messages.push({
                tweetId,
                text,
                timestamp,
                dateStr,
                isReply,
                link
            });
        } catch (e) {
            // Skip malformed messages
        }
    });

    return messages;
}

async function syncToSupabase(messages: ParsedMessage[]) {
    if (!supabaseUrl || !supabaseKey || messages.length === 0) return { synced: 0 };

    const supabase = createClient(supabaseUrl, supabaseKey);
    let synced = 0;

    for (const msg of messages) {
        try {
            // Calculate period_start (7-day cycles from reference point)
            const refStart = 1766509200; // Dec 23, 2025 12pm ET
            const diff = msg.timestamp - refStart;
            const weeks = Math.floor(diff / (7 * 24 * 3600));
            const periodStart = refStart + (weeks * 7 * 24 * 3600);

            // Upsert to cached_tweets
            await supabase.from('cached_tweets').upsert({
                id: msg.tweetId,
                period_start: periodStart,
                text: msg.text,
                msg: msg.text,
                created_at: msg.timestamp,
                is_reply: msg.isReply,
                raw_data: { link: msg.link, source: 'telegram_web' }
            }, { onConflict: 'id' });

            // Update heatmap
            const etDate = new Date((msg.timestamp - 5 * 3600) * 1000);
            const dateNorm = etDate.toISOString().split('T')[0];
            const hour = etDate.getUTCHours();
            const hourStr = hour.toString().padStart(2, '0') + ':00';

            // Try to increment existing row or insert new
            const { data: existing } = await supabase
                .from('cached_heatmap')
                .select('*')
                .eq('date_normalized', dateNorm)
                .eq('hour', hourStr)
                .single();

            if (existing) {
                const field = msg.isReply ? 'reply_count' : 'tweet_count';
                await supabase
                    .from('cached_heatmap')
                    .update({ [field]: existing[field] + 1 })
                    .eq('id', existing.id);
            } else {
                await supabase.from('cached_heatmap').insert({
                    date_str: msg.dateStr,
                    date_normalized: dateNorm,
                    hour: hourStr,
                    tweet_count: msg.isReply ? 0 : 1,
                    reply_count: msg.isReply ? 1 : 0
                });
            }

            synced++;
        } catch (e) {
            // Skip on conflict/duplicate
        }
    }

    return { synced };
}

export async function GET() {
    try {
        // Try the correct channel (ElonTweets_dBot publishes to t.me/ElonTweets_d)
        const urls = [
            'https://t.me/s/elonvitalikalerts',
            'https://t.me/s/ElonTweets_d'
        ];

        let messages: ParsedMessage[] = [];
        let usedUrl = '';
        let rawHtmlSample = '';

        for (const url of urls) {
            // Fetch Telegram web preview with full browser headers
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.log(`[Telegram] ${url} failed: ${response.status}`);
                continue;
            }

            const html = await response.text();
            rawHtmlSample = html.substring(0, 500);

            // Check if we got the actual content or a redirect page
            if (html.includes('tgme_widget_message')) {
                messages = parseMessages(html);
                usedUrl = url;
                console.log(`[Telegram] ${url} returned ${messages.length} messages`);
                if (messages.length > 0) break;
            } else {
                console.log(`[Telegram] ${url} did not contain message widgets`);
            }
        }

        // Sync new messages to Supabase (fire and forget for speed)
        if (messages.length > 0) {
            syncToSupabase(messages).catch(console.error);
        }

        // Format for frontend compatibility
        const latestTweets = messages.map(m => ({
            id: m.tweetId,
            text: m.text,
            timestamp: m.timestamp,
            is_reply: m.isReply,
            link: m.link
        }));

        return NextResponse.json({
            success: true,
            count: messages.length,
            source: usedUrl,
            lastUpdate: new Date().toISOString(),
            debug: {
                htmlContainsWidget: rawHtmlSample.includes('tgme')
            },
            tweets: latestTweets.slice(0, 20) // Return latest 20
        });
    } catch (error) {
        console.error('[Telegram Scrape] Error:', error);
        return NextResponse.json({
            success: false,
            error: String(error),
            tweets: []
        }, { status: 500 });
    }
}
