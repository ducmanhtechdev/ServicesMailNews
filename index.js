require('dotenv').config();
const express = require('express');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Validation: Đảm bảo biến môi trường tồn tại
const REQUIRED_ENVS = ['EMAIL_USER', 'EMAIL_PASS', 'RECEIVER_EMAIL', 'CRON_SECRET'];
const missingEnvs = REQUIRED_ENVS.filter(key => !process.env[key]);
if (missingEnvs.length > 0) {
    console.error(`❌ CRITICAL: Thiếu biến môi trường: ${missingEnvs.join(', ')}`);
    process.exit(1);
}

// 2. Config Parser: Chỉnh xml2js để "lỏng tay" hơn với các ký tự lạ
const parser = new Parser({
    timeout: 10000, // Timeout sau 10s để tránh treo process
    headers: { 'User-Agent': 'NewsBot/1.0' },
    xml2js: {
        strict: false, // Quan trọng: Cho phép lờ đi các lỗi cú pháp XML nhỏ
        trim: true,
        normalize: true,
        normalizeTags: true
    }
});

const FEEDS = [
    { category: '⚖️ PHÁP LUẬT', url: 'https://vnexpress.net/rss/phap-luat.rss' },
    { category: '⚽ BÓNG ĐÁ', url: 'https://vnexpress.net/rss/the-thao/bong-da.rss' },
    { category: '📱 CÔNG NGHỆ', url: 'https://vnexpress.net/rss/so-hoa.rss' },
    { category: '📰 THỜI SỰ', url: 'https://vnexpress.net/rss/thoi-su.rss' }
];

// Helper: Fetch một feed đơn lẻ với try-catch riêng biệt
async function fetchSingleFeed(feed) {
    try {
        const feedData = await parser.parseURL(feed.url);
        return {
            category: feed.category,
            items: feedData.items.slice(0, 5),
            success: true
        };
    } catch (error) {
        console.warn(`⚠️ Lỗi lấy tin mục [${feed.category}]: ${error.message}`);
        // Trả về cấu trúc lỗi nhưng không throw để Promise.allSettled không chết
        return { category: feed.category, items: [], success: false, error: error.message };
    }
}

async function processNewsAndEmail() {
    console.log('🔄 Bắt đầu lấy tin...');

    // 3. Concurrency: Chạy tất cả request cùng lúc
    const results = await Promise.allSettled(FEEDS.map(fetchSingleFeed));

    // Lọc ra các feed lấy thành công
    const successfulFeeds = results
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value);

    if (successfulFeeds.length === 0) {
        throw new Error('Toàn bộ các nguồn tin đều bị lỗi, không gửi email.');
    }

    // Build HTML
    let emailContent = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="color: #2c3e50;">Bản Tin Sáng ${new Date().toLocaleDateString('vi-VN')}</h1>
            <p>Tổng hợp từ ${successfulFeeds.length}/${FEEDS.length} nguồn tin hoạt động.</p>
            <hr>`;

    successfulFeeds.forEach(feed => {
        emailContent += `<h2 style="color: #d35400;">${feed.category}</h2><ul>`;
        feed.items.forEach(item => {
            emailContent += `
                <li style="margin-bottom: 8px;">
                    <a href="${item.link}" style="text-decoration: none; color: #2980b9; font-weight: bold;">${item.title}</a>
                    <br><span style="font-size: 12px; color: #7f8c8d;">${item.pubDate}</span>
                </li>`;
        });
        emailContent += `</ul>`;
    });

    emailContent += `</div>`;

    // Gửi mail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
        from: `"News Bot" <${process.env.EMAIL_USER}>`,
        to: process.env.RECEIVER_EMAIL,
        subject: `[Daily News] Tổng hợp tin tức - ${new Date().toLocaleDateString('vi-VN')}`,
        html: emailContent,
    });

    return successfulFeeds.length;
}

// 4. Security Middleware: Chặn người lạ trigger API
const authMiddleware = (req, res, next) => {
    const secret = req.query.secret || req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Sai mã bí mật!' });
    }
    next();
};

// Endpoint Trigger (Đã bảo mật)
app.get('/trigger-news', authMiddleware, async (req, res) => {
    try {
        const count = await processNewsAndEmail();
        res.json({ status: 'success', message: `Đã gửi mail với ${count} danh mục tin.` });
    } catch (error) {
        console.error('❌ Lỗi hệ thống:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/', (req, res) => res.send('News Bot is Alive & Secure.'));

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});