const { Client } = require('discord.js-selfbot-v13');
const { DiscordStreamClient } = require('discord-stream-client');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');

const client = new Client({ checkUpdate: false });
const StreamClient = new DiscordStreamClient(client);

// Set kualitas video Go Live (720p/1080p aman untuk VPS kecil)
StreamClient.setResolution('720p');

// ==================== KONFIGURASI ====================
const TOKEN = 'TOKEN_AKUN_TUMBAL_MU'; 
const GUILD_ID = 'ID_SERVER_DISCORD'; 
const VOICE_CHANNEL_ID = 'ID_VOICE_CHANNEL'; 
const PREFIX = '!';
// =====================================================

let queue = [];
let isPlaying = false;
let currentUdpConnection = null;

client.on('ready', async () => {
    console.log(`[Discord Bot] Logged in sebagai ${client.user.tag}`);
    
    // JEDA 30 DETIK SEBELUM SIAP (Mencegah rate limit/at risk di awal)
    console.log('[System] Bot Standby... Menunggu 30 detik sebelum mengaktifkan voice engine...');
    await new Promise(resolve => setTimeout(resolve, 30000)); 
    console.log('[System] Sistem Siap! Gunakan perintah !play <link_youtube> di text channel.');
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const query = args.join(' ');
        if (!query) return message.reply('Masukkan URL YouTube penuh!');
        if (!query.startsWith('http')) return message.reply('Harap masukkan URL YouTube tautan penuh (https://...)');

        queue.push(query);
        message.reply(`Menambahkan video ke antrean Go Live. Posisi: ${queue.length}`);

        if (!isPlaying) {
            playNext(message);
        }
    }

    if (command === 'pause') {
        if (!isPlaying || !currentUdpConnection) return message.reply('Tidak ada streaming yang berjalan.');
        
        // Memanfaatkan kontrol pause internal pada stream connection gateway
        if (currentUdpConnection.mediaConnection.isPaused()) {
            currentUdpConnection.mediaConnection.resume();
            message.reply('Video Go Live dilanjutkan.');
        } else {
            currentUdpConnection.mediaConnection.pause();
            message.reply('Video Go Live di-pause.');
        }
    }

    if (command === 'skip') {
        if (!isPlaying) return message.reply('Antrean kosong.');
        message.reply('Skipping ke video berikutnya...');
        if (currentUdpConnection) {
            currentUdpConnection.stopStream(); // Menghentikan stream aktif untuk memicu antrean baru
        }
    }
});

async function playNext(message) {
    if (queue.length === 0) {
        isPlaying = false;
        if (currentUdpConnection) {
            currentUdpConnection.disconnect();
        }
        return message.channel.send('Antrean streaming video telah habis.');
    }

    isPlaying = true;
    let currentVideoUrl = queue.shift();

    try {
        message.channel.send(`Memulai koneksi voice dan memproses Go Live...`);

        // Akun tumbal otomatis join voice channel via API backend resmi
        const voiceConnection = await StreamClient.joinVoice(GUILD_ID, VOICE_CHANNEL_ID);
        
        // Membuat sesi penayangan Go Live / Screenshare
        currentUdpConnection = await voiceConnection.createStream();
        
        console.log('[Discord API] Lencana GO LIVE aktif pada akun tumbal.');
        message.channel.send(`Akun tumbal sekarang sedang **GO LIVE** memutar video tersebut!`);

        // Mengambil kombo audio + video berformat mp4/webm terbaik secara efisien
        const videoReadableStream = ytdl(currentVideoUrl, {
            quality: 'highest',
            filter: format => format.container === 'mp4' && format.hasAudio && format.hasVideo
        });

        // Menembakkan media stream langsung melalui jalur UDP Discord dengan decoder FFmpeg internal
        currentUdpConnection.mediaConnection.setSpeaking(true);
        currentUdpConnection.mediaConnection.setVideoStatus(true);

        // Memasang file/stream ke engine
        currentUdpConnection.playMP4(videoReadableStream, ffmpeg);

        // Jika durasi video habis, otomatis lompat ke antrean selanjutnya
        currentUdpConnection.mediaConnection.on('finish', () => {
            console.log('[System] Video selesai diputar.');
            playNext(message);
        });

    } catch (error) {
        console.error(error);
        message.channel.send('Terjadi kendala teknis saat menyiarkan video Go Live.');
        isPlaying = false;
        playNext(message);
    }
}

client.login(TOKEN);
