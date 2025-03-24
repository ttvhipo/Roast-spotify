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
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';  // Corrected endpoint

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

checkRequiredEnvVars();

// 1️⃣ Redirect user to Spotify login
app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    res.redirect(`${SPOTIFY_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${scope}`);
});

// 2️⃣ Handle Spotify authentication callback
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios.post(SPOTIFY_TOKEN_URL, new URLSearchParams({
            code,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        }).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        res.redirect(`https://ttvhipo.github.io/Roast-Spotify-WEB/?access_token=${response.data.access_token}`);
    } catch (error) {
        console.error('Error getting access token:', error.response?.data || error.message);
        res.send('Error logging in.');
    }
});

// 3️⃣ Fetch user's top artists
app.get('/top-artists', async (req, res) => {
    const token = req.query.access_token;
    
    try {
        const response = await axios.get(SPOTIFY_TOP_ARTISTS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json(response.data.items.map(artist => artist.name));
    } catch (error) {
        console.error('Error fetching top artists:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

// 4️⃣ Roast user's music taste using DeepSeek AI
app.get('/roast', async (req, res) => {
    const token = req.query.access_token;
    
    try {
        // Get top artists from Spotify
        const spotifyResponse = await axios.get(SPOTIFY_TOP_ARTISTS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const artists = spotifyResponse.data.items.map(artist => artist.name);
        console.log('Artists:', artists);

        if (artists.length === 0) {
            return res.json({ roast: "Wow... you don't even listen to music?" });
        }

        // Generate roast using DeepSeek AI
        const deepseekResponse = await axios.post(DEEPSEEK_API_URL, {
            messages: [
                {
                    role: "user",
                    content: `You are a music critic known for your witty and sarcastic commentary. Roast my music taste based on these artists: ${artists.join(', ')}`
                }
            ],
            model: "deepseek-chat",
            temperature: 0.7,
            max_tokens: 200,
            stream: false
        }, {
            headers: {
                'Authorization': `sk-${DEEPSEEK_API_KEY}`,  // Note the 'sk-' prefix
                'Content-Type': 'application/json'
            }
        });

        console.log('DeepSeek response:', deepseekResponse.data);
        
        // Extract the roast content
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
