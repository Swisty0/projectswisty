const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Project Swisty 7/24 Ses ve Nick Sistemi Aktif ve Çalışıyor!');
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
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

// Ana Panel Botu
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Probe Bot (Nick bulucu için görünmez bot)
const probeClient = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Sese sokulan aktif kullanıcı oturumlarını ve arama durumlarını hafızada tutuyoruz
const activeVoiceSessions = new Map();
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

probeClient.once('ready', () => {
    console.log(`👻 Project Swisty — Probe Bot: ${probeClient.user.tag} arka planda hazır (görünmez).`);
});

// Komut Dinleyicisi (!sespanel, !nickpanel vb.)
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

async function findAvailableNick(proberClient, length, maxAttempts = 25, delayMs = 1500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const candidate = randomCandidate(length);
        try {
            await proberClient.user.setUsername(candidate);
            return { success: true, nick: candidate, attempts: attempt };
        } catch (err) {
            console.log(`[DENEME ${attempt}] "${candidate}" başarısız ->`, {
                message: err?.message,
                code: err?.code,
                status: err?.status
            });

            const msg = (err?.message || '').toLowerCase();
            const isRateLimited =
                err?.status === 429 ||
                err?.code === 'RATE_LIMITED' ||
                msg.includes('too fast') ||
                msg.includes('rate limit');

            if (isRateLimited) {
                return { success: false, reason: 'rate_limited', attempts: attempt };
            }
        }
        await sleep(delayMs);
    }
    return { success: false, reason: 'not_found', attempts: maxAttempts };
}

// Panel Butonları ve Modal Yönetimi (Hem 7/24 Ses hem Nick Arama)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        // 1) 7/24 Ses Paneli Butonları
        if (interaction.customId === 'swisty_bot_sese_kur') {
            const modal = new ModalBuilder()
                .setCustomId('modal_bot_sese_kur')
                .setTitle('Kullanıcı Hesabını Sese Bırak');

            const tokenInput = new TextInputBuilder()
                .setCustomId('bot_tokens')
                .setLabel('Hesap Token(leri) - Alt alta yazın')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Kullanıcı tokenlerini buraya yapıştırın')
                .setRequired(true);

            const channelInput = new TextInputBuilder()
                .setCustomId('voice_channel_id')
                .setLabel('Ses Kanal ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Girilecek ses kanalının IDsi')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(tokenInput),
                new ActionRowBuilder().addComponents(channelInput)
            );

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'swisty_aktif_botlar') {
            await interaction.reply({ content: `📊 Sistemde sese bağlı aktif hesap sayısı: **${activeVoiceSessions.size}**`, flags: [64] });
        }

        if (interaction.customId === 'swisty_baglantiyi_kes') {
            let count = 0;
            for (const [token, data] of activeVoiceSessions.entries()) {
                try {
                    data.connection.destroy();
                    data.client.destroy();
                    count++;
                } catch (e) {}
            }
            activeVoiceSessions.clear();
            await interaction.reply({ content: `🔴 Toplam **${count}** adet hesabın ses bağlantısı sonlandırıldı.`, flags: [64] });
        }

        // 2) Nick Bulucu Butonu
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
        // Ses Paneli Form Gönderimi
        if (interaction.customId === 'modal_bot_sese_kur') {
            const tokenText = interaction.fields.getTextInputValue('bot_tokens');
            const channelId = interaction.fields.getTextInputValue('voice_channel_id');
            const guild = interaction.guild;

            const targetChannel = guild.channels.cache.get(channelId);
            if (!targetChannel) {
                return await interaction.reply({ content: '❌ Hata: Belirttiğiniz ID geçerli bir ses kanalı değil!', flags: [64] });
            }

            const tokens = tokenText.split('\n').map(t => t.trim()).filter(t => t.length > 0);

            if (tokens.length === 0) {
                return await interaction.reply({ content: '❌ Geçerli bir token bulunamadı!', flags: [64] });
            }

            await interaction.reply({ content: `⏳ Girilen **${tokens.length}** adet kullanıcı hesabı <#${channelId}> kanalına bağlanıyor...`, flags: [64] });

            let successCount = 0;

            for (const token of tokens) {
                try {
                    const userClient = new SelfClient({
                        checkUpdate: false,
                        intents: []
                    });

                    userClient.once('ready', async () => {
                        try {
                            setTimeout(async () => {
                                const connection = joinVoiceChannel({
                                    channelId: targetChannel.id,
                                    guildId: guild.id,
                                    adapterCreator: targetChannel.guild.voiceAdapterCreator,
                                    selfDeaf: true,
                                    selfMute: true
                                });

                                await entersState(connection, VoiceConnectionStatus.Ready, 20 * 1000);
                                console.log(`[7/24 KULLANICI SES] ${userClient.user.tag} sese başarıyla bağlandı!`);
                                
                                activeVoiceSessions.set(token, { client: userClient, connection });
                            }, 2000);
                        } catch (err) {
                            console.error(`[HATA] Kullanıcı sese bağlanamadı:`, err.message);
                        }
                    });

                    await userClient.login(token);
                    successCount++;
                } catch (err) {
                    console.error('Kullanıcı token giriş hatası:', err.message);
                }
            }

            await interaction.editReply({ content: `✅ İşlem tamamlandı! Toplam **${successCount}** kullanıcı hesabı sese yerleştirildi.` });
        }

        // Nick Bulucu Form Gönderimi
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
                const result = await findAvailableNick(probeClient, length);

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
                } else if (result.reason === 'rate_limited') {
                    await interaction.followUp({
                        content: '⛔ Discord rate-limit uyguladı, çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar dene.',
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

// Bot Girişleri (Render ve `.env` ayarları için)
client.login(process.env.DISCORD_TOKEN);
probeClient.login(process.env.PROBE_TOKEN);
