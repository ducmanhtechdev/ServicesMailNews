require('dotenv').config();
const express = require('express');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

const app = express();
const parser = new Parser();
const PORT = process.env.PORT || 3000;

const FEEDS = [
    { category: '⚖️ PHÁP LUẬT', url: 'https://vnexpress.net/rss/phap-luat.rss' },
    { category: '⚽ BÓNG ĐÁ', url: 'https://vnexpress.net/rss/the-thao/bong-da.rss' },
    { category: '📱 CÔNG NGHỆ', url: 'https://vnexpress.net/rss/so-hoa.rss' },
    { category: '📰 THỜI SỰ & CHÍNH TRỊ', url: 'https://vnexpress.net/rss/thoi-su.rss' }
];

// Hàm logic lấy tin và gửi mail (giữ nguyên logic cũ)
async function processNewsAndEmail() {
    let emailContent = `<h1>Bản Tin Tổng Hợp Sáng ${new Date().toLocaleDateString('vi-VN')}</h1>`;
    // ... (Code logic fetch tin như cũ) ...
    for (const feed of FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            const top5 = feedData.items.slice(0, 5);
            emailContent += `<h2>${feed.category}</h2><ul>`;
            top5.forEach(item => {
                emailContent += `<li style="margin-bottom: 10px;"><a href="${item.link}">${item.title}</a><br><small>${item.pubDate}</small></li>`;
            });
            emailContent += `</ul><hr>`;
        } catch (e) { console.error(e); }
    }

    // Config gửi mail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
        from: `"Bot Tin Tức" <${process.env.EMAIL_USER}>`,
        to: process.env.RECEIVER_EMAIL,
        subject: `[Daily News] Tổng hợp tin tức 7h sáng - ${new Date().toLocaleDateString('vi-VN')}`,
        html: emailContent,
    });
}

// Tạo API endpoint để kích hoạt
app.get('/trigger-news', async (req, res) => {
    try {
        console.log('⚡ Đang kích hoạt gửi mail...');
        await processNewsAndEmail();
        res.send('✅ Đã gửi mail thành công!');
    } catch (error) {
        console.error(error);
        res.status(500).send('❌ Lỗi: ' + error.message);
    }
});

// Giữ server sống (để Render nhận diện là Web Service)
app.get('/', (req, res) => res.send('News Bot is Alive!'));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});