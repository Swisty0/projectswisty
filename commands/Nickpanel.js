const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'nickpanel',
    description: 'Project Swisty Nick Bulucu Paneli',
    async execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor('#113ccf')
            .setDescription('# 🔺 PROJECT SWİSTY NİCK BULUCU\n\n')
            .setDescription(
                `🟢 **Durum:** \`Aktif / Hazır\`\n\n` +
                `───────────────────────────────────\n\n` +
                `💙 **Bu Araç Ne Yapar?**\n` +
                `Kaç harfli bir Discord nick istediğini söyle, sistem Discord'un resmi API'sini kullanarak o uzunlukta **boşta olan ilk nick'i** bulur ve sana **DM** olarak gönderir.\n\n` +
                `───────────────────────────────────\n\n` +
                `➕ **Nasıl Kullanılır?**\n` +
                `» Aşağıdaki **Nick Ara** butonuna bas.\n` +
                `» Kaç karakterlik nick istediğini gir — örn. \`6\`\n` +
                `» Sistem o uzunlukta boş bir nick bulana kadar tarar.\n` +
                `» Bulduğu ilk müsait nick sana **DM** olarak gelir.\n\n` +
                `───────────────────────────────────\n\n` +
                `🌸 **Notlar**\n` +
                `» Minimum **4**, maksimum **32** karakter.\n` +
                `» 1-3 arası girersen seni uyarır, aramaz.\n` +
                `» Nick bulununca sistem hemen durur, sistemi yormaz.`
            )
            .setFooter({ text: 'Project Swisty • discord.gg/swisty' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('swisty_nick_ara')
                    .setLabel('Nick Ara')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🌙')
            );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
};
