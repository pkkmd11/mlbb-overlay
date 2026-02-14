let allHeroes = [];
let lastPlayed = {};
let localTimerValue = 0;
let timerCountdownInterval = null;
let currentDraftData = null;
let timerAnimationTimeout = null;
let ws = null; // Variabel global WS
let reconnectInterval = null;

// --- 1. LOAD HERO DATA ---
async function loadHeroes() {
    try {
        const response = await fetch('/database/herolist.json');
        allHeroes = await response.json();
    } catch (e) { console.error("Error loading herolist", e); }
}

function getVoiceByImg(imgSrc) {
    if (!imgSrc || !allHeroes.length) return null;
    const hero = allHeroes.find(h => h.img === imgSrc);
    return hero ? hero.voice : null;
}

// --- 2. WEBSOCKET MANAGER (AUTO RECONNECT) ---

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected to Server');
        // Saat connect pertama kali/reconnect, fetch data manual sekali saja untuk sinkronisasi awal
        fetchDraftData(); 
        
        // Hapus interval reconnect jika sudah connect
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            // PERBAIKAN UTAMA:
            // Jika tipe update draft, PAKAI DATA DARI PESAN. JANGAN FETCH ULANG.
            if (msg.type === 'draftdata_update' && msg.data) {
                console.log("Menerima update langsung via Socket");
                processData(msg.data); // Proses data langsung
            } 
            // Fallback jika payload kosong (jarang terjadi)
            else if (msg.type === 'draftdata_update') {
                fetchDraftData();
            }
        } catch (e) {
            console.error("WS Parse Error", e);
        }
    };

    ws.onclose = () => {
        console.log('Koneksi terputus. Mencoba reconnect dalam 3 detik...');
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 3000);
        }
    };

    ws.onerror = (err) => {
        console.error('Socket error:', err);
        ws.close();
    };
}

// Fungsi Fetch Manual (Hanya dipanggil saat load awal atau reconnect)
async function fetchDraftData() {
    try {
        const response = await fetch('/api/matchdraft');
        const data = await response.json();
        if (data && data.draftdata) {
            processData(data.draftdata);
        }
    } catch (error) {
        console.error("Error fetch draft data:", error);
    }
}

// Fungsi Wrapper untuk memproses data (Supaya bisa dipanggil dari WS maupun Fetch)
function processData(newDraftData) {
    // Simpan ke variabel global
    currentDraftData = newDraftData;
    
    // Update Tampilan
    updateDisplay(newDraftData);
    updateGameLogic(newDraftData);
}

// --- INITIALIZE ---
// Jalankan saat load
loadHeroes().then(() => connectWebSocket());


// --- 3. DISPLAY UPDATE LOGIC (Sama seperti sebelumnya) ---

function playVoice(voiceSrc, index) {
    if (!voiceSrc) return;
    let audio = document.getElementById("hero-voice");
    // Pastikan currentDraftData ada sebelum akses properti
    let phaseIdx = (currentDraftData && currentDraftData.current_phase) ? parseInt(currentDraftData.current_phase) : 0;
    
    // Logic volume fase akhir
    if (phaseIdx >= phases.length - 1) {
        audio.volume = 0;
    } else {
        audio.volume = 1;
    }
    
    // Reset dan Play
    audio.pause();
    audio.currentTime = 0;
    audio.src = voiceSrc;
    var playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('Auto-play prevented (User must interact first)');
        });
    }
}

function updateDisplay(newData) {
    if (!newData) return; // Safety check

    const map = [];
    
    // Safety check array pick/ban
    const safePickBlue = newData.blueside.pick || [];
    const safePickRed = newData.redside.pick || [];
    const safeBanBlue = newData.blueside.ban || [];
    const safeBanRed = newData.redside.ban || [];

    safePickBlue.forEach((p, i) => map[1+i] = p.hero);
    safePickRed.forEach((p, i) => map[6+i] = p.hero);
    safeBanBlue.forEach((p, i) => map[11+i] = p.hero);
    safeBanRed.forEach((p, i) => map[16+i] = p.hero);

    for (let i = 1; i <= 20; i++) {
        let imgSrc = map[i];
        let imgElement = document.getElementById(`image-display-${i}`);
        let boxElement = document.getElementById(`image-box-${i}`);
        
        if (imgElement && boxElement) { // Safety check element exist
            if (imgSrc) {
                // Gunakan endsWith untuk cek path agar tidak reload gambar yang sama
                if (!imgElement.src.endsWith(imgSrc)) {
                     imgElement.src = imgSrc;
                     
                     const voiceSrc = getVoiceByImg(imgSrc);
                     if (voiceSrc && lastPlayed[i] !== imgSrc) {
                         playVoice(voiceSrc, i);
                         lastPlayed[i] = imgSrc;
                     }
                }

                imgElement.style.opacity = "1";
                boxElement.classList.add("show");
            } else {
                imgElement.src = ""; // Clear src
                imgElement.style.opacity = "0";
                boxElement.classList.remove("show");
                lastPlayed[i] = null;
            }
        }
    }
}

// --- 4. TIMER & PHASE UI LOGIC (Sama seperti sebelumnya) ---

const phaseElement = document.getElementById('phase');
const arrowElement = document.getElementById('arrow');
const timerElement = document.getElementById('timer');
const timerBar = document.getElementById('timer-bar');

const phases = [
    { type: "BANNING", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/RightBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/RightBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/RightBanning.gif" },
    { type: "PICKING", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "PICKING", direction: "/Assets/Other/RightPicking.gif" },
    { type: "PICKING", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "PICKING", direction: "/Assets/Other/RightPicking.gif" },
    { type: "BANNING", direction: "/Assets/Other/RightBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/RightBanning.gif" },
    { type: "BANNING", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "PICKING", direction: "/Assets/Other/RightPicking.gif" },
    { type: "PICKING", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "PICKING", direction: "/Assets/Other/RightPicking.gif" },
    { type: "ADJUSTMENT", direction: "/Assets/Other/Adjustment.gif" }
];

const phasesActiveBoxes = [
    ["ban-left-1"], ["ban-right-1"], ["ban-left-2"], ["ban-right-2"],
    ["ban-left-3"], ["ban-right-3"], ["pick-left-1"], ["pick-right-1", "pick-right-2"],
    ["pick-left-2", "pick-left-3"], ["pick-right-3"], ["ban-right-4"], ["ban-left-4"],
    ["ban-right-5"], ["ban-left-5"], ["pick-right-4"], ["pick-left-4", "pick-left-5"],
    ["pick-right-5"], []
];

function updateGameLogic(data) {
    if (!data) return;

    let currentPhaseIndex = parseInt(data.current_phase) || 0;
    let serverTimer = parseInt(data.timer) || 60;
    let isRunning = data.timer_running;

    // Logic Timer Lokal
    // Kita cek apakah timer berubah signifikan atau status running berubah
    if (Math.abs(localTimerValue - serverTimer) > 2 || 
        (currentDraftData && currentDraftData.timer_running !== isRunning) || 
        (currentDraftData && currentDraftData.current_phase !== data.current_phase)) {
        
        startLocalCountdown(serverTimer, isRunning);
        
        if (isRunning) {
            animateTimerBar(serverTimer); 
        } else {
            if(timerAnimationTimeout) clearTimeout(timerAnimationTimeout);
            if(timerBar) {
                timerBar.style.transition = 'width 0.5s ease';
                timerBar.style.width = '100%';
            }
        }
    }

    // Logic Tampilan Phase
    if (phaseElement && arrowElement) {
        if (currentPhaseIndex < phases.length) {
            const currentPhase = phases[currentPhaseIndex];
            phaseElement.textContent = currentPhase.type;
            
            // Cek src sebelum ganti untuk mencegah flicker
            if (!arrowElement.src.endsWith(currentPhase.direction)) {
                arrowElement.src = currentPhase.direction;
            }
        } else {
            phaseElement.textContent = "All Phases Completed";
            arrowElement.src = "";
        }
    }

    // Logic Active Box
    document.querySelectorAll(".box").forEach(box => {
        box.classList.remove("active-ban", "active-pick");
    });

    if (currentPhaseIndex < phasesActiveBoxes.length) {
        phasesActiveBoxes[currentPhaseIndex].forEach(boxId => {
            const phaseBox = document.getElementById(boxId);
            if (phaseBox) {
                const isBanPhase = (currentPhaseIndex < 6) || (currentPhaseIndex >= 10 && currentPhaseIndex <= 13);
                phaseBox.classList.add(isBanPhase ? "active-ban" : "active-pick");
            }
        });
    }
}

function startLocalCountdown(startTime, isRunning) {
    if (timerCountdownInterval) clearInterval(timerCountdownInterval);
    
    localTimerValue = startTime;
    if(timerElement) timerElement.textContent = String(localTimerValue).padStart(2, '0');

    if (isRunning) {
        timerCountdownInterval = setInterval(() => {
            if (localTimerValue > 0) {
                localTimerValue--;
                if(timerElement) timerElement.textContent = String(localTimerValue).padStart(2, '0');
            } else {
                clearInterval(timerCountdownInterval);
            }
        }, 1000);
    }
}

function animateTimerBar(duration) {
    if (!timerBar) return;
    if (timerAnimationTimeout) clearTimeout(timerAnimationTimeout);

    timerBar.style.transition = "width 0.5s cubic-bezier(0.25, 1, 0.5, 1)";
    timerBar.style.width = "100%";
    
    timerAnimationTimeout = setTimeout(() => {
        void timerBar.offsetWidth; 
        timerBar.style.transition = `width ${duration}s linear`;
        timerBar.style.width = "0%";
    }, 500); 
}