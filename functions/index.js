/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const https = require("https");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// Gemini AI Chat Function
exports.geminiChat = onCall(async (request) => {
  try {
    const { message } = request.data;
    
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }

    // Get API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    logger.info('Calling Gemini API', { message: message.substring(0, 100) });

    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: message
            }
          ]
        }
      ]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: '/v1beta/models/gemini-2.5-flash:generateContent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    if (response.statusCode !== 200) {
      logger.error('Gemini API error', { 
        status: response.statusCode, 
        error: response.data
      });
      throw new Error(`Gemini API error: ${response.statusCode}`);
    }

    const data = JSON.parse(response.data);
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const aiResponse = data.candidates[0].content.parts[0].text;
      if (aiResponse && aiResponse.trim()) {
        logger.info('Gemini API response received', { 
          responseLength: aiResponse.length 
        });
        return { success: true, response: aiResponse };
      } else {
        throw new Error('Empty response from Gemini API');
      }
    } else {
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    logger.error('Error in geminiChat function', { error: error.message });
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
});
