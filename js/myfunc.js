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

  function matchPool(prefix) {
    if (!prefix) return [];

    var freqReady = !!window.__pinyinFreqReady;
    if (matchPool._lastFreqReady !== freqReady) {
      matchPool._cache = {};
      matchPool._lastFreqReady = freqReady;
    }
    if (!matchPool._cache) matchPool._cache = {};
    if (matchPool._cache[prefix]) return matchPool._cache[prefix];

    var useFreq = !!(freqReady && window.PY_FREQ_DICT);
    var dict = useFreq ? window.PY_FREQ_DICT : (window.PY_DICT || {});
    if (Object.keys(dict).length === 0) return [];

    function expandChar(ch) {
      if (window.T9_MAP && window.T9_MAP[ch]) return window.T9_MAP[ch];
      if (window.T9_MAP) {
        for (var d in window.T9_MAP) {
          if (window.T9_MAP[d].indexOf(ch) >= 0) return window.T9_MAP[d];
        }
      }
      return ch;
    }

    var regexStr = "^";
    for (var i = 0; i < prefix.length; i++) {
      regexStr += "[" + expandChar(prefix.charAt(i)) + "]";
    }
    var reg = null;
    try { reg = new RegExp(regexStr); } catch (e) { return []; }
    var prefixLen = prefix.length;

    var SYLL = matchPool._SYLL || (matchPool._SYLL = (function () {
      var s = 'a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu '
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
      var set = new Set();
      s.split(' ').forEach(function (x) { if (x) set.add(x); });
      return set;
    })());

    function initialsOf(py) {
      if (matchPool._iniCache && py in matchPool._iniCache) return matchPool._iniCache[py];
      var n = py.length;
      var dp = new Array(n + 1).fill(Infinity);
      var prev = new Array(n + 1).fill(-1);
      dp[0] = 0;
      for (var i2 = 0; i2 < n; i2++) {
        if (dp[i2] === Infinity) continue;
        for (var len = 6; len >= 1; len--) {
          if (i2 + len > n) continue;
          if (!SYLL.has(py.slice(i2, i2 + len))) continue;
          if (dp[i2 + len] > dp[i2] + 1) {
            dp[i2 + len] = dp[i2] + 1;
            prev[i2 + len] = i2;
          }
        }
      }
      var out = null;
      if (dp[n] !== Infinity) {
        var segs = [];
        var pos = n;
        while (pos > 0) {
          var p = prev[pos];
          segs.unshift(py.slice(p, pos));
          pos = p;
        }
        out = segs.map(function (x) { return x.charAt(0); }).join('');
      }
      if (!matchPool._iniCache) matchPool._iniCache = {};
      matchPool._iniCache[py] = out;
      return out;
    }

    // 收集所有命中，分「单字组」和「词组组」
    var singles = [];
    var multiples = [];
    var seen = new Set();

    for (var py3 in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, py3)) continue;
      if (!/^[a-z]+$/.test(py3)) continue;
      var arr = dict[py3];
      if (!arr || arr.length === 0) continue;

      var hit = reg.test(py3);
      if (!hit) {
        var ini = initialsOf(py3);
        if (ini && ini.length >= prefixLen && reg.test(ini.slice(0, prefixLen))) hit = true;
      }
      if (!hit) continue;

      for (var j = 0; j < arr.length; j++) {
        var item = arr[j];
        var w, f;
        if (typeof item === 'string') {
          w = item;
          f = Math.max(0, 10000 - j * 10);   // 兜底模式：用数组位置倒推分数
        } else if (item && typeof item === 'object' && item.w) {
          w = item.w;
          f = item.f || 0;
        } else {
          continue;
        }
        if (!w) continue;
        if (seen.has(w)) continue;
        seen.add(w);
        if (w.length === 1) {
          singles.push({ w: w, f: f });
        } else {
          multiples.push({ w: w, f: f });
        }
      }
    }

    singles.sort(function (a, b) { return b.f - a.f; });
    multiples.sort(function (a, b) { return b.f - a.f; });

    var result = [];

    if (!useFreq) {
      // 兜底路径（freq 加载失败时）：混排所有命中，保持原行为
      result = singles.concat(multiples);
      result.sort(function (a, b) { return b.f - a.f; });
    } else if (singles.length === 0) {
      // 规则 2B：没匹配到任何单字 → 全部词组按频率降序
      result = multiples;
    } else if (singles.length >= 6) {
      // 规则 2A：单字 ≥ 6 → 单字 + 高频词组（f > 50000），混排
      var high = [];
      for (var h = 0; h < multiples.length; h++) {
        if (multiples[h].f > 50000) high.push(multiples[h]);
      }
      result = singles.concat(high);
      result.sort(function (a, b) { return b.f - a.f; });
    } else {
      // 规则 3：0 < 单字 < 6 → 单字 + 高频词组，不够 6 个时用低频词组补
      var high2 = [];
      var low2 = [];
      for (var h2 = 0; h2 < multiples.length; h2++) {
        if (multiples[h2].f > 50000) high2.push(multiples[h2]);
        else low2.push(multiples[h2]);
      }
      var merged = singles.concat(high2);
      if (merged.length < 6 && low2.length > 0) {
        var need = 6 - merged.length;
        merged = merged.concat(low2.slice(0, need));
      }
      merged.sort(function (a, b) { return b.f - a.f; });
      result = merged;
    }

    var pool = result.slice(0, 50).map(function (x) { return x.w; });

    var cacheSize = 0;
    for (var ck in matchPool._cache) {
      if (Object.prototype.hasOwnProperty.call(matchPool._cache, ck)) cacheSize++;
    }
    if (cacheSize > 200) matchPool._cache = {};
    matchPool._cache[prefix] = pool;

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
    }, 10000);
  }

  // ===== 动作二 =====
  function step2() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      Math.random() < 0.7 ? step4() : step3();
    }, 8000);
  }

  // ===== 动作三 =====
  function step3() {
    if (!isTypingTask) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (Math.random() < 0.7) step4();
      else { slideRight() ? step3() : step4(); }
    }, 7000);
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
