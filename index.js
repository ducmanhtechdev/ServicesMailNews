require('dotenv').config();
const express = require('express');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

const app = express();
// User-Agent này để Google News thấy mình giống người thường
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    },
    timeout: 10000 // 10 giây
});
const PORT = process.env.PORT || 3000;

// Dùng RSS của Google News lọc tin từ VnExpress (site:vnexpress.net)
const FEEDS = [
    { name: '📰 CHÍNH TRỊ & XÃ HỘI', url: 'https://news.google.com/rss/search?q=site:vnexpress.net+ch%C3%ADnh+tr%E1%BB%8B+x%C3%A3+h%E1%BB%99i&hl=vi&gl=VN&ceid=VN:vi' },
    { name: '⚖️ PHÁP LUẬT', url: 'https://news.google.com/rss/search?q=site:vnexpress.net+ph%C3%A1p+lu%E1%BA%ADt&hl=vi&gl=VN&ceid=VN:vi' },
    { name: '⚽ BÓNG ĐÁ', url: 'https://news.google.com/rss/search?q=site:vnexpress.net+b%C3%B3ng+%C4%91%C3%A1&hl=vi&gl=VN&ceid=VN:vi' },
    { name: '📱 CÔNG NGHỆ', url: 'https://news.google.com/rss/search?q=site:vnexpress.net+c%C3%B4ng+ngh%E1%BB%87&hl=vi&gl=VN&ceid=VN:vi' }
];

async function processNewsAndEmail() {
    console.log('🔄 Bắt đầu lấy tin từ Google News...');
    let emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c00; border-bottom: 2px solid #c00; padding-bottom: 10px;">Bản Tin Sáng ${new Date().toLocaleDateString('vi-VN')}</h2>`;

    let hasNews = false;

    for (const feed of FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            // Lấy 5 tin đầu tiên
            const topItems = feedData.items.slice(0, 5);

            if (topItems.length > 0) {
                hasNews = true;
                emailContent += `<h3 style="background-color: #f0f0f0; padding: 5px 10px; margin-top: 20px;">${feed.name}</h3><ul>`;

                topItems.forEach(item => {
                    // Google News link rất dài, nên ẩn đi
                    emailContent += `
                        <li style="margin-bottom: 12px; line-height: 1.4;">
                            <a href="${item.link}" style="text-decoration: none; color: #003366; font-weight: bold; font-size: 14px;">${item.title}</a>
                            <br><span style="font-size: 11px; color: #666;">${item.pubDate}</span>
                        </li>`;
                });
                emailContent += `</ul>`;
            }
        } catch (error) {
            console.error(`⚠️ Lỗi mục [${feed.name}]: ${error.message}`);
        }
    }

    emailContent += `<hr><p style="font-size: 12px; color: #888; text-align: center;">Tin tức được tổng hợp tự động từ Google News</p></div>`;

    if (!hasNews) {
        throw new Error("Không lấy được tin nào cả (Có thể Google cũng chặn hoặc Link sai).");
    }

    // Gửi mail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
        from: `"Bot Tin Sáng" <${process.env.EMAIL_USER}>`,
        to: process.env.RECEIVER_EMAIL,
        subject: `[Daily News] Tin tức ngày ${new Date().toLocaleDateString('vi-VN')}`,
        html: emailContent,
    });
    console.log('✅ Email đã gửi thành công!');
}

app.get('/trigger-news', async (req, res) => {
    try {
        await processNewsAndEmail();
        res.send('✅ Thành công! Check mail đi.');
    } catch (error) {
        console.error('❌ Lỗi Fatal:', error);
        res.status(500).send('❌ Thất bại: ' + error.message);
    }
});

app.get('/', (req, res) => res.send('News Bot is Alive and Watching Google!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));