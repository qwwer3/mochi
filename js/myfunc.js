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
  // 两条路径，取并集，不自动回退：
  //   路径 1 · 整拼音前缀匹配（原逻辑，保留）：如 "pengyouquan" 直接用 "pyq" 的 T9 展开去试
  //   路径 2 · 首字母前缀匹配（新增）：把 "pengyouquan" 切成 peng/you/quan → 首字母 "pyq"，用 T9 展开去试
  function matchPool(prefix) {
    if (!prefix) return [];
    const dict = window.PY_DICT || {};
    if (Object.keys(dict).length === 0) return [];

    // 展开单个字符为 T9 字符集：
    //   数字 "7"  → 查 T9_MAP["7"] = "pqrs"
    //   字母 "p"  → 反查 T9_MAP，找到 "pqrs"
    //   其他     → 原样
    function expandChar(ch) {
      if (window.T9_MAP && window.T9_MAP[ch]) return window.T9_MAP[ch];
      if (window.T9_MAP) {
        for (const d in window.T9_MAP) {
          if (window.T9_MAP[d].indexOf(ch) >= 0) return window.T9_MAP[d];
        }
      }
      return ch;
    }

    // 构造 T9 正则：prefix 每一位 → [对应字母集]
    let regexStr = "^";
    for (let i = 0; i < prefix.length; i++) {
      regexStr += "[" + expandChar(prefix.charAt(i)) + "]";
    }
    let reg = null;
    try { reg = new RegExp(regexStr); } catch (e) { return []; }
    const prefixLen = prefix.length;

    // 拼音音节表（约 400 个，最长音节 6 位如 zhuang/shuang/chuang），首次调用时缓存
    const SYLL = matchPool._SYLL || (matchPool._SYLL = (function () {
      const s = 'a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu '
        + 'ca cai can cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo '
        + 'da dai dan dang dao de dei deng di dian diao die ding diu dong dou du duan dui dun duo '
        + 'e ei en eng er fa fan fang fei fen feng fo fou fu '
        + 'ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo '
        + 'ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo '
        + 'ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun '
        + 'ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo '
        + 'la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu lv luan lue lve lun luo '
        + 'ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu '
        + 'na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nv nuan nue nve nuo '
        + 'o ou pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu '
        + 'qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun '
        + 'ran rang rao re ren reng ri rong rou ru ruan rui run ruo '
        + 'sa sai san sang sao se sen seng sha shai shan shang shao she shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo '
        + 'ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo '
        + 'wa wai wan wang wei wen weng wo wu '
        + 'xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun '
        + 'ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun '
        + 'za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo';
      const set = new Set();
      s.split(' ').forEach(function (x) { if (x) set.add(x); });
      return set;
    })());

    // 拼音串 → 每音节首字母拼接（DP 最少音节切分，尽量选音节少的切法）
    // 例：pengyouquan → peng/you/quan → "pyq"；nihao → ni/hao → "nh"
    // 无法切分返回 null
    function initialsOf(py) {
      if (matchPool._iniCache && py in matchPool._iniCache) {
        return matchPool._iniCache[py];
      }
      const n = py.length;
      const dp = new Array(n + 1).fill(Infinity);
      const prev = new Array(n + 1).fill(-1);
      dp[0] = 0;
      for (let i = 0; i < n; i++) {
        if (dp[i] === Infinity) continue;
        for (let len = 6; len >= 1; len--) {   // 最长音节 zhuang=6，从长到短
          if (i + len > n) continue;
          if (!SYLL.has(py.slice(i, i + len))) continue;
          if (dp[i + len] > dp[i] + 1) {
            dp[i + len] = dp[i] + 1;
            prev[i + len] = i;
          }
        }
      }
      let out = null;
      if (dp[n] !== Infinity) {
        const segs = [];
        let pos = n;
        while (pos > 0) {
          const p = prev[pos];
          segs.unshift(py.slice(p, pos));
          pos = p;
        }
        out = segs.map(function (x) { return x.charAt(0); }).join('');
      }
      if (!matchPool._iniCache) matchPool._iniCache = {};
      matchPool._iniCache[py] = out;
      return out;
    }

    const pool = [];
    for (const py in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, py)) continue;
      if (!/^[a-z]+$/.test(py)) continue;         // 防御：跳过非纯小写字母键
      const words = dict[py];
      if (!Array.isArray(words) || words.length === 0) continue;

      let hit = false;

      // 路径 1 · 整拼音前缀匹配（原逻辑）
      if (reg.test(py)) hit = true;

      // 路径 2 · 首字母前缀匹配（新增）
      if (!hit) {
        const ini = initialsOf(py);
        if (ini && ini.length >= prefixLen) {
          if (reg.test(ini.slice(0, prefixLen))) hit = true;
        }
      }

      if (hit) {
        for (let j = 0; j < words.length; j++) {
          if (pool.indexOf(words[j]) < 0) pool.push(words[j]);
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
