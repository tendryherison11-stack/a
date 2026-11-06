const { Client } = require('discord.js-selfbot-v13');
const { firefox } = require('playwright'); // Menggunakan mesin Firefox asli bawaan Playwright
const path = require('path');

const client = new Client({ checkUpdate: false });

// ==================== KONFIGURASI ====================
const TOKEN = 'TOKEN_AKUN_TUMBAL_MU'; // Masukkan token akun tumbal Discord di sini
const GUILD_ID = 'ID_SERVER_DISCORD'; 
const VOICE_CHANNEL_ID = 'ID_VOICE_CHANNEL'; 
const PREFIX = '!';
// =====================================================

let browserContext, discordPage, youtubePage;
let queue = [];
let isPlaying = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms + Math.random() * 1000));

client.on('ready', async () => {
    console.log(`[Discord Bot] Logged in sebagai ${client.user.tag}`);
    
    // JEDA 30 DETIK SEBELUM MASUK VC
    console.log('[System] Bot Standby... Menunggu 30 detik sebelum membuka Firefox...');
    await new Promise(resolve => setTimeout(resolve, 30000)); 
    console.log('[System] Waktu tunggu selesai. Membuka Firefox...');

    const userDataDir = path.join(__dirname, 'firefox_user_data');

    // Launch Firefox dengan argumen bypass UI media share
    browserContext = await firefox.launchPersistentContext(userDataDir, {
        headless: false, // Wajib false agar terdeteksi render visual dan bisa memicu tombol Go Live
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        firefoxUserPrefs: {
            'media.navigator.permission.disabled': true, // Otomatis izinkan permission share screen di Firefox
            'media.navigator.streams.fake': true
        }
    });

    discordPage = await browserContext.newPage();
    
    // Langkah 1: Buka domain dasar Discord untuk mempersiapkan penyimpanan lokal Firefox
    console.log('[System] Membuka domain dasar Discord di Firefox...');
    await discordPage.goto('https://discord.com', { waitUntil: 'domcontentloaded' });
    
    // Langkah 2: Suntikkan Token langsung ke dalam LocalStorage Firefox (Bypass Halaman Login)
    console.log('[System] Menyuntikkan token akun tumbal ke Firefox...');
    await discordPage.evaluate((token) => {
        localStorage.setItem('token', `"${token}"`);
    }, TOKEN);

    await delay(3000); // Beri Firefox waktu 3 detik untuk mengunci data token ke storage

    // Langkah 3: Langsung menuju ke link Voice Channel tujuan (Otomatis posisi sudah Logged In)
    console.log('[System] Mengarahkan Firefox masuk ke Voice Channel...');
    await discordPage.goto(`https://discord.com{GUILD_ID}/${VOICE_CHANNEL_ID}`, { 
        waitUntil: 'networkidle',
        timeout: 60000 
    });

    console.log('\n=========================================');
    console.log('SUKSES: Firefox berhasil masuk tanpa melewati layar putih login!');
    console.log('Menunggu antrean 10 detik lagi sebelum sistem live aktif...');
    console.log('=========================================\n');

    await delay(10000);

    // Buka tab YouTube di Firefox
    youtubePage = await browserContext.newPage();
    await youtubePage.goto('https://youtube.com', { waitUntil: 'domcontentloaded' });
    
    console.log('[System] Sistem Siap! Gunakan !play di Discord.');
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const query = args.join(' ');
        if (!query) return message.reply('Masukkan URL YouTube atau judul video!');

        let targetUrl = query;
        if (!query.startsWith('http')) {
            targetUrl = `https://://youtube.com?search_query=${encodeURIComponent(query)}`;
        }

        queue.push(targetUrl);
        message.reply(`Menambahkan ke antrean Firefox. Posisi: ${queue.length}`);

        if (!isPlaying) {
            playNext(message);
        }
    }

    if (command === 'pause') {
        if (!isPlaying) return message.reply('Tidak ada video yang sedang diputar.');
        try {
            await youtubePage.bringToFront();
            await youtubePage.keyboard.press('k'); 
            message.reply('Video di-pause / di-resume pada Firefox.');
        } catch (e) {
            message.reply('Gagal mengontrol video.');
        }
    }

    if (command === 'skip') {
        if (!isPlaying) return message.reply('Antrean kosong.');
        message.reply('Skipping ke video berikutnya...');
        playNext(message);
    }
});

async function playNext(message) {
    if (queue.length === 0) {
        isPlaying = false;
        return message.channel.send('Antrean video telah habis.');
    }

    isPlaying = true;
    let currentVideo = queue.shift();

    try {
        await youtubePage.bringToFront();
        console.log(`[YouTube] Membuka: ${currentVideo}`);
        await youtubePage.goto(currentVideo, { waitUntil: 'domcontentloaded' });

        if (currentVideo.includes('://youtube.com')) {
            await youtubePage.waitForSelector('#video-title');
            await delay(2000); 
            await youtubePage.click('#video-title');
        }

        try {
            await youtubePage.click('button[aria-label="Accept the use of cookies and other data"]', { timeout: 2000 });
        } catch(e) {}

        // Pindah ke tab Discord di Firefox untuk klik Go Live fisik
        await discordPage.bringToFront();
        await delay(2000);

        const shareScreenBtn = await discordPage.$('[aria-label="Share Your Screen"], [data-list-item-id*="voice-channels"] button');
        if (shareScreenBtn) {
            await shareScreenBtn.click();
            console.log('[Discord] Go Live berhasil dipicu lewat klik fisik Firefox.');
        } else {
            console.log('[Discord] Tombol tidak ketemu. Pastikan akun sudah standby di dalam voice channel browser.');
        }

    } catch (error) {
        console.error(error);
        message.channel.send('Terjadi kendala saat memproses video di Firefox.');
        playNext(message);
    }
}

client.login(TOKEN);
