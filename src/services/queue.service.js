const supabase = require('../database/supabase');
const instagramService = require('./instagram.service');

class MemoryQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        // Meta limit is 750/hour -> 12.5/min -> ~5 seconds per message safely
        this.processIntervalMs = 5000; 
    }

    add(jobData) {
        this.queue.push(jobData);
        console.log(`[Queue] Job added. Queue size: ${this.queue.length}`);
        if (!this.isProcessing) {
            this.processNext();
        }
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const job = this.queue.shift();

        try {
            await this.handleJob(job);
        } catch (error) {
            console.error(`[Queue Error] Failed to process job:`, error.message);
        }

        // Wait before processing next to respect rate limits
        setTimeout(() => this.processNext(), this.processIntervalMs);
    }

    async handleJob(data) {
        const { commentId, userId, username, text, igUserId, reelId } = data;

        // 1. Fetch templates
        const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true);
        if (!templates || templates.length === 0) return;

        let matchedTemplate = null;
        for (const t of templates) {
            if (text.includes(t.keyword)) {
                matchedTemplate = t;
                break;
            }
        }

        if (!matchedTemplate) return;

        // 2. Ensure User exists (Upsert)
        const { data: user, error: userErr } = await supabase.from('users').upsert({
            instagram_user_id: userId,
            username: username,
            last_seen: new Date().toISOString()
        }, { onConflict: 'instagram_user_id' }).select('id').single();

        if (userErr || !user) throw new Error(`User Upsert Error: ${userErr?.message}`);

        // 3. Ensure Reel exists
        let dbReelId = null;
        if (reelId) {
            const { data: reel } = await supabase.from('reels').upsert({
                instagram_media_id: reelId
            }, { onConflict: 'instagram_media_id' }).select('id').single();
            if (reel) dbReelId = reel.id;
        }

        // 4. Record Comment
        await supabase.from('comments').insert({
            comment_id: commentId,
            user_id: user.id,
            reel_id: dbReelId,
            comment_text: text,
            keyword_detected: matchedTemplate.keyword
        });

        // 5. 24h Duplicate Check
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentLogs } = await supabase
            .from('dm_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'SUCCESS')
            .gte('created_at', twentyFourHoursAgo);

        if (recentLogs && recentLogs.length > 0) {
            console.log(`[Queue] Skipped duplicate DM to ${username}`);
            return;
        }

        // 6. Send DM
        let status = 'FAILED';
        let errorMessage = null;
        const finalMessage = `${matchedTemplate.message_template}\n\n${matchedTemplate.whatsapp_link}`;

        try {
            await instagramService.sendPrivateReply(igUserId, commentId, finalMessage);
            status = 'SUCCESS';
            await supabase.rpc('increment_user_stats', { user_uuid: user.id });
            console.log(`[Queue] Message sent to ${username}`);
        } catch (error) {
            errorMessage = error.message;
            status = 'FAILED';
            console.error(`[Meta API Error] ${errorMessage}`);
        }

        // 7. Log DM
        await supabase.from('dm_logs').insert({
            user_id: user.id, comment_id: commentId, message_sent: finalMessage, status, error_message: errorMessage
        });
    }
}

const dmQueue = new MemoryQueue();

module.exports = { dmQueue };
