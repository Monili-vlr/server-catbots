require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Permettiamo a TUTTI i siti (incluso il tuo Wix o HTML locale) di comunicare con questo server
app.use(cors());
app.use(express.json());

// Questo è l'indirizzo (endpoint) che il tuo chat chiamerà
app.post('/api/chat', async (req, res) => {
    try {
        console.log("📥 Ricevuto messaggio dal Chatbot...");

        // Il tuo PC inoltra la richiesta a OpenAI usando la TUA CHIAVE SEGRETA
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        // Controlla se OpenAI ha dato errori (es. credito esaurito)
        if (!response.ok) {
            console.error("❌ Errore OpenAI:", data.error.message);
            return res.status(response.status).json(data);
        }

        console.log("📤 Risposta di OpenAI inviata al Chatbot!");
        
        // Manda la risposta di OpenAI indietro al tuo file HTML
        res.json(data);

    } catch (error) {
        console.error("❌ Errore del server interno:", error);
        res.status(500).json({ error: "Errore di connessione del server locale." });
    }
});

// Accendiamo il server sulla porta 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ SERVER ACCESO! In ascolto su: http://localhost:${PORT}`);
    console.log(`⏳ In attesa di messaggi dal tuo Chatbot...`);
});