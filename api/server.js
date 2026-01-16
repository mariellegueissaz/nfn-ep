// Local Express server for development
import express from 'express';
import cors from 'cors';
import handler from './airtable-proxy.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Convert Express request/response to handler format
app.post('/api/airtable-proxy', async (req, res) => {
  // Convert Express req/res to handler format
  const handlerReq = {
    method: req.method,
    headers: req.headers,
    body: req.body,
  };

  let statusCode = 200;
  const handlerRes = {
    status: (code) => {
      statusCode = code;
      return handlerRes;
    },
    json: (data) => {
      res.status(statusCode).json(data);
    },
    setHeader: (name, value) => {
      res.setHeader(name, value);
      return handlerRes;
    },
    end: () => {
      res.status(statusCode).end();
    },
  };

  try {
    await handler(handlerReq, handlerRes);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 Proxy endpoint: http://localhost:${PORT}/api/airtable-proxy`);
});
