const express = require('express');
const app = express();

// Test the exact endpoint pattern
app.get('/api/v1/ai-analysis/history', async (req, res) => {
  try {
    console.log('AI analysis history endpoint hit!');
    const limit = parseInt(req.query.limit) || 10;
    
    const demoHistory = [
      {
        id: 'analysis_001',
        repository: 'sample-project',
        analysis_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        type: 'security_scan',
        summary: 'Found 3 potential security issues'
      }
    ];
    
    res.json({
      success: true,
      data: {
        results: demoHistory.slice(0, limit),
        total: demoHistory.length,
        limit: limit
      }
    });
  } catch (error) {
    console.error('Error in endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3004, () => {
  console.log('Test AI endpoint server on http://localhost:3004');
  console.log('Test: http://localhost:3004/api/v1/ai-analysis/history');
});
