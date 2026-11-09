const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Project Swisty Nick Sistemi Aktif ve Çalışıyor!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web sunucusu ${PORT} portunda çalışıyor.`);
});

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
    Client,
    GatewayIntentBits,
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');

// Ana Panel Botu
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Birden fazla probe botu destekleyen havuz (İleride artırabilirsin)
const probeTokens = [
    process.env.PROBE_TOKEN,
    process.env.PROBE_TOKEN_2 // İsteğe bağlı 2. token (.env dosyasına ekleyebilirsin)
].filter(Boolean);

const probeClients = probeTokens.map(token => {
    const pClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    pClient.login(token).catch(err => console.log('Probe bot giriş hatası:', err.message));
    return pClient;
});

// Devam eden aramaları çakışmayı önlemek için tutuyoruz
const activeSearches = new Set();

// Komut Yükleyicisi
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);
        }
    }
}

client.once('ready', () => {
    console.log(`🤖 Project Swisty — Panel Bot: ${client.user.tag} aktif ve hazır!`);
});

// Komut Dinleyicisi (!nickpanel vb.)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
    }
});

// Nick Bulucu Yardımcı Fonksiyonları
const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomCandidate(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    return result;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Tüm probe botlar arasında dönerek rate-limit'i bypass eden arama motoru
async function findAvailableNick(clientsArray, length, maxAttempts = 30, delayMs = 2000) {
    if (clientsArray.length === 0) {
        throw new Error("Hiç aktif probe bot bulunamadı!");
    }

    let currentProbeIndex = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const candidate = randomCandidate(length);
        const activeProber = clientsArray[currentProbeIndex];

        try {
            await activeProber.user.setUsername(candidate);
            return { success: true, nick: candidate, attempts: attempt };
        } catch (err) {
            console.log(`[DENEME ${attempt} | Bot #${currentProbeIndex + 1}] "${candidate}" başarısız ->`, {
                message: err?.message,
                status: err?.status
            });

            const msg = (err?.message || '').toLowerCase();
            const isRateLimited =
                err?.status === 429 ||
                err?.code === 'RATE_LIMITED' ||
                msg.includes('too fast') ||
                msg.includes('rate limit');

            // Eğer rate-limit yediyse ve birden fazla botumuz varsa, sıradaki diğer probe bota geç!
            if (isRateLimited && clientsArray.length > 1) {
                console.log(`⚠️ Bot #${currentProbeIndex + 1} rate-limit yedi, diğer probe bota geçiliyor...`);
                currentProbeIndex = (currentProbeIndex + 1) % clientsArray.length;
            } else if (isRateLimited && clientsArray.length === 1) {
                // Tek bot varsa ve rate-limit yediyse mecburen durur veya bekler
                return { success: false, reason: 'rate_limited', attempts: attempt };
            }
        }
        await sleep(delayMs);
    }
    return { success: false, reason: 'not_found', attempts: maxAttempts };
}

// Panel Butonları ve Modal Yönetimi
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'swisty_nick_ara') {
            const modal = new ModalBuilder()
                .setCustomId('modal_nick_ara')
                .setTitle('Project Swisty — Nick Ara');

            const lengthInput = new TextInputBuilder()
                .setCustomId('nick_length')
                .setLabel('Kaç karakterlik nick istiyorsun?')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('örn. 6')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(lengthInput)
            );

            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_nick_ara') {
            const raw = interaction.fields.getTextInputValue('nick_length').trim();
            const length = parseInt(raw, 10);

            if (isNaN(length)) {
                return interaction.reply({ content: '❌ Lütfen sadece sayı gir (örn. 6).', flags: [64] });
            }

            if (length < 4) {
                return interaction.reply({ content: '⚠️ Minimum **4** karakter girmelisin.', flags: [64] });
            }

            if (length > 32) {
                return interaction.reply({ content: '⚠️ Maksimum **32** karakter girebilirsin.', flags: [64] });
            }

            if (activeSearches.has(client.user.id)) {
                return interaction.reply({ content: '⏳ Sistem şu anda başka bir arama yapıyor, lütfen biraz sonra tekrar dene.', flags: [64] });
            }

            await interaction.reply({ content: `🔎 **${length}** karakterlik boşta bir nick aranıyor... Bulunca sana DM olarak gelecek.`, flags: [64] });

            activeSearches.add(client.user.id);

            try {
                const result = await findAvailableNick(probeClients, length);

                if (result.success) {
                    try {
                        await interaction.user.send(
                            `✅ **${length}** karakterlik boşta nick bulundu: \`${result.nick}\`\n` +
                            `Project Swisty bu ismi senin için ayırdı.`
                        );
                    } catch (dmErr) {
                        await interaction.followUp({
                            content: `✅ Nick bulundu: \`${result.nick}\` — fakat sana DM gönderemedim, DM'lerin kapalı olabilir.`,
                            flags: [64]
                        });
                    }
                } else if (result.reason === 'rate_limit') {
                    await interaction.followUp({
                        content: '⛔ Discord rate-limit uyguladı. Lütfen bir süre sonra tekrar dene.',
                        flags: [64]
                    });
                } else {
                    await interaction.followUp({
                        content: `❌ ${result.attempts} denemede **${length}** karakterlik boşta bir nick bulunamadı.`,
                        flags: [64]
                    });
                }
            } finally {
                activeSearches.delete(client.user.id);
            }
        }
    }
});

// Bot Girişi
client.login(process.env.DISCORD_TOKEN);
// Discord istemcisi bağlantı kopmalarını ve hatalarını yakalama
client.on('shardDisconnect', (event, id) => {
    console.log(`⚠️ Uyarı: Bot bağlantısı kesildi (Shard ID: ${id}). Yeniden bağlanmaya çalışılıyor...`);
});

client.on('shardReconnecting', (id) => {
    console.log(`🔄 Bilgi: Bot yeniden bağlanıyor... (Shard ID: ${id})`);
});

// Yakalanmayan hataların botu tamamen çökertmesini engellemek için
process.on('unhandledRejection', error => {
    console.error('Beklenmeyen Promise Hatası:', error);
});

process.on('uncaughtException', error => {
    console.error('Kritik Hata (Uncaught Exception):', error);
});
