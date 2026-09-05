/**
 * SIMPEL v2.0 - Frontend Logic (GitHub Pages Version)
 * Menangani Form Dinamis, GPS, Kamera Watermark, Kompresi, dan Komunikasi API ke GAS
 */

// GANTI DENGAN URL WEB APP GAS ANDA YANG AKTIF
const GAS_URL = "https://script.google.com/macros/s/AKfycbwQkdIAQXiWgFB7yiQo6qjGl6O_xYg1WUQ_Uz1NRbNKScQUvdC33veEuInC7X9-74b3TA/exec"; 

let compressedBase64 = null;
let loadedFieldsConfig = [];

// Mendengarkan hasil foto dari window kamera pop-up direct
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'CAMERA_CAPTURED') {
        compressedBase64 = event.data.base64;
        document.getElementById('previewContainer').classList.remove('hidden');
        document.getElementById('imagePreview').src = compressedBase64;
        document.getElementById('sizeInfo').innerText = `Kamera Direct (Watermark Nama & Waktu Aktif)`;
    }
});

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
                document.getElementById('geoLat').value = pos.coords.latitude;
                document.getElementById('geoLng').value = pos.coords.longitude;
            },
            (err) => {
                console.warn("Geolocation silent log:", err.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }
}

// --- MEMBUKA KAMERA DIRECT POP-UP ---
function openDirectCameraWindow() {
    const namaInputElem = document.getElementById('nama');
    const studentName = namaInputElem && namaInputElem.value.trim() !== '' 
        ? namaInputElem.value.trim().toUpperCase() 
        : 'MAHASISWA';

    const cameraHtml = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
            <title>Ambil Foto Presensi</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-950 text-white min-h-screen flex flex-col justify-between p-4 font-sans select-none">
            <div class="flex justify-between items-center text-white pt-2 max-w-md mx-auto w-full">
                <h3 class="font-bold text-sm tracking-wide">Kamera Presensi</h3>
                <button onclick="window.close()" class="bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 text-xs transition-all">✕ Batal</button>
            </div>
            
            <div class="relative w-full max-w-md mx-auto my-auto rounded-3xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center border border-white/10 shadow-2xl">
                <video id="v" autoplay playsinline class="w-full h-full object-cover"></video>
                
                <!-- OVERLAY WATERMARK NAMA & WAKTU REAL-TIME -->
                <div id="timeOverlay" class="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md p-3 rounded-2xl text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                    <div class="font-bold text-white truncate mb-0.5 text-xs">👤 ${studentName}</div>
                    <div class="text-emerald-400">📌 PRESENSI REALTIME</div>
                    <div class="text-slate-300">🕒 <span id="clockDisplay">--:--:--</span></div>
                </div>
                
                <canvas id="c" class="hidden"></canvas>
            </div>
            
            <div class="w-full max-w-md mx-auto pb-4 flex justify-center items-center gap-6">
                <button onclick="switchCam()" class="p-3 bg-white/10 text-white rounded-full text-lg active:scale-90 transition-all">🔄</button>
                <button onclick="snap()" class="w-16 h-16 bg-white border-4 border-indigo-600 rounded-full shadow-lg active:scale-95 flex items-center justify-center transition-all">
                    <span class="w-12 h-12 bg-indigo-600 rounded-full block"></span>
                </button>
            </div>

            <script>
                let stream = null;
                let useFront = true;
                let timerInterval = null;
                const currentStudentName = "${studentName.replace(/"/g, '\\"').replace(/'/g, "\\'")}";

                function updateClock() {
                    const now = new Date();
                    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    document.getElementById('clockDisplay').innerText = dateStr + ' ' + timeStr + ' WIB';
                }
                
                async function start() {
                    if(stream) stream.getTracks().forEach(t => t.stop());
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: useFront ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                        });
                        document.getElementById('v').srcObject = stream;
                    } catch(e) {
                        alert("Gagal membuka kamera: " + e.message + "\\nPastikan izin kamera diizinkan pada browser Anda.");
                    }
                }
                
                function switchCam() {
                    useFront = !useFront;
                    start();
                }
                
                function snap() {
                    const v = document.getElementById('v');
                    const c = document.getElementById('c');
                    const ctx = c.getContext('2d');
                    
                    c.width = v.videoWidth || 640;
                    c.height = v.videoHeight || 480;
                    
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                    
                    const now = new Date();
                    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    const line1 = "👤 " + currentStudentName;
                    const line2 = "📌 PRESENSI: " + dateStr + " " + timeStr + " WIB";
                    
                    const padding = 16;
                    const fontSize = Math.round(c.width * 0.035);
                    ctx.font = "bold " + fontSize + "px sans-serif";
                    
                    const textWidth1 = ctx.measureText(line1).width;
                    const textWidth2 = ctx.measureText(line2).width;
                    const maxTextWidth = Math.max(textWidth1, textWidth2);
                    
                    const boxHeight = (fontSize * 2.5) + 20;
                    const boxY = c.height - boxHeight - padding;
                    
                    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
                    ctx.fillRect(padding, boxY, maxTextWidth + 24, boxHeight);
                    
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(line1, padding + 12, boxY + fontSize + 6);
                    
                    ctx.fillStyle = "#10b981";
                    ctx.fillText(line2, padding + 12, boxY + (fontSize * 2) + 12);
                    
                    const b64 = c.toDataURL('image/jpeg', 0.65);
                    
                    if (window.opener) {
                        window.opener.postMessage({ type: 'CAMERA_CAPTURED', base64: b64 }, '*');
                    }
                    if(stream) stream.getTracks().forEach(t => t.stop());
                    if(timerInterval) clearInterval(timerInterval);
                    window.close();
                }
                
                window.onload = function() {
                    start();
                    updateClock();
                    timerInterval = setInterval(updateClock, 1000);
                };
            <\/script>
        </body>
        </html>
    `;

    const win = window.open('', '_blank', 'width=500,height=700');
    if (win) {
        win.document.write(cameraHtml);
        win.document.close();
    } else {
        alert("Pop-up diblokir oleh browser. Izinkan Pop-up untuk situs ini agar jendela kamera dapat terbuka.");
    }
}

// --- LOAD STRUKTUR FORM DINAMIS DARI GAS ---
async function loadDynamicForm() {
    const container = document.getElementById('dynamicFormContainer');
    
    // 1. Cek apakah ada cache konfigurasi tersimpan di browser agar langsung tampil instan
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
        // 2. Cek status form terlebih dahulu secara paralel atau cepat
        const statusRes = await fetch(GAS_URL + "?action=getFormStatus")
            .then(res => res.json())
            .catch(() => ({ status: 'BUKA' }));
        
        if (statusRes && statusRes.status === 'TUTUP') {
            document.getElementById('attendanceForm').innerHTML = `
                <div class="py-12 px-4 text-center space-y-4">
                    <div class="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-3xl mx-auto flex items-center justify-center text-3xl border border-amber-200">🔒</div>
                    <h2 class="text-lg font-extrabold text-slate-800">Presensi Telah Ditutup</h2>
                    <p class="text-xs text-slate-600 bg-amber-50/80 border border-amber-200/70 p-4 rounded-2xl leading-relaxed">
                        ${statusRes.message || 'Mohon maaf, pengisian form presensi perkuliahan saat ini sedang ditutup oleh admin.'}
                    </p>
                </div>`;
            return;
        }

        // 3. Ambil konfigurasi form terbaru dari Google Apps Script
        const configRes = await fetch(GAS_URL + "?action=getFormConfiguration").then(res => res.json());
        
        if (configRes && configRes.status === 'success' && configRes.fields && configRes.fields.length > 0) {
            loadedFieldsConfig = configRes.fields;
            // Simpan ke localStorage untuk kunjungan berikutnya agar instan
            localStorage.setItem('simpel_form_config_cache', JSON.stringify(loadedFieldsConfig));
            renderFormFields(loadedFieldsConfig);
        } else if (!cachedConfig) {
            container.innerHTML = '<p class="text-rose-500 text-center text-xs font-semibold py-4">Gagal memuat struktur form.</p>';
        }
    } catch (e) {
        console.error(e);
        if (!cachedConfig) {
            container.innerHTML = '<p class="text-rose-500 text-center text-xs font-semibold py-4">Gagal terhubung ke server Google.</p>';
        }
    }
}

// Render Elemen Form Dinamis ke DOM
function renderFormFields(fields) {
    const container = document.getElementById('dynamicFormContainer');
    const filteredFields = fields.filter(f => f.name !== 'email' && f.name !== 'emailInput');

    container.innerHTML = filteredFields.map(f => {
        let fieldHtml = '';
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
                    ${f.options.map(opt => {
                        const emo = emojiMap[opt] || { icon: "😃", label: opt };
                        return `
                            <label class="cursor-pointer">
                                <input type="radio" name="${f.name}" value="${opt}" ${reqAttr} class="peer sr-only">
                                <div class="p-2 sm:p-2.5 rounded-2xl border border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/80 hover:bg-slate-50 flex flex-col items-center justify-center transition-all shadow-sm">
                                    <span class="text-2xl sm:text-3xl block mb-1">${emo.icon}</span>
                                    <span class="text-[9px] sm:text-[10px] font-extrabold text-slate-600 block truncate w-full">${emo.label}</span>
                                </div>
                            </label>`;
                    }).join('')}
                </div>`;
        } else if (f.type === 'select') {
            fieldHtml = `
                <input type="hidden" id="${f.name}" name="${f.name}" ${reqAttr} value="">
                <button type="button" onclick="openSelectModal('${f.name}', '${f.label}', ${JSON.stringify(f.options).replace(/"/g, '&quot;')})"
                    id="trigger_${f.name}"
                    class="w-full text-left px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 text-xs sm:text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 flex justify-between items-center transition-all">
                    <span id="label_display_${f.name}">-- Pilih ${f.label} --</span>
                    <span class="text-indigo-600 font-bold text-xs">▼</span>
                </button>`;
        } else if (f.type === 'radio') {
            fieldHtml = `
                <div class="flex flex-wrap gap-2.5 pt-1">
                    ${f.options.map(opt => `
                        <label class="flex items-center text-xs cursor-pointer bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 transition-all">
                            <input type="radio" name="${f.name}" value="${opt}" ${reqAttr} class="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                            <span class="ml-2 text-slate-700 font-bold">${opt}</span>
                        </label>`).join('')}
                </div>`;
        } else {
            const isNamaField = f.name === 'nama';
            const uppercaseClass = isNamaField ? 'uppercase' : '';
            const onInputAttr = isNamaField ? 'oninput="this.value = this.value.toUpperCase()"' : '';

            fieldHtml = `
                <input type="text" id="${f.name}" name="${f.name}" ${reqAttr} ${onInputAttr} placeholder="${f.label}"
                    class="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-xs sm:text-sm bg-slate-50/70 hover:bg-slate-50 transition-all font-medium text-slate-800 placeholder:text-slate-400 ${uppercaseClass}" />`;
        }

        return `
            <div>
                <label class="block text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">${f.label} ${reqTag}</label>
                ${fieldHtml}
            </div>`;
    }).join('');
}

// --- DROPDOWN MODAL CONTROL ---
function openSelectModal(fieldName, fieldLabel, options) {
    document.getElementById('selectModalTitle').innerText = 'Pilih ' + fieldLabel;
    const optionsContainer = document.getElementById('selectModalOptions');
    
    optionsContainer.innerHTML = options.map(opt => `
        <button type="button" onclick="selectOptionValue('${fieldName}', '${opt.replace(/'/g, "\\'")}')"
            class="w-full text-left p-3.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-2xl transition-all">
            ${opt}
        </button>
    `).join('');

    document.getElementById('customSelectModal').classList.remove('hidden');
}

function selectOptionValue(fieldName, val) {
    document.getElementById(fieldName).value = val;
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
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
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
            document.getElementById('previewContainer').classList.remove('hidden');
            document.getElementById('imagePreview').src = compressedBase64;
            document.getElementById('sizeInfo').innerText = `Berkas galeri terkompresi`;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// --- MODAL POPUP RESULTS ---
function showPopupModal(isSuccess, title, message, targetEmail) {
    const iconContainer = document.getElementById('modalIconContainer');
    const icon = document.getElementById('modalIcon');
    const closeBtn = document.getElementById('modalCloseBtn');
    const msgElem = document.getElementById('modalMessage');

    if (isSuccess) {
        iconContainer.className = "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3.5 bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-inner";
        icon.innerText = "✓";
        closeBtn.className = "w-full mt-6 py-3.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 focus:outline-none";

        let content = `<p class="font-bold text-slate-700 text-center text-sm">${message}</p>`;
        if (targetEmail) {
            content += `
                <div class="mt-3.5 p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-left flex items-start space-x-3">
                    <span class="text-xl leading-none">📧</span>
                    <div>
                        <p class="font-extrabold text-indigo-950 text-xs">Konfirmasi Email Terkirim!</p>
                        <p class="text-[11px] text-indigo-800 leading-normal mt-0.5">
                            Bukti sah presensi telah dikirimkan ke alamat email Anda: <br><strong class="underline">${targetEmail}</strong>.
                        </p>
                    </div>
                </div>`;
        }
        msgElem.innerHTML = content;

    } else {
        iconContainer.className = "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3.5 bg-rose-100 text-rose-600 border border-rose-200 shadow-inner";
        icon.innerText = "✕";
        closeBtn.className = "w-full mt-6 py-3.5 px-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/30 focus:outline-none";
        msgElem.innerHTML = `<p class="text-slate-600 text-center font-medium">${message}</p>`;
    }

    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalAlert').classList.remove('hidden');
}

function closePopupModal() {
    document.getElementById('modalAlert').classList.add('hidden');
}

// --- SUBMIT HANDLER KE BACKEND GAS ---
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const emailInputVal = document.getElementById('emailInput') ? document.getElementById('emailInput').value.trim() : '';
    const npmVal = document.getElementById('npm') ? document.getElementById('npm').value.trim() : '';
    const namaVal = document.getElementById('nama') ? document.getElementById('nama').value.trim().toUpperCase() : '';

    if (!emailInputVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInputVal)) {
        showPopupModal(false, "Email Tidak Valid", "Pastikan penulisan format email sudah benar.");
        return;
    }
    if (!npmVal || !/^\d{10}$/.test(npmVal)) {
        showPopupModal(false, "NPM Tidak Valid", "NPM harus terdiri dari tepat 10 digit angka.");
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

    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    document.getElementById('btnText').textContent = "Mengirim Data...";
    document.getElementById('btnSpinner').classList.remove('hidden');

    const payload = {
        userEmail: emailInputVal,
        email: emailInputVal,
        npm: npmVal,
        nama: namaVal,
        lat: document.getElementById('geoLat').value,
        lng: document.getElementById('geoLng').value,
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

    try {
        // Mengirim data menggunakan mode no-cors atau CORS fetch ke URL Web App GAS
        const response = await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        btn.disabled = false;
        document.getElementById('btnText').textContent = "Kirim Presensi Kehadiran";
        document.getElementById('btnSpinner').classList.add('hidden');

        showPopupModal(true, "Presensi Berhasil!", "Data presensi Anda berhasil disimpan dan email konfirmasi telah dijadwalkan terkirim.", emailInputVal);
        
        // Reset Form State
        document.getElementById('formAbsensi').reset();
        resetDynamicSelects();
        document.getElementById('previewContainer').classList.add('hidden');
        compressedBase64 = null;

    } catch (err) {
        console.error(err);
        btn.disabled = false;
        document.getElementById('btnText').textContent = "Kirim Presensi Kehadiran";
        document.getElementById('btnSpinner').classList.add('hidden');
        showPopupModal(false, "Terjadi Kesalahan", err.message || "Gagal terhubung ke server.");
    }
}
