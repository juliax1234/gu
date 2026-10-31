const { isIP } = require("node:net");

module.exports = async (req, res) => {
    // Aceita somente POST
    if (req.method !== "POST") {
        return res.status(405).json({ ok: false });
    }

    // Confere se a requisição veio do próprio site
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (!origin || !host) {
        return res.status(403).json({ ok: false });
    }

    try {
        const originHost = new URL(origin).host;

        if (originHost !== host) {
            return res.status(403).json({ ok: false });
        }
    } catch {
        return res.status(403).json({ ok: false });
    }

    // Obtém o IP
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];

    const ip = String(
        realIp || (forwarded ? forwarded.split(",")[0] : "")
    ).trim();

    if (!isIP(ip)) {
        return res.status(400).json({ ok: false });
    }

    // Região aproximada
    const country =
        req.headers["x-vercel-ip-country"] || "Desconhecido";

    const region =
        req.headers["x-vercel-ip-country-region"] || "Desconhecida";

    const createdAt = new Date().toISOString();

    // Variáveis de ambiente
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;

    if (!supabaseUrl || !supabaseKey || !discordWebhook) {
        console.error("Variáveis de ambiente não configuradas.");
        return res.status(500).json({ ok: false });
    }

    try {
        // Salva no Supabase
        const databaseUrl = `${supabaseUrl.trim().replace(/\/+$/, "")}/rest/v1/site_visits`;

        console.log("URL usada no Supabase:", databaseUrl);

        const databaseResponse = await fetch(
            databaseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
                Prefer: "return=minimal"
            },
            body: JSON.stringify({
                ip_address: ip,
                country: country,
                region: region,
                created_at: createdAt
            })
        }
        );

        if (!databaseResponse.ok) {
            const errorText = await databaseResponse.text();
            console.error("Erro ao salvar visita:", errorText);
            return res.status(500).json({ ok: false });
        }

        // Formata o horário
        const visitTime = new Date(createdAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo"
        });

        // Envia para o Discord
        const discordResponse = await fetch(discordWebhook, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content:
                    `🌐 **Nova visita no AthenasMagic**\n\n` +
                    `📍 **IP:** ${ip}\n` +
                    `🌎 **País:** ${country}\n` +
                    `🗺️ **Região:** ${region}\n` +
                    `🕒 **Horário:** ${visitTime}`,
                allowed_mentions: {
                    parse: []
                }
            })
        });

        if (!discordResponse.ok) {
            console.error("Erro ao enviar notificação ao Discord.");
        }

        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error("Erro ao registrar visita:", error.message);
        return res.status(500).json({ ok: false });
    }
};