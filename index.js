const { Client } = require('discord.js-selfbot-v13');
const { firefox } = require('playwright'); // 🔄 DIUBAH: Menggunakan browser Firefox internal

// Inisialisasi Akun Tumbal dengan Fitur Anti-Ban (Spoofing)
const client = new Client({
    checkUpdate: false,
    patchVoice: true, // Wajib aktif agar akun bisa mengirim data audio/video WebRTC
    ws: {
        properties: {
            $os: 'Windows',
            $browser: 'Discord Client',
            $release_channel: 'stable',
            $client_version: '1.0.9001',
            $os_version: '10',
            $client_build_number: 160000,
        }
    }
});

// Konfigurasi Bot
const TOKEN = "MASUKKAN_TOKEN_AKUN_TUMBAL_DISINI"; 
const PREFIX = "!";

// Menyimpan instance browser dan status stream
let browserInstance = null;
let pageInstance = null;
let currentStream = null;

client.on('ready', () => {
    console.log(`🦊 Theater Browser Bot (Firefox) aktif menggunakan akun: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ================================================
    // 1. PERINTAH !PLAY (Membuka YouTube di Firefox & Go Live)
    // ================================================
    if (command === 'play') {
        const youtubeUrl = args;
        if (!youtubeUrl) return message.reply("⚠️ Masukkan link YouTube! Contoh: `!play https://youtube.com`");

        const voiceChannel = message.member?.voice.channel;
        if (!voiceChannel) return message.reply("⚠️ Anda harus berada di Voice Channel terlebih dahulu!");

        message.reply("🎬 Menyiapkan Firefox internal, membuka YouTube, dan memulai Go Live...");

        try {
            // Jika ada browser lama yang masih menyala, tutup dulu
            if (browserInstance) await browserInstance.close();

            // Meluncurkan browser Firefox bawaan otomatis
            browserInstance = await firefox.launch({
                headless: false, // Wajib false agar browser memproses visual & suara video
                args: [
                    '--autoplay-policy=no-user-gesture-required' // Memaksa YouTube langsung putar suara otomatis di Firefox
                ]
            });

            // Membuka tab baru dan pergi ke link YouTube
            pageInstance = await browserInstance.newPage();
            await pageInstance.goto(youtubeUrl, { waitUntil: 'load' });

            // Akun tumbal masuk ke Voice Channel
            const connection = await voiceChannel.join();

            // MEMULAI GO LIVE: Menangkap layar dari aplikasi browser internal Firefox
            currentStream = await connection.createStreamScreen({
                source: 'firefox', // 🔄 DIUBAH: Mengkunci target share screen ke jendela Firefox
                fps: 30,
                bitrate: 2500 * 1000,
                type: "video",
                audio: true // Wajib true agar suara dari tab Firefox ikut masuk ke Discord
            });

            message.channel.send(`📺 **Theater Go Live Dimulai!** \nMenonton bersama melalui Firefox.`);

        } catch (error) {
            console.error("Gagal membuka theater lewat Firefox:", error);
            message.reply("⚠️ Terjadi kesalahan saat mencoba membuka browser Firefox internal.");
        }
    }

    // ================================================
    // 2. PERINTAH !PAUSE & !RESUME (Kontrol Tombol Spasi YouTube)
    // ================================================
    if (command === 'pause' || command === 'resume') {
        if (!pageInstance) return message.reply("❌ Tidak ada theater browser yang sedang berjalan.");
        
        try {
            // Mengirim perintah tekan tombol 'Spacebar' (Spasi) langsung ke halaman web YouTube di Firefox
            await pageInstance.keyboard.press('Space');
            message.reply(command === 'pause' ? "⏸️ Theater di-pause." : "▶️ Theater dilanjutkan.");
        } catch (err) {
            message.reply("⚠️ Gagal mengontrol pemutar video.");
        }
    }

    // ================================================
    // 3. PERINTAH !STOP
    // ================================================
    if (command === 'stop') {
        if (!browserInstance) return message.reply("❌ Tidak ada theater yang sedang berjalan.");

        try {
            await browserInstance.close(); // Otomatis menutup tab browser Firefox
            browserInstance = null;
            pageInstance = null;

            const currentVoice = message.guild.me.voice.channel;
            if (currentVoice) currentVoice.leave(); // Bot keluar dari Voice Channel

            message.reply("🛑 Theater dihentikan dan Firefox telah ditutup.");
        } catch (err) {
            message.reply("⚠️ Gagal menghentikan theater.");
        }
    }
});

client.login(TOKEN);
