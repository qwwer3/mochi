(function () {
  window.T9_MAP = { "2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz" };

  // ========== 内置保底字典（约 70 个拼音 / 130+ 字词） ==========
  var FALLBACK = {
    "ni": ["你", "尼", "泥", "妮", "呢"],
    "hao": ["好", "号", "毫", "豪", "浩"],
    "nihao": ["你好"],
    "wo": ["我", "窝", "握", "卧"],
    "women": ["我们"],
    "xiang": ["想", "像", "香", "箱", "响", "乡"],
    "le": ["了", "乐", "勒"],
    "ma": ["吗", "妈", "马", "骂", "码"],
    "de": ["的", "得", "地", "德"],
    "shi": ["是", "事", "时", "使", "市", "世", "式", "实"],
    "yi": ["一", "以", "已", "意", "义", "衣", "医"],
    "bu": ["不", "部", "步", "布", "补"],
    "you": ["有", "又", "友", "右", "油", "由"],
    "zai": ["在", "再", "载", "灾"],
    "ren": ["人", "认", "任", "仁"],
    "zhong": ["中", "种", "重", "钟", "众"],
    "guo": ["国", "过", "果", "郭", "锅"],
    "da": ["大", "打", "达", "答"],
    "shang": ["上", "商", "尚", "伤"],
    "xia": ["下", "夏", "吓"],
    "lai": ["来", "赖", "莱"],
    "qu": ["去", "区", "取", "趣"],
    "dao": ["到", "道", "倒", "刀"],
    "shuo": ["说"],
    "hui": ["会", "回", "汇", "灰", "惠"],
    "mei": ["没", "美", "每", "梅", "妹"],
    "tian": ["天", "田", "填", "甜"],
    "hen": ["很", "狠", "恨", "痕"],
    "duo": ["多", "夺", "朵", "躲"],
    "shao": ["少", "烧", "绍"],
    "kan": ["看", "刊", "堪"],
    "ting": ["听", "停", "庭", "挺"],
    "xie": ["写", "谢", "些", "鞋", "协"],
    "xiexie": ["谢谢"],
    "zaijian": ["再见"],
    "duibuqi": ["对不起"],
    "meiguanxi": ["没关系"],
    "woaini": ["我爱你"],
    "ai": ["爱", "哎", "挨"],
    "ta": ["他", "她", "它", "塔"],
    "men": ["们", "门", "闷"],
    "ge": ["个", "各", "歌", "哥", "格"],
    "yong": ["用", "永", "拥", "勇"],
    "he": ["和", "喝", "合", "河", "何"],
    "xi": ["系", "西", "希", "细", "喜", "戏", "吸"],
    "zuo": ["做", "作", "坐", "左", "昨"],
    "gei": ["给"],
    "shangban": ["上班"],
    "xiaban": ["下班"],
    "chifan": ["吃饭"],
    "shuijiao": ["睡觉"],
    "xuexi": ["学习"],
    "gongzuo": ["工作"],
    "shenghuo": ["生活"],
    "pengyou": ["朋友"],
    "jiaren": ["家人"],
    "tongxue": ["同学"],
    "laoshi": ["老师"],
    "xiansheng": ["先生"],
    "xiaojie": ["小姐"],
    "xiongdi": ["兄弟"],
    "jiemei": ["姐妹"],
    "baobao": ["宝宝", "抱抱"],
    "qin": ["亲", "勤", "琴"],
    "qinai": ["亲爱"],
    "xihuan": ["喜欢"],
    "juede": ["觉得"],
    "zhidao": ["知道"],
    "mingbai": ["明白"],
    "lihai": ["厉害"],
    "kuaile": ["快乐"],
    "xingfu": ["幸福"],
    "kaixin": ["开心"],
    "nanguo": ["难过"],
    "shengqi": ["生气"],
    "keai": ["可爱"]
  };

  // 先把保底字典挂上，保证首帧就有东西用
  window.PY_DICT = FALLBACK;

  // ========== 异步从 CDN 拉完整词库，覆盖保底 ==========
  fetch('https://cdn.jsdelivr.net/gh/zh-lx/pinyin-pro@3.19.0/data/dict.json')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      var merged = {};
      // 合并保底（保底在前，优先展示常用词）
      for (var k in FALLBACK) { if (Object.prototype.hasOwnProperty.call(FALLBACK, k)) merged[k] = FALLBACK[k].slice(); }
      for (var word in data) {
        var pinyin = data[word];
        if (!pinyin || word.length > 3) continue;
        var cleanPy = String(pinyin).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        if (!cleanPy) continue;
        if (!merged[cleanPy]) merged[cleanPy] = [];
        if (merged[cleanPy].indexOf(word) < 0 && merged[cleanPy].length < 20) merged[cleanPy].push(word);
      }
      window.PY_DICT = merged;
    })
    .catch(function (err) {
      console.warn('拼音词库拉取失败，使用内置保底字典', err);
    });
})();
