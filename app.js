/**
 * SIMPEL v2.0 - Frontend Logic Presensi (GitHub Pages Version)
 */

let compressedBase64 = null;
let loadedFieldsConfig = [];

// Membaca konfigurasi terpusat dari config.js
const APP_CONFIG = window.SIMPEL_CONFIG || {};
const GAS_URL = APP_CONFIG.GAS_URL || "https://script.google.com/macros/s/AKfycbz2Cb6nwViSsfXEB3n82ow91ro5cR5FO-VMibBfJHcpbPFWHXj9t1bUATbqA9wi6pzK8A/exec";
const API_KEY = APP_CONFIG.API_KEY || "SIMPEL-V2-SECRET-KEY-2026";

let isAbsenSubmitting = false; // Pengunci Spam Click
let isSfxEnabled = true;
let audioCtx = null;

// Helper sanitasi HTML untuk mencegah XSS pada render dinamis
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- EFEK SUARA INTERAKSI (WEB AUDIO API - BEBAN 0 KB) ---
function togglePresensiSfx() {
    isSfxEnabled = !isSfxEnabled;
    const btn = document.getElementById('btnToggleSfx');
    if (btn) btn.textContent = isSfxEnabled ? '🔊' : '🔇';
}

function playPresensiSfx(type) {
    if (!isSfxEnabled) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'shutter') {
            // Efek klik kamera singkat
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.09);
        } else if (type === 'success') {
            // Nada konfirmasi dua tingkat (chime)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);       // D5
            osc.frequency.setValueAtTime(880, now + 0.11);    // A5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            osc.start(now);
            osc.stop(now + 0.32);
        } else if (type === 'error') {
            // Nada peringatan rendah
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(175, now + 0.12);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch (e) {
        // Abaikan jika browser membatasi AudioContext
    }
}

window.addEventListener('load', () => {
    initGeolocationPermission();
    loadDynamicForm();
    
    const emailInput = document.getElementById('emailInput');
    const badgeDisplay = document.getElementById('badgeEmailDisplay');
    if (emailInput && badgeDisplay) {
        emailInput.addEventListener('input', (e) => {
            badgeDisplay.textContent = e.target.value.trim() !== '' ? e.target.value.trim() : 'Masukkan Email';
        });
    } 
});

// Melakukan silent fetch koordinat GPS
function initGeolocationPermission() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const latEl = document.getElementById('geoLat');
                const lngEl = document.getElementById('geoLng');
                if (latEl) latEl.value = pos.coords.latitude;
                if (lngEl) lngEl.value = pos.coords.longitude;
            },
            (err) => {
                console.warn("Geolocation silent log:", err.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

// --- SISTEM KAMERA DIRECT IN-PAGE (ANTI POP-UP BLOCKER) ---
let videoStream = null;
let useFrontCamera = true;
let cameraTimer = null;

function updateCameraClock() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const clockEl = document.getElementById('kameraClock');
    if (clockEl) clockEl.innerText = dateStr + ' ' + timeStr + ' WIB';
}

async function openDirectCameraWindow() {
    const namaInputElem = document.getElementById('nama');
    if (!namaInputElem || namaInputElem.value.trim() === '') {
        showPopupModal(false, "Lengkapi Data", "Silakan isi 'Nama Lengkap' terlebih dahulu sebelum mengambil foto presensi.");
        return;
    }

    document.getElementById('watermarkNama').innerText = "👤 " + namaInputElem.value.trim().toUpperCase();
    document.getElementById('cameraModal').classList.remove('hidden');
    
    startCameraStream();
    updateCameraClock();
    cameraTimer = setInterval(updateCameraClock, 1000);
}

async function startCameraStream() {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    const videoEl = document.getElementById('kameraVideo');
    if (videoEl) {
        if (useFrontCamera) {
            videoEl.classList.add('mirror-video');
        } else {
            videoEl.classList.remove('mirror-video');
        }
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: useFrontCamera ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoEl) videoEl.srcObject = videoStream;
    } catch (e) {
        closeCameraModal();
        showPopupModal(false, "Kamera Ditolak", "Gagal mengakses kamera. Pastikan izin kamera telah diberikan pada browser Anda.\nError: " + e.message);
    }
}

function switchCamera() {
    useFrontCamera = !useFrontCamera;
    startCameraStream();
}

function snapCamera() {
    const v = document.getElementById('kameraVideo');
    const c = document.getElementById('kameraCanvas');
    const ctx = c.getContext('2d');

    playPresensiSfx('shutter');

    // Perkecil dimensi maksimal ke 800px agar pengiriman cepat & anti-timeout
    const maxDimension = 800;
    let width = v.videoWidth || 640;
    let height = v.videoHeight || 480;

    if (width > height) {
        if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
        }
    } else {
        if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
        }
    }

    c.width = width;
    c.height = height;
    
    // Mirror canvas jika pakai kamera depan agar teks watermark tidak terbalik
    if (useFrontCamera) {
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    
    // Kembalikan orientasi canvas untuk menulis teks Watermark
    if (useFrontCamera) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const namaMahasiswa = document.getElementById('nama').value.trim().toUpperCase();
    const line1 = "👤 " + namaMahasiswa;
    const line2 = "📌 PRESENSI: " + dateStr + " " + timeStr + " WIB";
    
    const padding = 14;
    const fontSize = Math.max(12, Math.round(c.width * 0.032));
    ctx.font = "bold " + fontSize + "px sans-serif";
    
    const maxTextWidth = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);
    const boxHeight = (fontSize * 2.5) + 18;
    const boxY = c.height - boxHeight - padding - 12; 
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(padding, boxY, Math.min(maxTextWidth + 28, c.width - (padding * 2)), boxHeight, 10);
    } else {
        ctx.rect(padding, boxY, Math.min(maxTextWidth + 28, c.width - (padding * 2)), boxHeight);
    }
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line1, padding + 14, boxY + fontSize + 6);
    ctx.fillStyle = "#10b981";
    ctx.fillText(line2, padding + 14, boxY + (fontSize * 2) + 12);
    
    compressedBase64 = c.toDataURL('image/jpeg', 0.65);
    const approxKb = Math.round((compressedBase64.length * 3) / 4 / 1024);
    
    document.getElementById('previewContainer').classList.remove('hidden');
    document.getElementById('imagePreview').src = compressedBase64;
    document.getElementById('sizeInfo').innerText = `Kamera Direct • Watermark Aktif (~${approxKb} KB)`;
    
    closeCameraModal();
}

function closeCameraModal() {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    if (cameraTimer) clearInterval(cameraTimer);
    document.getElementById('cameraModal').classList.add('hidden');
}

// --- LOAD STRUKTUR FORM DINAMIS DARI GAS ---
async function loadDynamicForm() {
    const container = document.getElementById('dynamicFormContainer');
    
    // 1. Cek cache konfigurasi tersimpan di browser agar langsung tampil instan
    const cachedConfig = localStorage.getItem('simpel_form_config_cache');
    if (cachedConfig) {
        try {
            loadedFieldsConfig = JSON.parse(cachedConfig);
            renderFormFields(loadedFieldsConfig);
        } catch (e) {
            console.warn("Gagal parse cache form:", e);
        }
    }

    try {
        // 2. Cek status form terlebih dahulu
        const statusRes = await fetch(GAS_URL + "?action=getFormStatus")
            .then(res => res.json())
            .catch(() => ({ status: 'BUKA' }));
        
        if (statusRes && statusRes.status === 'TUTUP') {
            const attendanceFormEl = document.getElementById('attendanceForm');
            if (attendanceFormEl) {
                attendanceFormEl.innerHTML = `
                    <div class="py-12 px-4 text-center space-y-4">
                        <div class="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-3xl mx-auto flex items-center justify-center text-3xl border border-amber-200">🔒</div>
                        <h2 class="text-lg font-extrabold text-slate-800">Presensi Telah Ditutup</h2>
                        <p class="text-xs text-slate-600 bg-amber-50/80 border border-amber-200/70 p-4 rounded-2xl leading-relaxed">
                            ${escapeHtml(statusRes.message || 'Mohon maaf, pengisian form presensi perkuliahan saat ini sedang ditutup oleh admin.')}
                        </p>
                    </div>`;
            }
            return;
        }

        // 3. Ambil konfigurasi form terbaru dari Google Apps Script
        const configRes = await fetch(GAS_URL + "?action=getFormConfiguration").then(res => res.json());
        
        if (configRes && configRes.status === 'success' && configRes.fields && configRes.fields.length > 0) {
            loadedFieldsConfig = configRes.fields;
            localStorage.setItem('simpel_form_config_cache', JSON.stringify(loadedFieldsConfig));
            renderFormFields(loadedFieldsConfig);
        } else if (!cachedConfig && container) {
            container.innerHTML = '<p class="text-rose-500 text-center text-xs font-semibold py-4">Gagal memuat struktur form.</p>';
        }
    } catch (e) {
        console.error(e);
        if (!cachedConfig && container) {
            container.innerHTML = '<p class="text-rose-500 text-center text-xs font-semibold py-4">Gagal terhubung ke server Google.</p>';
        }
    }
}

// Render Elemen Form Dinamis ke DOM
function renderFormFields(fields) {
    const container = document.getElementById('dynamicFormContainer');
    if (!container) return;
    const filteredFields = fields.filter(f => f.name !== 'email' && f.name !== 'emailInput');

    container.innerHTML = filteredFields.map(f => {
        let fieldHtml = '';
        const safeName = escapeHtml(f.name);
        const safeLabel = escapeHtml(f.label);
        const reqTag = f.required ? '<span class="text-rose-500">*</span>' : '';
        const reqAttr = f.required ? 'required' : '';

        if (f.name === 'mood' || f.type === 'mood') {
            const emojiMap = {
                "Sangat Bersemangat": { icon: "🔥", label: "Semangat" },
                "Senang / Ceria": { icon: "😊", label: "Senang" },
                "Biasa Saja": { icon: "😐", label: "Biasa" },
                "Lelah / Mengantuk": { icon: "😴", label: "Lelah" },
                "Stres / Cemas": { icon: "🤯", label: "Stres" }
            };

            fieldHtml = `
                <div class="grid grid-cols-5 gap-1.5 sm:gap-2 text-center pt-1">
                    ${(f.options || []).map(opt => {
                        const emo = emojiMap[opt] || { icon: "😃", label: opt };
                        const safeOpt = escapeHtml(opt);
                        return `
                            <label class="cursor-pointer">
                                <input type="radio" name="${safeName}" value="${safeOpt}" ${reqAttr} class="peer sr-only">
                                <div class="p-2 sm:p-2.5 rounded-2xl border border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/80 hover:bg-slate-50 flex flex-col items-center justify-center transition-all shadow-sm">
                                    <span class="text-2xl sm:text-3xl block mb-1">${emo.icon}</span>
                                    <span class="text-[9px] sm:text-[10px] font-extrabold text-slate-600 block truncate w-full">${escapeHtml(emo.label)}</span>
                                </div>
                            </label>`;
                    }).join('')}
                </div>`;
        } else if (f.type === 'select') {
            fieldHtml = `
                <input type="hidden" id="${safeName}" name="${safeName}" ${reqAttr} value="">
                <button type="button" onclick="openSelectModal('${safeName}')"
                    id="trigger_${safeName}"
                    class="w-full text-left px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 text-xs sm:text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 flex justify-between items-center transition-all">
                    <span id="label_display_${safeName}">-- Pilih ${safeLabel} --</span>
                    <span class="text-indigo-600 font-bold text-xs">▼</span>
                </button>`;
        } else if (f.type === 'radio') {
            fieldHtml = `
                <div class="flex flex-wrap gap-2.5 pt-1">
                    ${(f.options || []).map(opt => {
                        const safeOpt = escapeHtml(opt);
                        return `
                        <label class="flex items-center text-xs cursor-pointer bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 transition-all">
                            <input type="radio" name="${safeName}" value="${safeOpt}" ${reqAttr} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                            <span class="ml-2 text-slate-700 font-bold">${safeOpt}</span>
                        </label>`;
                    }).join('')}
                </div>`;
        } else {
            const isNamaField = f.name === 'nama';
            const uppercaseClass = isNamaField ? 'uppercase' : '';
            const onInputAttr = isNamaField ? 'oninput="this.value = this.value.toUpperCase()"' : '';

            fieldHtml = `
                <input type="text" id="${safeName}" name="${safeName}" ${reqAttr} ${onInputAttr} placeholder="${safeLabel}"
                    class="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs sm:text-sm bg-slate-50/70 hover:bg-slate-50 transition-all font-medium text-slate-800 placeholder:text-slate-400 ${uppercaseClass}" />`;
        }

        return `
            <div>
                <label class="block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">${safeLabel} ${reqTag}</label>
                ${fieldHtml}
            </div>`;
    }).join('');
}

// --- DROPDOWN MODAL CONTROL ---
function openSelectModal(fieldName) {
    const field = loadedFieldsConfig.find(item => item.name === fieldName);
    if (!field) return;

    document.getElementById('selectModalTitle').innerText = 'Pilih ' + field.label;
    const optionsContainer = document.getElementById('selectModalOptions');
    optionsContainer.innerHTML = '';

    (field.options || []).forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left p-3.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all';
        btn.textContent = opt;
        btn.onclick = () => selectOptionValue(fieldName, opt);
        optionsContainer.appendChild(btn);
    });

    document.getElementById('customSelectModal').classList.remove('hidden');
}

function selectOptionValue(fieldName, val) {
    const hiddenEl = document.getElementById(fieldName);
    if (hiddenEl) hiddenEl.value = val;

    const labelDisplay = document.getElementById('label_display_' + fieldName);
    if (labelDisplay) {
        labelDisplay.innerText = val;
        labelDisplay.className = "text-slate-800 font-bold";
    }
    closeSelectModal();
}

function closeSelectModal() {
    document.getElementById('customSelectModal').classList.add('hidden');
}

function resetDynamicSelects() {
    if (loadedFieldsConfig && loadedFieldsConfig.length > 0) {
        loadedFieldsConfig.forEach(f => {
            if (f.type === 'select') {
                const hiddenElem = document.getElementById(f.name);
                if (hiddenElem) hiddenElem.value = '';

                const labelDisplay = document.getElementById('label_display_' + f.name);
                if (labelDisplay) {
                    labelDisplay.innerText = `-- Pilih ${f.label} --`;
                    labelDisplay.className = "text-slate-500 font-normal";
                }
            }
        });
    }
}

// --- KOMPRESI FOTO (GALERI) ---
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const maxDimension = 800;
            let width = img.width, height = img.height;

            if (width > height) {
                if (width > maxDimension) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
            } else {
                if (height > maxDimension) { width = Math.round((width * maxDimension) / height); height = maxDimension; }
            }

            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
            const approxKb = Math.round((compressedBase64.length * 3) / 4 / 1024);

            document.getElementById('previewContainer').classList.remove('hidden');
            document.getElementById('imagePreview').src = compressedBase64;
            document.getElementById('sizeInfo').innerText = `Berkas galeri terkompresi (~${approxKb} KB)`;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// --- MODAL POPUP RESULTS ---
function showPopupModal(isSuccess, title, message, targetEmail) {
    playPresensiSfx(isSuccess ? 'success' : 'error');

    const iconContainer = document.getElementById('modalIconContainer');
    const icon = document.getElementById('modalIcon');
    const closeBtn = document.getElementById('modalCloseBtn');
    const msgElem = document.getElementById('modalMessage');

    if (isSuccess) {
        iconContainer.className = "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3.5 bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-inner";
        icon.innerText = "✓";
        closeBtn.className = "w-full mt-6 py-3.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 focus:outline-none";

        let content = `<p class="font-bold text-slate-700 text-center text-sm">${escapeHtml(message)}</p>`;
        if (targetEmail) {
            content += `
                <div class="mt-3.5 p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-left flex items-start space-x-3">
                    <span class="text-xl leading-none">📧</span>
                    <div>
                        <p class="font-extrabold text-indigo-950 text-xs">Konfirmasi Email Terkirim!</p>
                        <p class="text-[11px] text-indigo-800 leading-normal mt-0.5">
                            Bukti sah presensi telah dikirimkan ke alamat email Anda: <br><strong class="underline">${escapeHtml(targetEmail)}</strong>.
                        </p>
                    </div>
                </div>`;
        }
        msgElem.innerHTML = content;

    } else {
        iconContainer.className = "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3.5 bg-rose-100 text-rose-600 border border-rose-200 shadow-inner";
        icon.innerText = "✕";
        closeBtn.className = "w-full mt-6 py-3.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/30 focus:outline-none";
        msgElem.innerHTML = `<p class="text-slate-600 text-center font-medium">${escapeHtml(message)}</p>`;
    }

    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalAlert').classList.remove('hidden');
}

function closePopupModal() {
    document.getElementById('modalAlert').classList.add('hidden');
}

// --- SUBMIT HANDLER KE BACKEND GAS (DENGAN TIMEOUT SAFETY) ---
async function handleFormSubmit(e) {
    e.preventDefault();

    if (isAbsenSubmitting) return; 
    
    const emailInputVal = document.getElementById('emailInput') ? document.getElementById('emailInput').value.trim() : '';
    const npmVal = document.getElementById('npm') ? document.getElementById('npm').value.trim() : '';
    const namaVal = document.getElementById('nama') ? document.getElementById('nama').value.trim().toUpperCase() : '';

    if (!emailInputVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInputVal)) {
        showPopupModal(false, "Email Tidak Valid", "Pastikan penulisan format email sudah benar.");
        return;
    }
    if (!npmVal || !/^\d{8,15}$/.test(npmVal)) {
        showPopupModal(false, "NPM Tidak Valid", "NPM harus terdiri dari 8 hingga 15 digit angka.");
        return;
    }
    if (!namaVal) {
        showPopupModal(false, "Nama Lengkap Wajib Isi", "Silakan ketikkan nama lengkap Anda.");
        return;
    }
    if (!compressedBase64) {
        showPopupModal(false, "Foto Belum Ada", "Silakan unggah atau ambil foto bukti kehadiran.");
        return;
    }

    isAbsenSubmitting = true;

    const btn = document.getElementById('btnSubmit');
    if (btn) btn.disabled = true;
    const btnText = document.getElementById('btnText');
    if (btnText) btnText.textContent = "Mengirim Data...";
    const btnSpinner = document.getElementById('btnSpinner');
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    const latVal = document.getElementById('geoLat') ? document.getElementById('geoLat').value : '';
    const lngVal = document.getElementById('geoLng') ? document.getElementById('geoLng').value : '';

    const payload = {
        apiKey: API_KEY,
        userEmail: emailInputVal,
        email: emailInputVal,
        npm: npmVal,
        nama: namaVal,
        lat: latVal,
        lng: lngVal,
        fotoBase64: compressedBase64
    };

    if (loadedFieldsConfig && loadedFieldsConfig.length > 0) {
        loadedFieldsConfig.forEach(f => {
            if (f.name !== 'email' && f.name !== 'emailInput' && f.name !== 'npm' && f.name !== 'nama') {
                if (f.type === 'radio' || f.type === 'mood') {
                    const selectedRadio = document.querySelector(`input[name="${f.name}"]:checked`);
                    payload[f.name] = selectedRadio ? selectedRadio.value : '';
                } else {
                    const fieldElem = document.getElementById(f.name);
                    payload[f.name] = fieldElem ? fieldElem.value : '';
                }
            }
        });
    }

    // TIMEOUT SAFETY 20 DETIK
    let isTimeout = false;
    let timer = setTimeout(() => {
        isTimeout = true;
        isAbsenSubmitting = false;
        
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = "Kirim Presensi Kehadiran";
        if (btnSpinner) btnSpinner.classList.add('hidden');

        showPopupModal(false, "Antrean Penuh / Koneksi Lambat", "Server sedang memproses antrean absensi mahasiswa lain. Jangan tutup halaman ini, silakan tekan tombol kirim kembali.");
    }, 20000);

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        if (isTimeout) return; 
        clearTimeout(timer);
        
        isAbsenSubmitting = false;
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = "Kirim Presensi Kehadiran";
        if (btnSpinner) btnSpinner.classList.add('hidden');

        const result = await response.json();

        if (result.status === 'success') {
            showPopupModal(true, "Presensi Berhasil!", result.message || "Data presensi Anda berhasil disimpan.", emailInputVal);
            
            try {
                const formObj = document.getElementById('attendanceForm');
                if (formObj && typeof formObj.reset === 'function') {
                    formObj.reset();
                }
            } catch (resetErr) {
                console.warn("Peringatan: Gagal mereset input form", resetErr);
            }
            
            resetDynamicSelects();

            // Reset badge email dan input file galeri
            const badgeDisplay = document.getElementById('badgeEmailDisplay');
            if (badgeDisplay) badgeDisplay.textContent = 'Masukkan Email';

            const fileGaleriInput = document.getElementById('fotoFileGaleri');
            if (fileGaleriInput) fileGaleriInput.value = '';

            const previewContainer = document.getElementById('previewContainer');
            if (previewContainer) previewContainer.classList.add('hidden');
            compressedBase64 = null;

        } else {
            showPopupModal(false, "Gagal Disimpan", result.message || "Ditolak oleh server.");
        }

    } catch (err) {
        if (isTimeout) return;
        clearTimeout(timer);
        isAbsenSubmitting = false;

        console.error(err);
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = "Kirim Presensi Kehadiran";
        if (btnSpinner) btnSpinner.classList.add('hidden');
        
        showPopupModal(false, "Terjadi Kesalahan", err.message || "Gagal terhubung ke server.");
    }
}