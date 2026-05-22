const express = require('express');
const supabase = require('../database/supabase');
const { basicAuth } = require('../middleware/security');

const router = express.Router();

router.use(basicAuth);

router.get('/', async (req, res) => {
    try {
        const { count: totalComments } = await supabase.from('comments').select('*', { count: 'exact', head: true });
        const { count: totalDmsSent } = await supabase.from('dm_logs').select('*', { count: 'exact', head: true }).eq('status', 'SUCCESS');
        const { count: totalLeads } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: failedMessages } = await supabase.from('dm_logs').select('*', { count: 'exact', head: true }).eq('status', 'FAILED');
        
        const { data: keywordStats } = await supabase.from('keyword_stats').select('*');
        const { data: recentLeads } = await supabase.from('users').select('*').order('first_seen', { ascending: false }).limit(5);

        res.render('dashboard', {
            stats: {
                comments: totalComments || 0,
                dms: totalDmsSent || 0,
                leads: totalLeads || 0,
                failed: failedMessages || 0,
                conversionRate: totalComments ? ((totalLeads / totalComments) * 100).toFixed(1) : 0
            },
            keywordStats: keywordStats || [],
            recentLeads: recentLeads || []
        });
    } catch (error) {
        console.error('[Admin Error]', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Broadcast endpoint placeholder
router.post('/broadcast', async (req, res) => {
    // Requires setting up a broadcast queue and fetching users by segment
    res.status(501).send('Broadcast system requires enterprise plan.');
});

module.exports = router;
