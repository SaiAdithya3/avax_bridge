import express from 'express';
import cors from 'cors';
import { config } from './config';
import { QuoteService } from './services/quoteService';
import { QuoteRequest, createErrorResponse } from './types/api';

const app = express();
const quoteService = new QuoteService();

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (_req, res) => {
  res.status(200).send('Online');
});

// Quote endpoint
app.get('/quote', async (req, res) => {
  try {
    const { from, to, amount } = req.query;
    
    // Validate required query parameters
    if (!from || !to || !amount) {
      return res.status(400).json(createErrorResponse('Missing required parameters: from, to, amount'));
    }

    // Validate amount is a valid number
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json(createErrorResponse('Amount must be a positive number'));
    }

    const quoteRequest: QuoteRequest = {
      from: from as string,
      to: to as string,
      amount: amount as string
    };

    const quoteResponse = await quoteService.generateQuote(quoteRequest);
    
    if (quoteResponse.status === 'Error') {
      return res.status(400).json(quoteResponse);
    }

    return res.status(200).json(quoteResponse);
    
  } catch (error) {
    console.error('Error in quote endpoint:', error);
    return res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Start server
app.listen(config.port, () => {
    console.log("Server running at http://localhost:" + config.port);
});

export default app;
