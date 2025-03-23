const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public'));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

app.get('/login', (req, res) => {
    const scope = 'user-top-read';
    const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&scope=${scope}`;
    res.redirect(authUrl);
});

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
        console.error('Error getting access token:', error.response.data);
        res.send('Error logging in.');
    }
});

app.get('/top-artists', async (req, res) => {
    const token = req.query.access_token;
    
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        res.json(response.data.items.map(artist => artist.name));
    } catch (error) {
        console.error('Error fetching top artists:', error.response.data);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/generate';

app.get('/roast', async (req, res) => {
    const token = req.query.access_token;

    try {
        const spotifyResponse = await axios.get('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const artists = spotifyResponse.data.items.map(artist => artist.name);
        if (artists.length === 0) {
            return res.json({ roast: "Wow... you don't even listen to music?" });
        }

        const deepseekResponse = await axios.post(DEEPSEEK_API_URL, {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are an AI that roasts people's music taste in a funny way." },
                { role: "user", content: `Roast my music taste based on these artists: ${artists.join(', ')}` }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
        });

        res.json({ roast: deepseekResponse.data.choices[0].message.content });
    } catch (error) {
        console.error('Error generating roast:', error.response.data);
        res.status(500).json({ error: 'Failed to generate roast' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
