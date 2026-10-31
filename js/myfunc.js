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
        t