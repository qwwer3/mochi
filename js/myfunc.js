(function () {
  const panel = document.getElementById('pinyin-kb-panel');
  const btn = document.getElementById('more-pinyinkb');
  if (!btn || !panel) return;

  function getKeyEls() { return document.querySelectorAll('.kb-key'); }
  const pyBar = document.getElementById('kb-pinyin-bar');
  const candBar = document.getElementById('kb-candidates');
  const inputBox = document.getElementById('kb-input-box');

  let isFeatureOn = false;
  window.isPinyinKbEnabled = false;

  let isTypingTask = false;
  let collectWindow = null;
  let collectingQueue = [];
  let currentPinyin = "", currentText = "";
  let candidatesPool = [], shownWords = [], currentCandidates = [], targetWord = "";
  let autoTimer = null, tenMinTimer = null, taskQueue = [];

  // ===== 开关持久化 =====
  const STORE_KEY = 'xy-home-v2:pinyin-kb-on';
  try {
    if (localStorage.getItem(STORE_KEY) === '1') {
      isFeatureOn = true; window.isPinyinKbEnabled = true;
      if (btn.classList) btn.classList.add('on');
    }
  } catch (e) {}

  // ===== 拖拽（判空保护） =====
  let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  const dragHandle = inputBox && inputBox.parentElement;
  if (dragHandle) {
    dragHandle.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left; initialTop = rect.top;
      panel.style.bottom = 'auto'; panel.style.right = 'auto';
      panel.style.left = initialLeft + 'px'; panel.style.top = initialTop + 'px';
    });
  }
  window.addEventListener('pointermove', function (e) {
    if (!isDragging) return;
    let L = initialLeft + e.clientX - startX, T = initialTop + e.clientY - startY;
    L = Math.max(0, Math.min(L, window.innerWidth - panel.offsetWidth));
    T = Math.max(0, Math.min(T, window.innerHeight - panel.offsetHeight));
    panel.style.left = L + 'px'; panel.style.top = T + 'px';
  });
  window.addEventListener('pointerup', function () { isDragging = false; });

  // ===== 开关 =====
  btn.addEventListener('click', function () {
    isFeatureOn = !isFeatureOn;
    window.isPinyinKbEnabled = isFeatureOn;
    if (btn.classList) { isFeatureOn ? btn.classList.add('on') : btn.classList.remove('on'); }
    try {
      isFeatureOn ? localStorage.setItem(STORE_KEY, '1') : localStorage.removeItem(STORE_KEY);
    } catch (e) {}
    if (isFeatureOn) {
      if (window.toast) window.toast('拟真拼音打字已开启');
      // 重新开启时补处理残留队列
      if (taskQueue.length > 0) setTimeout(processQueue, 100);
    } else {
      if (window.toast) window.toast('拟真拼音打字已关闭');
      forceStop();
    }
  });

  // ===== 状态重置 =====
  function resetTypingState() {
    currentPinyin = ""; currentText = "";
    candidatesPool = []; shownWords = []; currentCandidates = []; targetWord = "";
    if (pyBar) pyBar.textContent = "";
    if (candBar) candBar.innerHTML = "";
    if (inputBox) inputBox.textContent = "";
  }

  function forceStop() {
    isTypingTask = false;
    clearTimeout(autoTimer); clearTimeout(tenMinTimer); clearTimeout(collectWindow);
    collectWindow = null; collectingQueue = []; taskQueue = [];
    panel.hidden = true;
    resetTypingState();
  }

  // ===== 媒体消息识别（依据 chat.js 的 rec 结构） =====
  function isMediaRec(rec) {
    if (!rec) return false;
    if (rec.img || rec.voice) return true;
    const t = String(rec.type || '').toLowerCase();
    if (t && t !== 'text') return true;
    if (Array.isArray(rec.parts)) {
      for (let i = 0; i < rec.parts.length; i++) {
        const p = rec.parts[i];
        if (!p) continue;
        const pt = String(p.t || p.type || '').toLowerCase();
        if (pt && pt !== 'text') return true;
      }
    }
    return false;
  }

  // ===== 入队 =====
  window.pinyinKbQueuePush = function (rec, addRecFn) {
    if (!isFeatureOn) return;
    if (isTypingTask) return;
    if (collectWindow) { collectingQueue.push({ rec: rec, addRecFn: addRecFn }); return; }
    collectingQueue = [{ rec: rec, addRecFn: addRecFn }];
    collectWindow = setTimeout(function () {
      collectWindow = null;
      if (!isFeatureOn) { collectingQueue = []; return; }
      collectingQueue.forEach(function (item) {
        taskQueue.push({
          type: isMediaRec(item.rec) ? 'media' : 'text',
          rec: item.rec, addRecFn: item.addRecFn
        });
      });
      collectingQueue = [];
      if (taskQueue.length > 0) processQueue();
    }, 800);
  };

function processQueue() {
  if (!isFeatureOn) return;
  if (isTypingTask || taskQueue.length === 0) return;
  isTypingTask = true;
  const task = taskQueue.shift();
  if (task.type === 'media') {
    if (task.addRecFn) {
      try {
        // ★ 关键：带 pinyinBypass，否则 addRec 会再次被拼音钩子拦截，
        //   而 isTypingTask=true 时 pinyinKbQueuePush 会静默 return，导致媒体消息永久丢失
        const mediaRec = Object.assign({}, task.rec, { pinyinBypass: true });
        task.addRecFn(mediaRec);
      } catch (e) { console.error('拼音打字·媒体消息失败', e); }
    }
    setTimeout(function () { isTypingTask = false; processQueue(); }, 1000);
  } else {
    panel.hidden = false;
    try { startTyping(); }
    catch (e) {
      console.error('拼音打字·startTyping异常', e);
      isTypingTask = false; panel.hidden = true;
      setTimeout(processQueue, 1000);
    }
  }
}

  function finishTask() {
    clearTimeout(autoTimer); clearTimeout(tenMinTimer);
    isTypingTask = false; panel.hidden = true;
    resetTypingState();
    setTimeout(function () { if (isFeatureOn) processQueue(); }, 1000);
  }

  function startTyping() {
    resetTypingState();
    resetTenMinTimer();
    step1();
  }

  function resetTenMinTimer() {
    clearTimeout(tenMinTimer);
    tenMinTimer = setTimeout(function () {
      if (!isTypingTask) return;
      doSend(); finishTask();
    }, 10 * 60 * 1000);
  }

  function pressKeyVisual(key) {
    const els = getKeyEls();
    const el = Array.prototype.find.call(els, function (n) { return n.getAttribute('data-key') === String(key); });
    if (el && el.classList) {
      el.classList.add('active');
      setTimeout(function () { if (el.classList) el.classList.remove('active'); }, 150);
    }
  }

  // ===== 纯函数：按前缀匹配候选池 =====
  function matchPool(prefix) {
    if (!prefix) return [];
    const dict = window.PY_DICT || {};
    const pool = [];
    let regexStr = "^";
    for (let i = 0; i < prefix.length; i++) {
      const ch = prefix.charAt(i);
      regexStr += "[" + ((window.T9_MAP && window.T9_MAP[ch]) || ch) + "]";
    }
    let reg = null;
    try { reg = new RegExp(regexStr); } catch (e) { return []; }
    for (const py in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, py)) continue;
      if (reg.test(py)) {
        const words = dict[py];
        if (Array.isArray(words)) {
          for (let j = 0; j < words.length; j++) {
            if (pool.indexOf(words[j]) < 0) pool.push(words[j]);
          }
        }
      }
    }
    return pool;
  }

  // ===== 动作一 =====
  function step1() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (currentPinyin.length >= 8) {
        if (currentCandidates && currentCandidates.length > 0) {
          Math.random() < 0.5 ? step2() : step3();
        } else {
          currentPinyin = "";
          refreshCandidates(true);
          step1();
        }
        return;
      }
      const keys = ['2','3','4','5','6','7','8','9','backspace','send'];
      const pick = keys[Math.floor(Math.random() * keys.length)];
      pressKeyVisual(pick);
      if (pick === 'send') { doSend(); finishTask(); return; }
      if (pick === 'backspace') {
        if (currentPinyin.length > 0) {
          currentPinyin = currentPinyin.slice(0, -1);
          refreshCandidates(true);
        } else if (currentText.length > 0) {
          currentText = currentText.slice(0, -1);
          updateInputBox();
        }
        step1();
        return;
      }
      const letters = window.T9_MAP && window.T9_MAP[pick];
      if (!letters) { step1(); return; }
      const chosen = letters.charAt(Math.floor(Math.random() * letters.length));
      currentPinyin += chosen;
      refreshCandidates(true);
      // 拼音过长且完全无匹配 → 限次收缩，避免完整词典下卡顿
      if (currentPinyin.length > 6 && matchPool(currentPinyin).length === 0) {
        let tries = 0;
        while (currentPinyin.length > 2 && tries < 3) {
          currentPinyin = currentPinyin.slice(0, -1);
          if (matchPool(currentPinyin).length > 0) break;
          tries++;
        }
        // 关键：无论匹配成功与否都刷新 pyBar，避免循环 3 次都没匹配时
        // currentPinyin 已减 3 个字符、pyBar 还停在旧值 → 下次任何刷新一次跳多个字母
        refreshCandidates(true);
      }
      Math.random() < 0.5 ? step2() : step1();
    }, 8000);
  }

  // ===== 动作二 =====
  function step2() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      Math.random() < 0.7 ? step4() : step3();
    }, 6000);
  }

  // ===== 动作三 =====
  function step3() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (Math.random() < 0.7) step4();
      else { slideRight() ? step3() : step4(); }
    }, 5000);
  }

  // ===== 动作四 =====
  function step4() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (!currentCandidates || currentCandidates.length === 0 || !targetWord) {
        currentPinyin = "";
        refreshCandidates(true);
        step1();
        return;
      }
      const targetSpan = candBar ? Array.prototype.find.call(candBar.children || [], function (span) {
        return span.textContent === targetWord;
      }) : null;
      if (targetSpan) {
        targetSpan.style.background = "#d0d0d0";
        targetSpan.style.color = "#000";
      }
      currentText += targetWord;
      updateInputBox();
      currentPinyin = ""; targetWord = "";
      shownWords = []; candidatesPool = []; currentCandidates = [];
      refreshCandidates(true);
      step1();
    }, 8000);
  }

  // ===== 候选刷新（A1 已修：匹配失败保留旧池） =====
  // ===== 候选刷新（严格按当前拼音：匹配失败也清空） =====
  function refreshCandidates(reset) {
    if (reset) {
      if (pyBar) pyBar.textContent = currentPinyin || '';
      if (!currentPinyin) {
        candidatesPool = []; shownWords = []; currentCandidates = []; targetWord = "";
        if (candBar) candBar.innerHTML = "";
        return false;
      }
      const newPool = matchPool(currentPinyin);
      // 严格按当前拼音：匹配失败也清空候选池，
      // 否则 pyBar 显示 "n"、候选区还停在 "ni" 那一批词，拼音条与候选区不同步。
      candidatesPool = newPool;
      shownWords = [];
      if (newPool.length === 0) {
        currentCandidates = []; targetWord = "";
        if (candBar) candBar.innerHTML = "";
        return false;
      }
    }
    const nextWords = [];
    for (let i = 0; i < candidatesPool.length; i++) {
      const w = candidatesPool[i];
      if (shownWords.indexOf(w) < 0) {
        nextWords.push(w);
        if (nextWords.length === 6) break;
      }
    }
    if (nextWords.length === 0) {
      if (candBar) candBar.innerHTML = "";
      currentCandidates = []; targetWord = "";
      return false;
    }
    currentCandidates = nextWords;
    shownWords = shownWords.concat(nextWords);
    if (candBar) {
      candBar.innerHTML = "";
      nextWords.forEach(function (word) {
        const span = document.createElement("span");
        span.textContent = word;
        span.style.background = "transparent";
        span.style.color = "#333";
        span.style.transition = "background 0.2s";
        candBar.appendChild(span);
      });
    }
    targetWord = currentCandidates[Math.floor(Math.random() * currentCandidates.length)];
    return true;
  }

  function slideRight() { return refreshCandidates(false); }
  function updateInputBox() { if (inputBox) inputBox.textContent = currentText; }

function doSend() {
  let text = (currentText || '').trim();
  if (!text && currentPinyin && currentCandidates && currentCandidates.length > 0) {
    text = currentCandidates[0].trim();
  }
  if (!text) {
    resetTypingState();
    return;
  }

  try {
    // 拼音打字 = 对方打字 → 一律走「对方」身份（左侧气泡）
    // 不 fallback 到 chatSendMsg / chatAddIn / sendBtn.click —— 那几条都是「我」发的路径
    if (typeof window.chatAddInPinyin === 'function') {
      window.chatAddInPinyin(text);
    } else {
      console.error('[拼音打字] chat.js 未更新（缺 chatAddInPinyin），本条无法以「对方」身份发出');
    }
  } catch (e) {
    console.error('拼音打字·发送失败', e);
  }

  resetTypingState();
  if (panel) panel.hidden = true;
}
})();
