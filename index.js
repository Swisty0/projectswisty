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

// Project Swisty — Nick Bulucu
// Bu sistem İKİ ayrı bot hesabı kullanır:
//   1) PANEL BOT  -> sunucuda görünen, adı ASLA değişmeyen bot. Komutları
//      ve DM gönderimini bu yönetir.
//   2) PROBE BOT  -> hiçbir sunucuya eklenmeyen, tamamen arka planda
//      çalışan "görünmez" ikinci bot. İsim deneme (rename) işini SADECE
//      bu bot yapar. Hiçbir sunucuda üyesi olmadığı için kimse onun adının
//      değiştiğini görmez. Bulduğu sonucu aynı process içinde (fonksiyon
//      dönüşüyle) panel bota iletir; panel bot da sonucu SADECE isteği
//      yapan kullanıcıya DM olarak gönderir.
//
// Not: Discord'un resmi API'sinde "bu isim boşta mı" diye sorup almadan
// kontrol edebileceğin bir uç nokta yok. Kontrolün tek yolu o ismi
// gerçekten almayı denemek. Bu yüzden MUTLAKA bir hesabın adı değişiyor —
// biz bunu sadece kimsenin görmediği, sunucusuz bir hesaba (probe bot)
// yükleyerek görünmez hale getiriyoruz.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Probe bot: minimal intent yeterli, hiçbir sunucuya davet edilmemeli.
const probeClient = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Devam eden aramaları (çakışmayı önlemek için) burada tutuyoruz
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
    console.log(`⚠️  Bu botu HİÇBİR sunucuya eklemediğinden emin ol, yoksa isim değişiklikleri o sunucuda görünür.`);
});

// Komut Dinleyicisi (!nickpanel)
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

// İzin verilen karakterler: discord kullanıcı adı kuralına uygun (küçük harf + rakam)
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

// Verilen uzunlukta boşta olan ilk nicki arar.
// Discord'un resmi kullanıcı adı değiştirme uç noktasını (client.user.setUsername)
// kullanır: ad doluysa hata döner, boşsa değişim başarılı olur.
// NOT: Discord, kullanıcı adı değişikliklerine sıkı rate-limit uygular
// (hesap başına belirli bir sürede sınırlı sayıda değişim). Bu yüzden
// maxAttempts ve denemeler arası bekleme süresi makul tutulmalı.
async function findAvailableNick(proberClient, length, maxAttempts = 25, delayMs = 1500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const candidate = randomCandidate(length);
        try {
            // Deneme/alma işlemi SADECE probe bot üzerinde yapılır,
            // panel botun adı hiçbir zaman değişmez.
            await proberClient.user.setUsername(candidate);
            // Başarılı olduysa bu isim artık boşta değil, bot bunu aldı.
            return { success: true, nick: candidate, attempts: attempt };
        } catch (err) {
            // Gerçek hatayı konsola yazıyoruz ki rate-limit mi yoksa
            // başka bir şey mi olduğunu görelim.
            console.log(`[DENEME ${attempt}] "${candidate}" başarısız ->`, {
                message: err?.message,
                code: err?.code,
                status: err?.status,
                rawError: err?.rawError
            });

            // Discord kullanıcı adı rate-limitini genelde 400 (Invalid Form Body)
            // + "too fast" içeren bir mesajla döndürür, 429 ile değil.
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
                return interaction.reply({
                    content: '❌ Lütfen sadece sayı gir (örn. 6).',
                    flags: [64]
                });
            }

            if (length < 4) {
                return interaction.reply({
                    content: '⚠️ Minimum **4** karakter girmelisin. 1-3 arası uzunluklar aranmaz, sadece uyarı verilir.',
                    flags: [64]
                });
            }

            if (length > 32) {
                return interaction.reply({
                    content: '⚠️ Maksimum **32** karakter girebilirsin.',
                    flags: [64]
                });
            }

            if (activeSearches.has(client.user.id)) {
                return interaction.reply({
                    content: '⏳ Sistem şu anda başka bir arama yapıyor, lütfen biraz sonra tekrar dene.',
                    flags: [64]
                });
            }

            await interaction.reply({
                content: `🔎 **${length}** karakterlik boşta bir nick aranıyor... Bulunca sana DM olarak gelecek.`,
                flags: [64]
            });

            activeSearches.add(client.user.id);

            try {
                // Not: findAvailableNick burada PROBE bot üzerinde çalışır (görünmez),
                // DM'i ise PANEL bot (interaction.user.send) gönderir — bu yüzden
                // sonuç sadece isteği yapan kullanıcıya ulaşır, sunucuda kimse
                // probe botun adının değiştiğini görmez.
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
                        content: `❌ ${result.attempts} denemede **${length}** karakterlik boşta bir nick bulunamadı. Tekrar deneyebilirsin.`,
                        flags: [64]
                    });
                }
            } finally {
                activeSearches.delete(client.user.id);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
probeClient.login(process.env.PROBE_TOKEN);