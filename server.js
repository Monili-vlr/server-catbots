require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit'); // <-- El portero

const app = express();
app.set('trust proxy', 1); // Vital para leer la IP en Wix y Render
app.use(cors());
app.use(express.json());

// 🛑 EL PORTERO: 20 mensajes cada 5 horas
const chatLimiter = rateLimit({
    windowMs: 5 * 60 * 60 * 1000, // 5 horas
    max: 20, // 20 mensajes
    // Formateado para que el frontend de Wix lo lea como un error normal
    message: { error: { message: "Límite de 20 mensajes alcanzado. Vuelve en unas horas o contacta con el personal." } },
    standardHeaders: true,
    legacyHeaders: false,
});

const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        // 1. LLAMADA A OPENAI (Usando la programación exacta del frontend)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        const botReplyText = data.choices[0].message.content;

        // 🧹 2. LIMPIADOR DE MENSAJE (Para un Fine-Tuning perfecto en Supabase)
        let cleanUserMessage = "Mensaje desconocido";
        try {
            const rawContent = req.body.messages[req.body.messages.length - 1].content;
            const lines = rawContent.split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].startsWith('Cliente: ')) {
                    cleanUserMessage = lines[i].replace('Cliente: ', '').trim();
                    break;
                }
            }
        } catch (e) {
            console.error("Error limpiando mensaje:", e);
        }

        // 💾 3. GUARDAR EN SUPABASE (Con 'await' para que NO se pierda el último)
        if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://dummy.supabase.co') {
            await Promise.all([
                supabase.from('chat_logs').insert([{ local_id: '45-33', role: 'user', message: cleanUserMessage }]),
                supabase.from('chat_logs').insert([{ local_id: '45-33', role: 'assistant', message: botReplyText }])
            ]);
        }

        // 4. DEVOLVEMOS RESPUESTA A WIX
        res.json(data);

    } catch (error) {
        console.error("Error del servidor:", error);
        res.status(500).json({ error: { message: "Error interno del servidor backend" } });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en puerto ${PORT}`);
});
