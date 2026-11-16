/**
 * SIMPEL v2.0 - Pusat Konfigurasi Frontend (GitHub Pages)
 * Cukup ubah GAS_URL di file ini setiap kali melakukan New Deployment di Google Apps Script.
 */
window.SIMPEL_CONFIG = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbz2Cb6nwViSsfXEB3n82ow91ro5cR5FO-VMibBfJHcpbPFWHXj9t1bUATbqA9wi6pzK8A/exec",
    API_KEY: "SIMPEL-V2-SECRET-KEY-2026",
    VERSION: "2.0",
    DEFAULT_BGM_URL: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",

    /**
     * Helper untuk membentuk URL halaman GAS (?page=kuis / ?page=dashboard)
     */
    getPageUrl: function (pageName) {
        const separator = this.GAS_URL.includes("?") ? "&" : "?";
        return `${this.GAS_URL}${separator}page=${encodeURIComponent(pageName)}`;
    }
};