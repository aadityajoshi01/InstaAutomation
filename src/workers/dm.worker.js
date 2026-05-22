const { Worker } = require('bullmq');
const { redisConnection } = require('../config/redis');
const supabase = require('../database/supabase');
const instagramService = require('../services/instagram.service');

const dmWorker = new Worker('dm-processing', async job => {
    const { commentId, userId, username, text, igUserId, reelId } = job.data;

    // 1. Fetch templates
    const { data: templates } = await supabase.from('templates').select('*').eq('is_active', true);
    if (!templates || templates.length === 0) return { skipped: true, reason: 'No active templates' };

    let matchedTemplate = null;
    for (const t of templates) {
        if (text.includes(t.keyword)) {
            matchedTemplate = t;
            break;
        }
    }

    if (!matchedTemplate) return { skipped: true, reason: 'No keyword matched' };

    // 2. Ensure User exists (Upsert to prevent race conditions)
    const { data: user, error: userErr } = await supabase.from('users').upsert({
        instagram_user_id: userId,
        username: username,
        last_seen: new Date().toISOString()
    }, { onConflict: 'instagram_user_id' }).select('id').single();

    if (userErr) throw new Error(`User Upsert Error: ${userErr.message}`);

    // 3. Ensure Reel exists (Optional tracking)
    let dbReelId = null;
    if (reelId) {
        const { data: reel, error: reelErr } = await supabase.from('reels').upsert({
            instagram_media_id: reelId
        }, { onConflict: 'instagram_media_id' }).select('id').single();
        
        if (reelErr) throw new Error(`Reel Upsert Error: ${reelErr.message}`);
        dbReelId = reel.id;
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
        return { skipped: true, reason: 'Duplicate within 24h' };
    }

    // 6. Send DM
    let status = 'FAILED';
    let errorMessage = null;
    
    // Construct message with WhatsApp tracking
    const finalMessage = `${matchedTemplate.message_template}\n\n${matchedTemplate.whatsapp_link}`;

    try {
        await instagramService.sendPrivateReply(igUserId, commentId, finalMessage);
        status = 'SUCCESS';
        
        // Update user stats
        await supabase.rpc('increment_user_stats', { user_uuid: user.id });
    } catch (error) {
        errorMessage = error.message;
        status = 'FAILED';
        
        await supabase.from('dm_logs').insert({
            user_id: user.id, comment_id: commentId, message_sent: finalMessage, status, error_message: errorMessage
        });
        throw new Error(`Meta API Error: ${errorMessage}`);
    }

    await supabase.from('dm_logs').insert({
        user_id: user.id, comment_id: commentId, message_sent: finalMessage, status, error_message: errorMessage
    });

    return { success: true };

}, {
    connection: redisConnection,
    limiter: { max: 10, duration: 60000 }
});

dmWorker.on('failed', (job, err) => {
    console.error(`[DM Worker] Job ${job.id} failed: ${err.message}`);
});

module.exports = dmWorker;
