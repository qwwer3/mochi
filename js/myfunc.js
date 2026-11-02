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
        try { task.addRecFn(task.rec); } catch (e) { console.error('拼音打字·媒体消息失败', e); }
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
          if (matchPool(currentPinyin).length > 0) {
            refreshCandidates(true);
            break;
          }
          tries++;
        }
      }
      Math.random() < 0.5 ? step2() : step1();
    }, 5000);
  }

  // ===== 动作二 =====
  function step2() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      Math.random() < 0.7 ? step4() : step3();
    }, 4000);
  }

  // ===== 动作三 =====
  function step3() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (Math.random() < 0.7) step4();
      else { slideRight() ? step3() : step4(); }
    }, 4000);
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
    }, 5000);
  }

  // ===== 候选刷新（A1 已修：匹配失败保留旧池） =====
  function refreshCandidates(reset) {
    if (reset) {
      if (pyBar) pyBar.textContent = currentPinyin;
      if (!currentPinyin) {
        candidatesPool = []; shownWords = []; currentCandidates = []; targetWord = "";
        if (candBar) candBar.innerHTML = "";
        return false;
      }
      const newPool = matchPool(currentPinyin);
      if (newPool.length > 0) {
        candidatesPool = newPool;
        shownWords = [];
      }
      // 匹配失败：保留旧池
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
  if (!text) { resetTypingState(); if (panel) panel.hidden = true; return; }

  let ok = false;

  // ① 首选：走真实 UI 发送（触发 chat.js 完整链路：渲染/入库/触发回复）
  try {
    const input   = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    if (input) {
      if (input.tagName === 'DIV') {
        input.innerText = text;                       // ✅ contenteditable 用 innerText
      } else {
        input.value = text;                           // textarea / input 才用 value
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));

      if (sendBtn) {
        sendBtn.click();
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        }));
      }
      ok = true;
    }
  } catch (e) { console.error('拼音打字·UI 发送失败', e); }

  // ② 兜底：全局接口
  if (!ok) {
    try {
      if (typeof window.chatSendMsg === 'function') {
        window.chatSendMsg(text);  ok = true;
      } else if (typeof window.chatAddIn === 'function') {
        window.chatAddIn(text, { isOut: true, isPinyinKb: true, silent: false });  ok = true;
      }
    } catch (e2) { console.error('拼音打字·全局发送失败', e2); }
  }

  if (!ok) console.warn('拼音打字：所有发送路径均失败，检查 chat.js 是否暴露了发送接口');

  resetTypingState();
  if (panel) panel.hidden = true;
}

})();
