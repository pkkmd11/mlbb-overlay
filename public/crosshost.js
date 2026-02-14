(async () => {
  // In Docker / LXC, server-side IP auto-detection often yields a container IP.
  // For portability, always connect back to the same host that served this page.
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}`;
  console.log(`Attempting WebSocket connection to ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  const timerKeys = ['timer', 'timerRunning', 'resetTimerBar', 'currentPhaseIndex', 'updateTime'];
  const alwaysUpdateKeys = ['currentVideo', 'logo1', 'logo2']; // Tambahkan logo1 dan logo2
  let previousStorage = { ...localStorage };

  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  localStorage.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    sendStorageDelta(key, value);
  };

  localStorage.removeItem = function(key) {
    originalRemoveItem.call(this, key);
    sendStorageDelta(key, null);
  };

  localStorage.clear = function() {
    originalClear.call(this);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'clear' }));
      previousStorage = {};
      console.log('localStorage cleared and sent to server');
    } else {
      console.warn('WebSocket not open, cannot send clear');
    }
  };

  function sendStorageDelta(key, value) {
    const delta = {};
    if (value === null) {
      if (key in previousStorage) {
        delta[key] = null;
        delete previousStorage[key];
      }
    } else if (alwaysUpdateKeys.includes(key) || previousStorage[key] !== value) {
      delta[key] = value;
      previousStorage[key] = value;
    }

    for (const timerKey of timerKeys) {
      const currentValue = localStorage.getItem(timerKey);
      if (currentValue !== previousStorage[timerKey]) {
        delta[timerKey] = currentValue;
        previousStorage[timerKey] = currentValue;
      }
    }

    if (Object.keys(delta).length && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update', data: delta }));
      console.log('Sent delta update:', delta);
    }
  }

  ws.onopen = () => {
    console.log(`Connected to WebSocket server at ${wsUrl}`);
    const currentData = { ...localStorage };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'init', data: currentData }));
      previousStorage = currentData;
      console.log('Sent current localStorage data:', currentData);
    }
  };

  ws.onerror = (error) => console.error('WebSocket error:', error);
  ws.onclose = () => console.log('WebSocket connection closed');
})();
