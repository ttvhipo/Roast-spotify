const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public'));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const PORT = process.env.PORT || 3000;

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_TOP_ARTISTS_URL = 'https://api.spotify.com/v1/me/top/artists?limit=5';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/generate';

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

        res.redirect(`/index.html?access_token=${response.data.access_token}`);
    } catch (error) {
        console.error('Error getting access token:', error.response?.data);
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
        console.error('Error fetching top artists:', error.response?.data);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

// 4️⃣ Roast user's music taste using DeepSeek AI
app.get('/roast', async (req, res) => {
    const token = req.query.access_token;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

    try {
        // Get top artists from Spotify
        const spotifyResponse = await axios.get(SPOTIFY_TOP_ARTISTS_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const artists = spotifyResponse.data.items.map(artist => artist.name);
        if (artists.length === 0) {
            return res.json({ roast: "Wow... you don't even listen to music?" });
        }

        // Generate roast using DeepSeek AI
        const deepseekResponse = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are an AI that roasts people's music taste in a funny way." },
                { role: "user", content: `Roast my music taste based on these artists: ${artists.join(', ')}` }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' }
        });

        res.json({ roast: deepseekResponse.data.choices[0].message.content });
    } catch (error) {
        console.error('Error generating roast:', error.response?.data);
        res.status(500).json({ error: 'Failed to generate roast' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
