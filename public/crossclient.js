(async () => {
  // In Docker / LXC, server-side IP auto-detection often yields a container IP.
  // For portability, always connect back to the same host that served this page.
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}`;
  console.log(`Attempting WebSocket connection to ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  const timerKeys = ['timer', 'timerRunning', 'resetTimerBar', 'currentPhaseIndex', 'updateTime'];
  const mvpKeys = ['mvpData', 'selectedMvp', 'mvpUpdateTime'];

  function triggerUpdateUI(changedData, isFullUpdate) {
    const isTimerUpdate = !isFullUpdate && Object.keys(changedData).some(key => timerKeys.includes(key));
    const isImageUpdate = !isFullUpdate && Object.keys(changedData).some(key => key === 'logo1' || key === 'logo2' || key.toLowerCase().includes('image'));
    const isMvpUpdate = !isFullUpdate && Object.keys(changedData).some(key => mvpKeys.includes(key));

    if (isFullUpdate) {
      window.loadImages?.();
      window.updateDisplay?.();
      window.updateUI?.();
      window.updateMvpDisplay?.();
      console.log('Full UI update triggered');
      return;
    }

    if (isImageUpdate) {
      window.loadImages?.();
      console.log('Image update triggered:', { changedData });
    }
    if (isTimerUpdate) {
      window.updateUI?.();
      console.log('Timer update triggered:', { changedData });
    }
    if (isMvpUpdate) {
      window.updateMvpDisplay?.();
      console.log('MVP update triggered:', { changedData });
    }
    
    if (!isTimerUpdate && !isImageUpdate && !isMvpUpdate) {
      window.updateDisplay?.();
      console.log('General display update triggered:', { changedData });
    }
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const changedData = {};

      if (msg.type === 'init' || msg.type === 'update') {
        // ==================== PERUBAHAN DIMULAI DI SINI ====================
        const isLiveUpdate = msg.type === 'update'; // Tandai jika ini adalah update langsung, bukan inisialisasi
        const action = isLiveUpdate ? 'delta' : 'init data';
        
        for (const [key, value] of Object.entries(msg.data)) {
          const oldValue = localStorage.getItem(key);

          if (value === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, value);
          }
          changedData[key] = value;
          
          // KUNCI PERBAIKAN:
          // Hanya picu event 'storage' secara manual JIKA ini adalah 'update' langsung.
          // Saat 'init' (refresh halaman), kita tidak ingin memicu event agar tidak memulai ulang animasi.
          // Halaman akan membaca state dari localStorage saat pertama kali dimuat.
          if (isLiveUpdate) {
            window.dispatchEvent(new StorageEvent('storage', {
              key: key,
              newValue: value === null ? null : String(value), // newValue harus string atau null
              oldValue: oldValue,
              storageArea: localStorage,
              url: window.location.href,
            }));
          }
        }
        // ===================== AKHIR DARI PERUBAHAN ======================
        
        console.log(`localStorage updated with ${action}:`, { ...localStorage });
        triggerUpdateUI(changedData, msg.type === 'init');

      } else if (msg.type === 'clear') {
        localStorage.clear();
        console.log('localStorage cleared');
        
        // Tetap picu event 'clear' agar halaman bisa me-reset dirinya
        window.dispatchEvent(new StorageEvent('storage', {
          key: null,
          newValue: null,
          oldValue: null,
          storageArea: localStorage,
          url: window.location.href,
        }));
        
        triggerUpdateUI({}, true);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  };

  ws.onopen = () => {
    console.log(`Connected to WebSocket server at ${wsUrl}`);
  };

  ws.onerror = (error) => console.error('WebSocket error:', error);
  ws.onclose = () => console.log('WebSocket connection closed');
})();
