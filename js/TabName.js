// TabName
(function() {
    'use strict';

    // ========== 配置区域（按需修改）==========
    const config = {
        // 用户离开时显示的标题（随机显示）
        leaveMessages: [
            '这里万籁俱寂……太安静了。别留下我。'
        ],
        // 用户回来时显示的标题（可选，留空则恢复原标题）
        returnMessage: '我知道我们会再次相见',
        // 检查频率（毫秒），建议不要改太小
        checkInterval: 200,
        // 是否启用控制台输出（调试用）
        debug: false
    };
    // ========== 配置结束 ==========

    let originalTitle = document.title;
    let timer = null;
    let isAway = false;

    function log(msg) {
        if (config.debug) console.log('[FunnyTitle]', msg);
    }

    function setTitle(title) {
        document.title = title;
        log('标题已更改为: ' + title);
    }

    // 获取随机离开信息
    function getRandomLeaveMessage() {
        if (!config.leaveMessages.length) return '🔙 快回来吧~';
        const randomIndex = Math.floor(Math.random() * config.leaveMessages.length);
        return config.leaveMessages[randomIndex];
    }

    // 页面可见性变化处理
    function handleVisibilityChange() {
        if (document.hidden) {
            // 用户离开页面
            if (!isAway) {
                isAway = true;
                const leaveMsg = getRandomLeaveMessage();
                setTitle(leaveMsg);
                log('检测到用户离开页面');
            }
        } else {
            // 用户回来
            if (isAway) {
                isAway = false;
                const newTitle = config.returnMessage ? config.returnMessage : originalTitle;
                setTitle(newTitle);
                log('检测到用户回来');
                // 延时恢复原标题（optional）
                if (config.returnMessage) {
                    setTimeout(() => {
                        if (!document.hidden) {
                            setTitle(originalTitle);
                        }
                    }, 1500);
                }
            }
        }
    }

    // 获取原始标题（防止后续被修改）
    function getOriginalTitle() {
        return document.title;
    }

    // 主动检查焦点（兼容性增强）
    function checkFocus() {
        if (!document.hasFocus && !document.hidden) return;
        if (document.hasFocus && document.hasFocus()) {
            if (isAway) {
                isAway = false;
                setTitle(originalTitle);
                log('通过焦点检测到用户回来');
            }
        }
    }

    // 初始化
    function init() {
        originalTitle = getOriginalTitle();
        log('初始化完成，原始标题：' + originalTitle);

        // 监听页面可见性变化（现代浏览器标准方式）
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 备用：监听窗口焦点
        window.addEventListener('focus', function() {
            if (isAway && !document.hidden) {
                isAway = false;
                setTitle(originalTitle);
                log('通过窗口焦点检测到用户回来');
            }
        });

        window.addEventListener('blur', function() {
            if (!isAway && document.hidden === undefined) {
                // 对于不支持 visibility API 的老旧浏览器
                isAway = true;
                setTitle(getRandomLeaveMessage());
                log('窗口失去焦点');
            }
        });

        // 定期检查（可选，增加可靠性）
        if (config.checkInterval > 0) {
            setInterval(checkFocus, config.checkInterval);
        }
    }

    // 如果页面已加载完成则立即执行，否则等待
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();