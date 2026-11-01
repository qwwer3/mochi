(function(){
  const btn = document.getElementById('more-pinyinkb');
  if (btn) {
    btn.addEventListener('click', () => {
      if (window.toast) window.toast('测试：总开关已点击！');
    });
  }

  // 强力拦截并弹窗提示
  const originalChatAddIn = window.chatAddIn;
  if (originalChatAddIn) {
    window.chatAddIn = function(text, opts) {
      // 如果我们自己发的，直接放行
      if (opts && opts.isPinyinKb) return originalChatAddIn.apply(this, arguments);
      
      // 拦截到别人的消息，弹个警告框让你看到
      alert('【抓到了！】原系统想发消息：\n' + text + '\n参数：' + JSON.stringify(opts || {}));
      
      return null; // 强行拦截，不让字卡发出来
    };
  } else {
    setTimeout(() => {
        if (window.chatAddIn) {
            alert('注意：chatAddIn 是在页面加载后才出现的！');
        } else {
            alert('致命错误：根本没有找到 window.chatAddIn 这个函数！');
        }
    }, 3000);
  }
})();
