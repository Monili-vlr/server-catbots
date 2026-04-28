require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); 
app.use(cors());
app.use(express.json());

// 🛑 EL PORTERO: 20 mensajes cada 5 horas
const chatLimiter = rateLimit({
    windowMs: 5 * 60 * 60 * 1000,
    max: 20,
    message: { error: { message: "Límite de 20 mensajes alcanzado. Vuelve en unas horas o contacta con el personal." } },
    standardHeaders: true,
    legacyHeaders: false,
});

const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🟢 RUTA PING: ESTO MANTIENE DESPIERTO A RENDER Y DEJA LOGS
app.get('/', (req, res) => {
    console.log("🟢 Ping recibido de cron-job. Servidor mantenido despierto.");
    res.send("Servidor Backend Activo y Despierto");
});

// 🟢 ENDPOINT PARA GUARDAR EL CONSENTIMIENTO GDPR
app.post('/api/gdpr_consent', async (req, res) => {
    try {
        const { email, local_id, terms_version, marketing_opt_in } = req.body;
        
        if (!email || !local_id || marketing_opt_in === undefined) {
            return res.status(400).json({ error: "Faltan campos obligatorios: email, local_id, marketing_opt_in" });
        }
        
        const terms = terms_version || "1.0";
        
        const { error } = await supabase
            .from('leads')
            .upsert({
                email: email,
                local_id: local_id,
                terms_version: terms,
                marketing_opt_in: marketing_opt_in,
                gdpr_accepted: true
            }, {
                onConflict: 'email'
            });
        
        if (error) throw error;
        
        res.json({ success: true, message: "Consentimiento GDPR guardado" });
    } catch (error) {
        console.error("Error guardando consentimiento GDPR:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 🟢 ENDPOINT DEL CHAT (con rate limiter)
app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: req.body.model,
                messages: req.body.messages,
                temperature: req.body.temperature
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        const botReplyText = data.choices[0].message.content;

        // 🧹 LIMPIADOR DE MENSAJE
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

        // 💾 GUARDAR EN SUPABASE MULTI-TENANT
        if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'https://dummy.supabase.co') {
            const id_del_local = req.body.local_id || 'desconocido';

            await Promise.all([
                supabase.from('chat_logs').insert([{ local_id: id_del_local, role: 'user', message: cleanUserMessage }]),
                supabase.from('chat_logs').insert([{ local_id: id_del_local, role: 'assistant', message: botReplyText }])
            ]);
        }

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
