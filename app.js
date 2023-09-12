import 'dotenv/config';
import express from 'express';

import { 
  VerifyDiscordRequest
 } from './utils.js';

import { handleInteractionRequest } from './handlers.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
export const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', (req, res) => handleInteractionRequest(req, res));

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
