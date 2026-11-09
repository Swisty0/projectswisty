const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'nickpanel',
    description: 'Project Swisty Nick Bulucu Paneli',
    async execute(message, args) {
        // Komutu kullanan kişinin yönetici yetkisi var mı kontrol ediyoruz
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: '❌ Bu komutu kullanabilmek için **Yönetici** yetkisine sahip olmalısın!', flags: [64] });
        }

        // Özelleştirilmiş emojili ve şık tasarım
        const embed = new EmbedBuilder()
            .setColor('#113ccf')
            .setDescription(
                `# <:olympyx_ay:1568374578206744636> Project Swisty Nick Bulucu\n` +
                `| 🟢 **Durum:** \`Aktif / Hazır\`\n\n` +
                `───────────────────────────────────\n\n` +
                `### <a:zoktay:1568374689510727680> Bu Araç Ne Yapar?\n` +
                `Kaç harfli bir Discord nick istediğini söyle, sistem Discord'un resmi API'sini kullanarak o uzunlukta **boşta olan ilk nick'i** bulur ve sana **DM** olarak gönderir.\n\n` +
                `### <:plus:1568374599043780619> Nasıl Kullanılır?\n` +
                `> <a:sagaok:1568374522779017477> Aşağıdaki **Nick Ara** butonuna bas.\n` +
                `> <a:sagaok:1568374522779017477> Kaç karakterlik nick istediğini gir — örn. \`6\`\n` +
                `> <a:sagaok:1568374522779017477> Sistem o uzunlukta boş bir nick bulana kadar tarar.\n` +
                `> <a:sagaok:1568374522779017477> Bulduğu ilk müsait nick sana **DM** olarak gelir.\n\n` +
                `### <:kizgin:1568374761602687017> Notlar\n` +
                `> <a:sagaok:1568374522779017477> Minimum **4**, maksimum **32** karakter.\n` +
                `> <a:sagaok:1568374522779017477> 1-3 arası girersen seni uyarır, aramaz.\n` +
                `> <a:sagaok:1568374522779017477> Nick bulununca sistem hemen durur, sistemi yormaz.\n\n` +
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
