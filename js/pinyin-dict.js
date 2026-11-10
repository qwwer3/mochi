(function () {
  // ===== 第一行日志：确认这份文件真的被执行了 =====
  console.log('[拼音词库] 📦 文件已加载，版本 2024-11-03-A');
  window.__pinyinDictVersion = '2024-11-03-A';

  window.T9_MAP = { "2": "abc", "3": "def", "4": "ghi", "5": "jkl",
                    "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz" };

  // ========== 内置保底 ==========
  var FALLBACK = {
    "ni": ["你", "尼", "泥", "妮", "呢"],
    "o": ["哦"],
    "oo": ["哦哦"],
    "mm": ["摸摸"],
    "hao": ["好", "号", "毫", "豪", "浩"],
    "wo": ["我", "窝", "握", "卧"],
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
    "xiang": ["想", "像", "香", "箱", "响", "乡"],
    "ai": ["爱", "哎", "挨"],
    "ta": ["他", "她", "它", "塔"],
    "men": ["们", "门", "闷"],
    "ge": ["个", "各", "歌", "哥", "格"],
    "yong": ["用", "永", "拥", "勇"],
    "he": ["和", "喝", "合", "河", "何"],
    "xi": ["系", "西", "希", "细", "喜", "戏", "吸"],
    "zuo": ["做", "作", "坐", "左", "昨"],
    "gei": ["给"],
    "qin": ["亲", "勤", "琴"],
    "nihao": ["你好"],
    "women": ["我们"],
    "xiexie": ["谢谢"],
    "zaijian": ["再见"],
    "duibuqi": ["对不起"],
    "meiguanxi": ["没关系"],
    "woaini": ["我爱你"],
    "xiangni": ["想你"],
    "aini": ["爱你"],
    "baoqian": ["抱歉"],
    "ganxie": ["感谢"],
    "zhufu": ["祝福"],
    "wenhou": ["问候"],
    "huaian": ["怀念"],
    "guannian": ["挂念"],
    "peiban": ["陪伴"],
    "guanxin": ["关心"],
    "tiexin": ["贴心"],
    "tihui": ["体会"],
    "ganjue": ["感觉"],
    "ganqing": ["感情"],
    "xinqing": ["心情"],
    "xinteng": ["心疼"],
    "xinsuan": ["心酸"],
    "xindong": ["心动"],
    "jiayou": ["加油"],
    "haojiu": ["好久"],
    "zaoan": ["早安"],
    "wanan": ["晚安"],
    "baibai": ["拜拜"],
    "yongyuan": ["永远"],
    "yisheng": ["一生"],
    "yihui": ["一会"],
    "dengdai": ["等待"],
    "xiaci": ["下次"],
    "zaiyiqi": ["在一起"],
    "xiexieni": ["谢谢你"],
    "baochi": ["保持"],
    "lianxi": ["联系"],
    "xiangqi": ["想起"],
    "xiangdao": ["想到"],
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
    "keai": ["可爱"],
    "xiangnile": ["想你了"],
    "zaodianshui": ["早点睡"],
    "duoheshui": ["多喝水"],
    "zaodianxiuxi": ["早点休息"],
    "zhuyishenti": ["注意身体"],
    "haohaozhaogu": ["好好照顾"],
    "zhaoguhao": ["照顾好"],
    "zhaoguhaoziji": ["照顾好自己"],
    "xiangnilene": ["想你了呢"],
    "shenmeshihou": ["什么时候"],
    "weishenmea": ["为什么啊"],
    "zhendema": ["真的吗"],
    "shengqile": ["生气了"],
    "kaixinma": ["开心吗"],
    "xingfuma": ["幸福吗"],
     // ---------- 语气词 / 高频单字 ----------
    "a": ["啊", "阿", "吖"],
    "o": ["哦", "噢", "喔"],
    "e": ["饿", "额", "鹅", "恶", "呃"],
    "en": ["嗯", "恩"],
    "er": ["二", "儿", "而", "耳", "尔"],
    "yo": ["哟"],
    "ya": ["呀", "压", "牙", "鸭", "亚", "雅", "哑"],
    "ne": ["呢"],
    "me": ["么"],
    "ba": ["吧", "把", "八", "爸", "拔", "罢"],
    "la": ["啦", "拉", "辣", "蜡", "垃"],
    "ma": ["吗", "嘛", "妈", "马", "骂", "码", "麻"],
    "ha": ["哈", "蛤"],
    "hei": ["黑", "嘿"],
    "ai": ["爱", "哎", "挨", "唉", "矮"],
    "ou": ["偶", "欧", "呕", "殴"],

    // ---------- 高频动词 / 状态 ----------
    "chi": ["吃", "迟", "池", "尺", "持", "赤"],
    "he": ["和", "喝", "合", "河", "何", "盒", "荷", "核"],
    "shui": ["水", "睡", "谁", "税"],
    "zou": ["走", "揍", "奏"],
    "pao": ["跑", "泡", "炮", "抛"],
    "zuo": ["做", "作", "坐", "左", "昨", "座"],
    "zhan": ["站", "占", "战", "展", "沾", "盏", "斩"],
    "tang": ["躺", "堂", "糖", "汤", "烫", "唐", "塘"],
    "kan": ["看", "刊", "堪", "砍"],
    "ting": ["听", "停", "庭", "挺", "厅", "亭"],
    "shuo": ["说", "硕"],
    "wen": ["问", "文", "闻", "稳", "温", "吻", "蚊"],
    "da": ["大", "打", "达", "答", "搭"],
    "na": ["那", "拿", "哪", "纳", "呐"],
    "gei": ["给"],
    "song": ["送", "松", "宋", "颂"],
    "mai": ["买", "卖", "麦", "迈", "埋"],
    "huan": ["换", "还", "环", "欢", "缓", "患"],
    "zhao": ["找", "照", "招", "着", "赵", "召", "兆", "罩"],
    "deng": ["等", "灯", "登", "凳"],
    "bang": ["帮", "棒", "榜", "邦", "绑"],
    "gao": ["高", "告", "搞", "糕", "稿"],
    "nong": ["弄", "农", "浓"],
    "xiu": ["修", "休", "秀", "袖", "羞", "锈"],
    "wan": ["完", "玩", "晚", "万", "弯", "碗", "湾", "顽"],
    "kai": ["开", "凯"],
    "guan": ["关", "管", "观", "官", "惯", "馆"],
    "dai": ["带", "待", "袋", "呆", "戴", "代"],
    "fang": ["放", "房", "方", "防", "仿", "访"],
    "shou": ["手", "收", "受", "首", "守", "瘦", "兽", "售"],

    // ---------- 时间 / 天气 ----------
    "jintian": ["今天"],
    "mingtian": ["明天"],
    "zuotian": ["昨天"],
    "houtian": ["后天"],
    "qiantian": ["前天"],
    "xianzai": ["现在"],
    "yihuir": ["一会儿", "一会"],
    "yizhi": ["一直"],
    "yiding": ["一定"],
    "yiqi": ["一起"],
    "yixia": ["一下"],
    "yidian": ["一点"],
    "yijing": ["已经"],
    "zhengzai": ["正在"],
    "ganggang": ["刚刚"],
    "mashang": ["马上"],
    "zhongyu": ["终于"],
    "qishi": ["其实"],
    "dangran": ["当然"],
    "yexu": ["也许"],
    "kending": ["肯定"],
    "xingqi": ["星期"],
    "xingqiyi": ["星期一"],
    "xingqier": ["星期二"],
    "xingqisan": ["星期三"],
    "xingqisi": ["星期四"],
    "xingqiwu": ["星期五"],
    "xingqiliu": ["星期六"],
    "xingqitian": ["星期天", "星期日"],
    "zaoshang": ["早上"],
    "shangwu": ["上午"],
    "zhongwu": ["中午"],
    "xiawu": ["下午"],
    "wanshang": ["晚上"],
    "bantian": ["半天"],
    "tianqi": ["天气"],
    "xiayu": ["下雨"],
    "xiaxue": ["下雪"],
    "chutaiyang": ["出太阳"],
    "haoleng": ["好冷"],
    "haore": ["好热"],
    "liangkuai": ["凉快"],

    // ---------- 吃喝 ----------
    "chifan": ["吃饭"],
    "chifanle": ["吃饭了"],
    "chishenme": ["吃什么"],
    "hecha": ["喝茶"],
    "heshui": ["喝水"],
    "hekafei": ["喝咖啡"],
    "hejiu": ["喝酒"],
    "zaocan": ["早餐"],
    "wucan": ["午餐"],
    "wancan": ["晚餐"],
    "yexiao": ["夜宵"],
    "haochi": ["好吃"],
    "haole": ["好了"],
    "maidan": ["买单", "埋单"],
    "diancai": ["点菜"],
    "waimai": ["外卖"],
    "miantiao": ["面条"],
    "mifan": ["米饭"],
    "jiaozi": ["饺子"],
    "huoguo": ["火锅"],
    "shuiguo": ["水果"],

    // ---------- 睡眠 / 身体 ----------
    "shuijiao": ["睡觉"],
    "qichuang": ["起床"],
    "zaoshui": ["早睡"],
    "wuan": ["晚安"],
    "zuomeng": ["做梦"],
    "shengbing": ["生病"],
    "touteng": ["头疼"],
    "fashao": ["发烧"],
    "ganmao": ["感冒"],
    "yiyuan": ["医院"],
    "chiyao": ["吃药"],
    "duoheshui": ["多喝水"],
    "zhuyishenti": ["注意身体"],
    "haohaoxiuxi": ["好好休息"],

    // ---------- 情感 / 社交 ----------
    "xiangni": ["想你"],
    "haoxiangni": ["好想你"],
    "xiangsinile": ["想死你了"],
    "haoxihuan": ["好喜欢"],
    "taihaole": ["太好了"],
    "bangjile": ["棒极了"],
    "meiwenti": ["没问题"],
    "meiguanxi": ["没关系"],
    "bukeyi": ["不可以"],
    "keyi": ["可以"],
    "buzhidao": ["不知道"],
    "zhidaole": ["知道了"],
    "mingbaile": ["明白了"],
    "haode": ["好的"],
    "duide": ["对的"],
    "cuole": ["错了"],
    "meishi": ["没事"],
    "biekeqi": ["别客气"],
    "buxing": ["不行"],
    "fangxin": ["放心"],
    "bieku": ["别哭"],
    "biepa": ["别怕"],
    "nuli": ["努力"],
    "xinku": ["辛苦", "辛苦"],
    "xinkule": ["辛苦了"],
    "dianhua": ["电话"],
    "dadianhua": ["打电话"],
    "xinxi": ["信息"],
    "xiaoxi": ["消息"],
    "huifu": ["回复"],
    "shoudao": ["收到"],
    "kanjian": ["看见"],
    "tingdao": ["听到"],
    "fasong": ["发送"],
    "dengni": ["等你"],
    "xiangjian": ["想见"],
    "jianmian": ["见面"],

    // ---------- 居家 / 出行 ----------
    "huijia": ["回家"],
    "chumen": ["出门"],
    "shangxue": ["上学"],
    "fangxue": ["放学"],
    "kaiche": ["开车"],
    "zuoche": ["坐车"],
    "dache": ["打车"],
    "ditie": ["地铁"],
    "gongjiao": ["公交"],
    "feiji": ["飞机"],
    "huoche": ["火车"],
    "chuzuche": ["出租车"],
    "zixingche": ["自行车"],
    "lushang": ["路上"],
    "daole": ["到了"],
    "daolema": ["到了吗"],
    "chufale": ["出发了"],
    "mashangdao": ["马上到"],
    "yilupingan": ["一路平安"]
  };

  window.PY_DICT = FALLBACK;
  console.log('[拼音词库] 🔧 保底已挂载：' + Object.keys(FALLBACK).length + ' 个音节');

  // ========== 异步加载大词库（已停用：改用 freq-loader.js + pinyin-freq.txt） ==========
  // 原 pinyin-dict-data.json 不再加载；PY_DICT 保留 FALLBACK（80 个音节）作为兜底数据源
  if (false) {
    console.log('[拼音词库] 🌐 开始 fetch ./pinyin-dict-data.json ...');

    fetch('./pinyin-dict-data.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        console.log('[拼音词库] 📡 fetch 响应：HTTP ' + res.status + '，ok=' + res.ok);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        console.log('[拼音词库] 📄 json 已解析，键数：' + Object.keys(data).length);

        if (!data || typeof data !== 'object') throw new Error('词库不是对象');
        var keys = Object.keys(data);
        if (!keys.length) throw new Error('词库为空');

        var merged = {};
        for (var k in FALLBACK) {
          if (Object.prototype.hasOwnProperty.call(FALLBACK, k)) merged[k] = FALLBACK[k].slice();
        }

        var cleanPy = function (s) {
          return String(s || '').normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '');
        };

        var stats = { ok: 0, skip: 0, fail: 0 };

        keys.forEach(function (key) {
          var val = data[key];
          if (!val) { stats.skip++; return; }

          var keyIsPinyin = /^[a-z]+$/.test(key);
          var py, words;

          if (keyIsPinyin && Array.isArray(val)) {
            py = key; words = val;
          } else if (!keyIsPinyin && typeof val === 'string') {
            py = cleanPy(val); words = [key];
          } else if (!keyIsPinyin && Array.isArray(val) && val.length >= 2
                     && typeof val[0] === 'string' && typeof val[1] === 'number') {
            py = cleanPy(val[0]); words = [key];
          } else if (!keyIsPinyin && val && typeof val === 'object' && !Array.isArray(val)) {
            var pk = ['pinyin','py','value','v'].find(function (kk) {
              return typeof val[kk] === 'string';
            });
            if (pk) { py = cleanPy(val[pk]); words = [key]; }
            else { stats.skip++; return; }
          } else {
            stats.skip++; return;
          }

          if (!py || !/^[a-z]+$/.test(py)) { stats.fail++; return; }
          if (!merged[py]) merged[py] = [];
          for (var i = 0; i < words.length; i++) {
            var w = words[i];
            if (typeof w === 'string' && w && merged[py].indexOf(w) < 0 && merged[py].length < 20) {
              merged[py].push(w);
            }
          }
          stats.ok++;
        });

        window.PY_DICT = merged;
        var pyCount = Object.keys(merged).length;
        var wordCount = 0;
        for (var k2 in merged) wordCount += merged[k2].length;

        console.log('[拼音词库] ✅ 合并完成');
        console.log('   成功处理：' + stats.ok + ' 条');
        console.log('   跳过：' + stats.skip + ' 条');
        console.log('   拼音非法：' + stats.fail + ' 条');
        console.log('   👉 最终：' + pyCount + ' 个音节，' + wordCount + ' 个字词');
        console.log('   关键键验证：');
        ['a', 'ni', 'jintian', 'changcheng', 'gongzuo', 'nihao', 'xiangni'].forEach(function (kk) {
          console.log('      ' + kk + ':', merged[kk] ? merged[kk].slice(0, 3) : '(缺)');
        });
      })
      .catch(function (err) {
        console.error('[拼音词库] ❌ 加载失败：', err.message || err);
      });
  }
})();
