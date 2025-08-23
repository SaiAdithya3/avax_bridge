import express from 'express';
import cors from 'cors';
import { config } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (_req, res) => {
  res.status(200).send('Online');
});

// Start server
app.listen(config.port, () => {
    console.log("Server running at http://localhost:" + config.port);
});

export default app;
