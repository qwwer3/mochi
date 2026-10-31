(function() {
  window.T9_MAP = { "2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz" };
  window.PY_DICT = { "ni": ["你"], "hao": ["好"], "wo": ["我"], "xiang": ["想"], "le": ["了"], "ma": ["吗"] };

  // 拉取海量开源词库
  fetch('https://cdn.jsdelivr.net/gh/zh-lx/pinyin-pro@3.19.0/data/dict.json')
    .then(res => res.json())
    .then(data => {
      const newDict = {};
      for (let word in data) {
        const pinyin = data[word];
        if (word.length <= 3 && pinyin) {
          const cleanPy = pinyin.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          if (!newDict[cleanPy]) newDict[cleanPy] = [];
          if (newDict[cleanPy].length < 20) newDict[cleanPy].push(word);
        }
      }
      window.PY_DICT = newDict;
    }).catch(err => console.warn('词库拉取失败，使用保底词库', err));
})();