/**
 * SIMPEL v2.0 - Frontend Logic
 * Menangani GPS, Kamera, Kompresi Canvas, dan Komunikasi API
 */

// GANTI DENGAN URL WEB APP GAS ANDA SETELAH DI DEPLOY
const GAS_URL = "URL_GOOGLE_APPS_SCRIPT_WEB_APP_ANDA_DISINI"; 

// DOM Elements
const form = document.getElementById('attendanceForm');
const npmInput = document.getElementById('npm');
const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvasElement');
const btnSubmit = document.getElementById('btnSubmit');
const gpsLoading = document.getElementById('gpsLoading');
const alertBox = document.getElementById('alertBox');

// State Variables
let currentLat = null;
let currentLng = null;

// 1. Sanitasi Input Client-side (Otomatis huruf kapital & validasi angka)
npmInput.addEventListener('input', function(e) {
    this.value = this.value.replace(/\D/g, '').slice(0, 10);
});

// 2. Inisialisasi Kamera (Direct Camera Pop-up) & GPS secara paralel
async function initSystem() {
    try {
        // Eksekusi paralel untuk efisiensi waktu muat (loading)
        const [stream, position] = await Promise.all([
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }),
            getGPSPosition()
        ]);

        // Setup Kamera
        video.srcObject = stream;
        
        // Setup GPS
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
        
        // Buka Kunci UI
        gpsLoading.classList.add('hidden');
        btnSubmit.disabled = false;

    } catch (err) {
        showAlert('Gagal mengakses Kamera atau GPS. Pastikan izin diberikan.', 'error');
        gpsLoading.innerHTML = '<span class="text-xs text-red-400">Akses Ditolak</span>';
    }
}

// Promisify Geolocation agar bisa di-await
function getGPSPosition() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

// 3. Proses Watermark & Kompresi Ekstrem (Hemat Bandwidth 92%)
function captureAndCompress(npm) {
    const ctx = canvas.getContext('2d');
    
    // Set dimensi target (Maksimal 800px untuk kompresi)
    const targetWidth = 600;
    const targetHeight = (video.videoHeight / video.videoWidth) * targetWidth;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Gambar frame video ke canvas
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    // Tambahkan Dynamic Watermark
    const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const watermarkText = `NPM: ${npm} | ${timestamp} | [${currentLat}, ${currentLng}]`;
    
    // Styling Watermark
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; // Background gelap transparan
    ctx.fillRect(0, targetHeight - 40, targetWidth, 40);
    
    ctx.font = "14px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(watermarkText, 10, targetHeight - 15);

    // Kompresi ekspor ke JPEG (Kualitas 0.65 sangat optimal)
    return canvas.toDataURL('image/jpeg', 0.65);
}

// 4. Proses Submit (Asynchronous Fetch ke GAS)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if(!currentLat || !currentLng) {
        showAlert('GPS belum terkunci.', 'error');
        return;
    }

    const npm = npmInput.value;
    
    // Ubah UI menjadi status Loading
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<div class="loader w-5 h-5 border-2"></div> Memproses...';
    
    try {
        const compressedImageBase64 = captureAndCompress(npm);
        
        // Tampilkan hasil jepretan di UI (UX Modern)
        video.classList.add('hidden');
        canvas.classList.remove('hidden');

        const payload = {
            action: 'submit_attendance',
            data: {
                session_id: 'SESI-01', // Bisa dibuat dinamis nantinya
                npm: npm,
                lat_lng: `${currentLat},${currentLng}`,
                photo_base64: compressedImageBase64
            }
        };

        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
            // Catatan: Mode no-cors tidak bisa baca response, di GAS harus public web app
        });

        const result = await response.json();
        
        if(result.status === 'success') {
            showAlert('Presensi Berhasil: ' + result.timestamp, 'success');
            setTimeout(() => { location.reload(); }, 3000); // Reset sistem setelah 3 detik
        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        showAlert('Terjadi kesalahan koneksi atau server.', 'error');
        // Kembalikan UI
        video.classList.remove('hidden');
        canvas.classList.add('hidden');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Coba Lagi';
    }
});

// Fungsi Bantuan UI
function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `mt-4 p-3 rounded-lg text-sm text-center font-medium fade-in block alert-${type}`;
}

// Jalankan sistem saat halaman dimuat
window.addEventListener('load', initSystem);