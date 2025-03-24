const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'https://ttvhipo.github.io' }));
app.use(express.static('public'));

// Environment variables
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// API endpoints
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TOP_ARTISTS_URL = 'https://api.spotify.com/v1/me/top/artists?limit=5';
const DEEPSEEK_API_URL = 'https://api.deepseek.ai/v1/chat/completions';

// Configuration check on startup
function checkRequiredEnvVars() {
    const required = [
        'SPOTIFY_CLIENT_ID',
        'SPOTIFY_CLIENT_SECRET',
        'REDIRECT_URI',
        'DEEPSEEK_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        process.exit(1);
    }

    console.log('All required environment variables are present');
}

// Run configuration check
checkRequiredEnvVars();

// 1️⃣ Redirect user to Spotify login
app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${scope}`;
    res.redirect(authUrl);
});

// 2️⃣ Handle Spotify authentication callback
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        console.error('No code provided in callback');
        return res.status(400).send('Authorization code missing');
    }

    try {
        const response = await axios.post(SPOTIFY_TOKEN_URL, 
            new URLSearchParams({
                code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        res.redirect(`https://ttvhipo.github.io/Roast-Spotify-WEB/?access_token=${response.data.access_token}`);
    } catch (error) {
        console.error('Error getting access token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).send('Error during login process');
    }
});

// 3️⃣ Fetch user's top artists
app.get('/top-artists', async (req, res) => {
    const token = req.query.access_token;
    
    if (!token) {
        return res.status(401).json({ error: 'Access token is required' });
    }

    try {
        const response = await axios.get(SPOTIFY_TOP_ARTISTS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const artists = response.data.items.map(artist => artist.name);
        res.json(artists);
    } catch (error) {
        console.error('Error fetching top artists:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

// 4️⃣ Roast user's music taste using DeepSeek AI
app.get('/roast', async (req, res) => {
    const token = req.query.access_token;
    
    if (!token) {
        return res.status(401).json({ error: 'Access token is required' });
    }

    try {
        // Get top artists from Spotify
        const spotifyResponse = await axios.get(SPOTIFY_TOP_ARTISTS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const artists = spotifyResponse.data.items.map(artist => artist.name);
        
        if (artists.length === 0) {
            return res.json({ roast: "Wow... you don't even listen to music?" });
        }

        console.log('Artists:', artists);

        // Generate roast using DeepSeek AI
        const deepseekResponse = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: "You are an AI that roasts people's music taste in a funny and creative way. Keep responses under 100 words and make them entertaining."
                },
                {
                    role: "user",
                    content: `Roast my music taste based on these artists: ${artists.join(', ')}`
                }
            ],
            temperature: 0.8,
            max_tokens: 150,
            top_p: 1,
            frequency_penalty: 0.5,
            presence_penalty: 0.5
        }, {
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract the roast from the response
        const roastContent = deepseekResponse.data.choices[0]?.message?.content;
        
        if (!roastContent) {
            throw new Error('No roast content received from DeepSeek API');
        }

        res.json({ roast: roastContent });
    } catch (error) {
        console.error('Error generating roast:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            config: {
                url: error.config?.url,
                method: error.config?.method
            }
        });

        res.status(500).json({ 
            error: 'Failed to generate roast',
            details: error.response?.data?.error_msg || error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Perform any necessary cleanup
    process.exit(1);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Perform any necessary cleanup
    process.exit(1);
});
