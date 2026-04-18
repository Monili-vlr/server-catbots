require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit'); // <-- El portero

const app = express();
app.set('trust proxy', 1); // Vital para leer la IP en Wix
app.use(cors());
app.use(express.json());

// 🛑 EL PORTERO: 20 mensajes cada 5 horas
const chatLimiter = rateLimit({
    windowMs: 5 * 60 * 60 * 1000, // 5 horas en milisegundos
    max: 20, // 20 mensajes
    message: { error: "Límite de 20 mensajes alcanzado. Vuelve en unas horas. Puede contactar con el personal para seguir siendo atendido." },
    standardHeaders: true,
    legacyHeaders: false,
});

const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        const userMessage = req.body.messages[req.body.messages.length - 1].content;

        // 🤖 INYECTAR CORDIALIDAD
        const messagesForAI = [
            { role: "system", content: "Eres un asistente virtual muy cordial y amable. Siempre respondes con respeto y de forma clara." },
            ...req.body.messages
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: req.body.model || "gpt-4o-mini", // <-- Usamos gpt-4o-mini aquí
                messages: messagesForAI
            })
        });

        const data = await response.json();
        
        if (!response.ok) return res.status(response.status).json(data);

        const botReplyText = data.choices[0].message.content;

        // 💾 GUARDAR EN SUPABASE
        if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://dummy.supabase.co') {
            supabase.from('chat_logs').insert([{ local_id: 'Wix-User', role: 'user', message: userMessage }]).then();
            supabase.from('chat_logs').insert([{ local_id: 'Wix-User', role: 'assistant', message: botReplyText }]).then();
        }

        res.json(data);

    } catch (error) {
        console.error("Error del servidor:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
