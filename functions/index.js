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

// Resume Analysis Function
exports.analyzeResume = onCall(async (request) => {
  try {
    const { resumeText, jobRequirements } = request.data;
    
    if (!resumeText || typeof resumeText !== 'string') {
      throw new Error('Resume text is required and must be a string');
    }
    
    if (!jobRequirements || typeof jobRequirements !== 'string') {
      throw new Error('Job requirements are required and must be a string');
    }

    // Get API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    logger.info('Analyzing resume against job requirements', { 
      resumeLength: resumeText.length,
      requirementsLength: jobRequirements.length 
    });

    const prompt = `You are an expert HR professional analyzing a resume against job requirements. 

${resumeText}

Please analyze the fit between the resume and job requirements and provide a structured response with:

1. FIT SCORE: A score from 0-100 where:
   - 0-20: Poor fit
   - 21-40: Below average fit
   - 41-60: Average fit
   - 61-80: Good fit
   - 81-100: Excellent fit

2. REASONING: Detailed explanation of why this score was given, highlighting:
   - Key skills that match
   - Experience relevance
   - Areas of concern
   - Strengths and weaknesses

3. SUGGESTED NEXT STEPS: Specific actionable recommendations for:
   - The candidate (if applying)
   - The hiring manager (if reviewing)
   - Areas for improvement

IMPORTANT: Format your response exactly as follows:

**FIT SCORE: [number]/100**

**REASONING:**
[detailed explanation]

**SUGGESTED NEXT STEPS:**
[actionable recommendations]

Make sure to use the exact formatting with **bold** headers and clear sections.`;

    const postData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
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
        logger.info('Resume analysis completed', { 
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
    logger.error('Error in analyzeResume function', { error: error.message });
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
});
