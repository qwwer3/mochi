(function () {
  'use strict';
  console.log('[拼音频率] 启动，fetch ./pinyin-freq.txt ...');

  var URL = './pinyin-freq.txt';
  var START = Date.now();

  function cleanPy(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[0-9]/g, '')
      .replace(/\s+/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function splitLine(line) {
    var parts = line.split('\t');
    if (parts.length >= 3) return parts;
    return line.split(/[ \u3000]+/);
  }

  fetch(URL + '?v=' + Date.now(), { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      console.log('[拼音频率] 文本已获取，长度 ' + text.length + ' 字符，开始解析…');

      var PY_FREQ = {};
      var PY_FREQ_DICT = {};
      var lines = text.split('\n');
      var totalLines = lines.length;
      var okCount = 0, skipCount = 0;

      for (var i = 0; i < totalLines; i++) {
        var line = lines[i];
        if (!line) continue;
        if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
        line = line.trim();
        if (!line) continue;
        if (line.charAt(0) === '#') continue;

        var parts = splitLine(line);
        if (parts.length < 3) { skipCount++; continue; }

        var word = String(parts[0] || '').trim();
        var py = cleanPy(parts[1] || '');
        var freq = parseInt(parts[2], 10);

        if (!word || !py || !/^[a-z]+$/.test(py) || isNaN(freq)) {
          skipCount++;
          continue;
        }

        if (!PY_FREQ[word] || PY_FREQ[word] < freq) PY_FREQ[word] = freq;

        if (!PY_FREQ_DICT[py]) PY_FREQ_DICT[py] = [];
        PY_FREQ_DICT[py].push({ w: word, f: freq });
        okCount++;
      }
      lines = null;

      console.log('[拼音频率] 解析完成：成功 ' + okCount + ' 行，跳过 ' + skipCount + ' 行');

      var groupCount = 0;
      for (var py2 in PY_FREQ_DICT) {
        if (!Object.prototype.hasOwnProperty.call(PY_FREQ_DICT, py2)) continue;
        var arr = PY_FREQ_DICT[py2];
        var map = {};
        for (var m = 0; m < arr.length; m++) {
          var w = arr[m].w;
          if (!map[w] || map[w] < arr[m].f) map[w] = arr[m].f;
        }
        var uniq = [];
        for (var w2 in map) {
          if (Object.prototype.hasOwnProperty.call(map, w2)) {
            uniq.push({ w: w2, f: map[w2] });
          }
        }
        uniq.sort(function (a, b) { return b.f - a.f; });
        PY_FREQ_DICT[py2] = uniq;
        groupCount++;
      }

      window.PY_FREQ = PY_FREQ;
      window.PY_FREQ_DICT = PY_FREQ_DICT;
      window.__pinyinFreqReady = true;

      var cost = Date.now() - START;
      console.log('[拼音频率] 完成：' + groupCount + ' 个拼音组，' + okCount + ' 条词，耗时 ' + cost + 'ms');

      ['a', 'ai', 'ni', 'de', 'pengyouquan'].forEach(function (k) {
        if (PY_FREQ_DICT[k]) {
          console.log('  ' + k + ' 组前 3：' + PY_FREQ_DICT[k].slice(0, 3).map(function (x) {
            return x.w + '(' + x.f + ')';
          }).join(' / '));
        }
      });
    })
    .catch(function (err) {
      console.error('[拼音频率] 加载失败：', err && err.message || err);
    });
})();
