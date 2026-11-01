(function(){
  const panel = document.getElementById('pinyin-kb-panel');
  const btn = document.getElementById('more-pinyinkb');
  if (!btn || !panel) return;

  const keyEls = document.querySelectorAll('.kb-key');
  const pyBar = document.getElementById('kb-pinyin-bar');
  const candBar = document.getElementById('kb-candidates');
  const inputBox = document.getElementById('kb-input-box');

  let isFeatureOn = false; 
  window.isPinyinKbEnabled = false; 
  
  let isTypingTask = false; 
  let collectWindow = null; 
  let collectingQueue = []; 
  
  let currentPinyin = ""; 
  let currentText = "";   
  let candidatesPool = []; 
  let shownWords = [];     
  let currentCandidates = []; 
  
  let autoTimer = null;
  let tenMinTimer = null;
  let targetWord = ""; 
  let taskQueue = []; 

  // ==========================================
  // 拖拽逻辑 (带边界限制)
  // ==========================================
  let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  const dragHandle = document.getElementById('kb-input-box').parentElement;

  dragHandle.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left; initialTop = rect.top;
    panel.style.bottom = 'auto'; panel.style.right = 'auto';
    panel.style.left = initialLeft + 'px'; panel.style.top = initialTop + 'px';
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    let newLeft = initialLeft + e.clientX - startX;
    let newTop = initialTop + e.clientY - startY;
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  });

  window.addEventListener('pointerup', () => { isDragging = false; });

  // ==========================================
  // 总开关
  // ==========================================
  btn.addEventListener('click', () => {
    isFeatureOn = !isFeatureOn;
    window.isPinyinKbEnabled = isFeatureOn; 
    if (isFeatureOn) {
      if (window.toast) window.toast('拟真拼音打字已开启');
    } else {
      if (window.toast) window.toast('拟真拼音打字已关闭');
      forceStop();
    }
  });

  function forceStop() {
    isTypingTask = false;
    clearTimeout(autoTimer); clearTimeout(tenMinTimer); clearTimeout(collectWindow);
    collectWindow = null; collectingQueue = []; taskQueue = [];
    panel.hidden = true;
    currentPinyin = ""; currentText = "";
    updateCandidates(); updateInputBox();
  }

  // ==========================================
  // 核心钩子：由 chat.js 调用
  // ==========================================
  window.pinyinKbQueuePush = function(rec, addRecFn) {
    if (!isFeatureOn) return;
    if (isTypingTask) return; // 并发丢弃
    
    if (collectWindow) {
      collectingQueue.push({ rec, addRecFn });
      return;
    }
    
    collectingQueue = [{ rec, addRecFn }];
    collectWindow = setTimeout(() => {
      collectWindow = null;
      collectingQueue.forEach(item => {
        if (item.rec.img || item.rec.voice) {
          taskQueue.push({ type: 'media', rec: item.rec, addRecFn: item.addRecFn });
        } else {
          taskQueue.push({ type: 'text', rec: item.rec, addRecFn: item.addRecFn });
        }
      });
      collectingQueue = [];
      if (taskQueue.length > 0) processQueue();
    }, 800); 
  };

  // ==========================================
  // 状态机与队列
  // ==========================================
  function processQueue() {
    if (isTypingTask || taskQueue.length === 0) return;
    isTypingTask = true;
    const task = taskQueue.shift();

    if (task.type === 'media') {
      // 遇到图片/表情包：瞬间发出去，不弹键盘
      if (task.addRecFn) task.addRecFn(task.rec); 
      setTimeout(() => { isTypingTask = false; processQueue(); }, 1000); 
    } else {
      // 遇到文字：弹出键盘开始打字
      panel.hidden = false;
      startTyping();
    }
  }

  function finishTask() {
    clearTimeout(autoTimer); clearTimeout(tenMinTimer);
    isTypingTask = false; panel.hidden = true;
    setTimeout(processQueue, 1000); // 打完一条，停顿一秒执行队列下一条
  }

  function startTyping() {
    resetTenMinTimer(); step1();
  }

  function resetTenMinTimer() {
    clearTimeout(tenMinTimer);
    tenMinTimer = setTimeout(() => {
      if (!isTypingTask) return;
      doSend(); finishTask();
    }, 10 * 60 * 1000);
  }

  function pressKeyVisual(key) {
    const el = Array.from(keyEls).find(el => el.getAttribute('data-key') === String(key));
    if (el) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 150);
    }
  }

  // 【动作一】
  function step1() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const keys = ['2','3','4','5','6','7','8','9', 'backspace', 'send'];
      const pick = keys[Math.floor(Math.random() * keys.length)];
      pressKeyVisual(pick);

      if (pick === 'send') {
        doSend(); finishTask();
      } else if (pick === 'backspace') {
        if (currentPinyin.length > 0) {
          currentPinyin = currentPinyin.slice(0, -1); refreshCandidates(true);
        } else if (currentText.length > 0) {
          currentText = currentText.slice(0, -1); updateInputBox();
        }
        step1();
      } else {
        const letters = window.T9_MAP[pick];
        const randomLetter = letters[Math.floor(Math.random() * letters.length)];
        
        if (currentPinyin.length >= 5) {
          currentPinyin = currentPinyin.slice(0, -1);
        } else {
          currentPinyin += randomLetter;
        }

        let hasWord = refreshCandidates(true);
        
        if (!hasWord) {
          currentPinyin = currentPinyin.slice(0, -1);
          refreshCandidates(true);
          step1();
        } else {
          if (Math.random() < 0.5) step2();
          else step1();
        }
      }
    }, 5000);
  }

  // 【动作二】
  function step2() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (Math.random() < 0.7) step4();
      else step3();
    }, 4000);
  }

  // 【动作三】
  function step3() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (Math.random() < 0.7) step4();
      else {
        if (!slideRight()) step4(); 
        else step3();
      }
    }, 4000);
  }

  // 【动作四】
  function step4() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const targetSpan = Array.from(candBar.children).find(span => span.textContent === targetWord);
      if (targetSpan) {
        targetSpan.style.background = '#d0d0d0';
        targetSpan.style.color = '#000';
      }
      currentText += targetWord;
      updateInputBox();
      currentPinyin = "";
      targetWord = "";
      refreshCandidates(true);
      step1();
    }, 5000);
  }

  function refreshCandidates(reset) {
    if (reset) {
      shownWords = []; candidatesPool = [];
      if (currentPinyin) {
        let regexStr = "^";
        for (let char of currentPinyin) {
          regexStr += "[" + (window.T9_MAP[char] || char) + "]";
        }
        const reg = new RegExp(regexStr);
        for (let py in window.PY_DICT) {
          if (reg.test(py)) {
            candidatesPool = candidatesPool.concat(window.PY_DICT[py]);
          }
        }
        candidatesPool = [...new Set(candidatesPool)];
      }
    }
    
    const nextWords = [];
    for (let i = 0; i < candidatesPool.length; i++) {
      const w = candidatesPool[i];
      if (!shownWords.includes(w)) {
        nextWords.push(w);
        if (nextWords.length === 6) break;
      }
    }

    if (nextWords.length === 0) return false;

    currentCandidates = nextWords;
    shownWords = shownWords.concat(nextWords);
    
    pyBar.textContent = currentPinyin;
    candBar.innerHTML = '';
    
    nextWords.forEach(word => {
      const span = document.createElement('span');
      span.textContent = word;
      span.style.background = 'transparent';
      span.style.color = '#333';
      span.style.transition = 'background 0.2s';
      candBar.appendChild(span);
    });

    targetWord = currentCandidates[Math.floor(Math.random() * currentCandidates.length)];
    return true;
  }

  function slideRight() { return refreshCandidates(false); }
  function updateInputBox() { inputBox.textContent = currentText; }

  function doSend() {
    if (currentPinyin && currentCandidates.length > 0) currentText += currentCandidates[0];
    if (currentText.trim()) {
      if (window.chatAddIn) window.chatAddIn(currentText, { isOut: true, isPinyinKb: true, silent: true });
    }
    currentText = ""; currentPinyin = "";
    refreshCandidates(true); updateInputBox();
  }

})();
