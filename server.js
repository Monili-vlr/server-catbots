require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a Supabase usando las llaves de Render
const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

app.post('/api/chat', async (req, res) => {
    try {
        // Capturamos lo que escribe el cliente
        const userMessage = req.body.messages[req.body.messages.length - 1].content;

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

        // 💾 MAGIA: GUARDAR EN SUPABASE EN SEGUNDO PLANO
        if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://dummy.supabase.co') {
            // Guardar pregunta del cliente
            supabase.from('chat_logs').insert([{ 
                local_id: '45-33', role: 'user', message: userMessage 
            }]).then();

            // Guardar respuesta de la IA
            supabase.from('chat_logs').insert([{ 
                local_id: '45-33', role: 'assistant', message: botReplyText 
            }]).then();
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
