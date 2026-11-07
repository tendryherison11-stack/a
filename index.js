const express = require('express');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// Halaman utama Website Streaming kamu
app.get('/', (req, res) => {
    const currentVideoUrl = process.env.VIDEO_URL;

    if (!currentVideoUrl) {
        return res.send(`
            <body style="background:#111; color:#fff; text-align:center; font-family:sans-serif; padding-top:100px;">
                <h1>📺 Stasiun TV Bot Kamu Siap</h1>
                <p>Belum ada video yang diputar. Silakan masukkan link YouTube di menu Variables Railway dengan nama <b>VIDEO_URL</b>!</p>
            </body>
        `);
    }

    res.send(`
        <html lang="id">
        <head>
            <title>Go Live Stream</title>
            <style>
                body { margin: 0; background: #000; overflow: hidden; }
                video { width: 100vw; height: 100vh; object-fit: contain; }
            </style>
        </head>
        <body>
            <video id="player" controls autoplay playsinline style="width:100%; height:100%;">
                <source src="/stream-media" type="video/mp4">
                Browser kamu tidak mendukung video streaming.
            </video>
            <script>
                document.body.addEventListener('click', () => {
                    const v = document.getElementById('player');
                    if(v.muted) { v.muted = false; v.play(); }
                }, { once: true });
            </script>
        </body>
        </html>
    `);
});

// Jalur khusus menyedot video YouTube menggunakan engine distube yang kebal blokir
app.get('/stream-media', async (req, res) => {
    const currentVideoUrl = process.env.VIDEO_URL;
    if (!currentVideoUrl) return res.status(404).send('No video URL set');

    try {
        // Menggunakan opsi penyamaran cookies/agent agar Google tidak memblokir server Railway kamu
        const videoStream = ytdl(currentVideoUrl, {
            quality: 'highestvideo',
            filter: 'audioandvideo'
        });

        res.setHeader('Content-Type', 'video/mp4');
        videoStream.pipe(res);
    } catch (e) {
        console.error(e);
        res.status(500).send('Error streaming media');
    }
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Website Live aktif di Port: ${PORT}`);
    console.log(`==================================================`);
});
