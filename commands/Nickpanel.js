const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'nickpanel',
    description: 'Project Swisty Nick Bulucu Paneli',
    async execute(message, args) {
        // Komutu kullanan kişinin yönetici yetkisi var mı kontrol ediyoruz
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: '❌ Bu komutu kullanabilmek için **Yönetici** yetkisine sahip olmalısın!', flags: [64] });
        }

        // Gönderdiğin görseldeki tasarıma birebir uyarlanmış dev başlık ve içerik
        const embed = new EmbedBuilder()
            .setColor('#113ccf')
            .setDescription(
                `# 🔺 Project Swisty Nick Bulucu\n` +
                `| 🟢 **Durum:** \`Aktif / Hazır\`\n\n` +
                `───────────────────────────────────\n\n` +
                `### 💙 Bu Araç Ne Yapar?\n` +
                `Kaç harfli bir Discord nick istediğini söyle, sistem Discord'un resmi API'sini kullanarak o uzunlukta **boşta olan ilk nick'i** bulur ve sana **DM** olarak gönderir.\n\n` +
                `### ➕ Nasıl Kullanılır?\n` +
                `> ⚞ Aşağıdaki **Nick Ara** butonuna bas.\n` +
                `> ⚞ Kaç karakterlik nick istediğini gir — örn. \`6\`\n` +
                `> ⚞ Sistem o uzunlukta boş bir nick bulana kadar tarar.\n` +
                `> ⚞ Bulduğu ilk müsait nick sana **DM** olarak gelir.\n\n` +
                `### 💥 Notlar\n` +
                `> ⚞ Minimum **4**, maksimum **32** karakter.\n` +
                `> ⚞ 1-3 arası girersen seni uyarır, aramaz.\n` +
                `> ⚞ Nick bulununca sistem hemen durur, sistemi yormaz.\n\n` +
                `───────────────────────────────────\n` +
                `project swisty altyapısı`
            );

        // Şık "Nick Ara" butonu
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('swisty_nick_ara')
                    .setLabel('Nick Ara')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🌙')
            );

        // Komut yazılan mesajı temizleyip paneli gönderiyoruz
        await message.delete().catch(() => {});
        await message.channel.send({ embeds: [embed], components: [row] });
    }
};
