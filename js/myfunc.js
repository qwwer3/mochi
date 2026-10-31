(function(){
  const panel = document.getElementById('pinyin-kb-panel');
  const btn = document.getElementById('more-pinyinkb');
  if (!btn || !panel) return;

  const keyEls = document.querySelectorAll('.kb-key');
  const pyBar = document.getElementById('kb-pinyin-bar');
  const candBar = document.getElementById('kb-candidates');
  const inputBox = document.getElementById('kb-input-box');

  let isFeatureOn = false; // 总开关
  let isTypingTask = false; // 正在执行任务
  
  let currentPinyin = ""; 
  let currentText = "";   
  let candidatesPool = []; // 匹配到的全量候选词
  let shownWords = [];     // 已经展示过的词（防重复）
  let currentCandidates = []; // 当前页面显示的6个词
  
  let autoTimer = null;
  let tenMinTimer = null;
  let targetWord = ""; // 动作四选中的词

  let taskQueue = []; // 任务队列

  // ==========================================
  // 拖拽逻辑 (实现自由拖动)
  // ==========================================
  let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  const dragHandle = document.getElementById('kb-input-box').parentElement;

  dragHandle.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left; initialTop = rect.top;
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.left = initialLeft + 'px';
    panel.style.top = initialTop + 'px';
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    panel.style.left = (initialLeft + e.clientX - startX) + 'px';
    panel.style.top = (initialTop + e.clientY - startY) + 'px';
  });

  window.addEventListener('pointerup', () => { isDragging = false; });

  // ==========================================
  // 总开关
  // ==========================================
  btn.addEventListener('click', () => {
    isFeatureOn = !isFeatureOn;
    if (isFeatureOn) {
      if (window.toast) window.toast('拟真拼音打字已开启');
    } else {
      if (window.toast) window.toast('拟真拼音打字已关闭');
      forceStop();
    }
  });

  function forceStop() {
    isTypingTask = false;
    taskQueue = [];
    clearTimeout(autoTimer);
    clearTimeout(tenMinTimer);
    panel.hidden = true;
    currentPinyin = ""; currentText = "";
    updateCandidates();
    updateInputBox();
  }

  // ==========================================
  // 状态机
  // ==========================================
  function startTyping() {
    resetTenMinTimer();
    step1();
  }

  function resetTenMinTimer() {
    clearTimeout(tenMinTimer);
    tenMinTimer = setTimeout(() => {
      if (!isTypingTask) return;
      doSend(); // 10分钟保底强制发送
      finishTask();
    }, 10 * 60 * 1000);
  }

  function pressKeyVisual(key) {
    const el = Array.from(keyEls).find(el => el.getAttribute('data-key') === String(key));
    if (el) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 150);
    }
  }

  function step1() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      const keys = ['2','3','4','5','6','7','8','9', 'backspace', 'send'];
      const pick = keys[Math.floor(Math.random() * keys.length)];
      pressKeyVisual(pick);

      if (pick === 'send') {
        doSend();
        finishTask();
      } else if (pick === 'backspace') {
        if (currentPinyin.length > 0) {
          currentPinyin = currentPinyin.slice(0, -1);
          refreshCandidates(true);
        } else if (currentText.length > 0) {
          currentText = currentText.slice(0, -1);
          updateInputBox();
        }
        step1();
      } else {
        // 50% 概率成功拼出拼音
        if (Math.random() < 0.5) {
          const letters = window.T9_MAP[pick];
          const randomLetter = letters[Math.floor(Math.random() * letters.length)];
          currentPinyin += randomLetter;
          if (refreshCandidates(true)) {
            step2();
          } else {
            currentPinyin = ""; // 没匹配到字，重来
            step1();
          }
        } else {
          step1(); // 假装按错了
        }
      }
    }, 5000);
  }

  function step2() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (Math.random() < 0.7) {
        step4();
      } else {
        step3();
      }
    }, 4000);
  }

  function step3() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (Math.random() < 0.7) {
        step4();
      } else {
        if (!slideRight()) {
          step4(); // 滑不动了就选中
        } else {
          step3();
        }
      }
    }, 4000);
  }

  function step4() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      // 5秒后高亮并落入输入框
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

  // ==========================================
  // 候选词逻辑
  // ==========================================
  function refreshCandidates(reset) {
    if (reset) {
      shownWords = [];
      candidatesPool = [];
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
    
    // 取接下来的6个不重复的词
    const nextWords = [];
    for (let i = 0; i < candidatesPool.length; i++) {
      const w = candidatesPool[i];
      if (!shownWords.includes(w)) {
        nextWords.push(w);
        if (nextWords.length === 6) break;
      }
    }

    if (nextWords.length === 0) return false; // 没有词了

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

    // 随机指定一个目标词（动作四会用到）
    targetWord = currentCandidates[Math.floor(Math.random() * currentCandidates.length)];
    return true;
  }

  function slideRight() {
    // 把已展示的清除，重新拿新的
    const oldWord = targetWord;
    const hasMore = refreshCandidates(false);
    if (hasMore) return true;
    return false;
  }

  function updateInputBox() { inputBox.textContent = currentText; }

  function doSend() {
    if (currentPinyin && currentCandidates.length > 0) currentText += currentCandidates[0];
    if (currentText.trim()) {
      if (window.chatAddIn) window.chatAddIn(currentText, { isOut: true, isPinyinKb: true });
    }
    currentText = "";
    currentPinyin = "";
    refreshCandidates(true);
    updateInputBox();
  }

  // ==========================================
  // 任务队列控制
  // ==========================================
  function pushTask(task) {
    if (!isFeatureOn) return;
    taskQueue.push(task);
    processQueue();
  }

  function processQueue() {
    if (isTypingTask || taskQueue.length === 0) return; // 正在跑或者没任务
    
    isTypingTask = true;
    const task = taskQueue.shift();

    if (task.type === 'media') {
      // 图片或表情包直接瞬间发送
      if (window.originalChatAddIn) window.originalChatAddIn(task.text, task.opts);
      setTimeout(() => {
        isTypingTask = false;
        processQueue();
      }, 1000); // 隔1秒发下一个
    } else if (task.type === 'text') {
      // 文字任务，弹出键盘打字
      panel.hidden = false;
      startTyping();
    }
  }

  function finishTask() {
    clearTimeout(autoTimer);
    clearTimeout(tenMinTimer);
    isTypingTask = false;
    panel.hidden = true;
    // 稍作停顿后执行下一个任务
    setTimeout(processQueue, 800);
  }

  // ==========================================
  // 拦截器 (Hook)
  // ==========================================
  window.originalChatAddIn = window.chatAddIn;
  window.chatAddIn = function(text, opts) {
    // 如果拼音键盘发出的，放行
    if (opts && opts.isPinyinKb) return window.originalChatAddIn.apply(this, arguments);
    
    // 如果总开关没开，放行
    if (!isFeatureOn) return window.originalChatAddIn.apply(this, arguments);

    // 判断系统动作/多媒体
    const isUser = opts && opts.isOut === true;
    const isSystem = opts && (opts.special || opts.system || opts.isSystem);
    const isMedia = opts && (opts.img || opts.type === 'voice' || opts.type === 'image' || opts.type === 'sticker');

    // 如果正在打字（防冲突）或者已经是用户发的，或者系统动作，直接放行
    if (isTypingTask || isUser || isSystem) {
      return window.originalChatAddIn.apply(this, arguments);
    }

    // 走到这里，说明是原系统的"字卡文字"或"多媒体"，我们拦截它并入队
    if (isMedia) {
      pushTask({ type: 'media', text: text, opts: opts });
    } else {
      pushTask({ type: 'text', text: text, opts: opts });
    }

    return null; // 拦截原文字，交给队列
  };

})();