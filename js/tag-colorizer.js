/**
 * 标签颜色分配器 - 淡雅紫色系（完全随机版）
 * 每次刷新页面，标签颜色都会重新随机分配
 */

(function() {
    'use strict';

    // ============================================
    // 配色方案：淡雅紫色系（高对比度，颜色差异明显）
    // ============================================
    const colorPalette = [
        '#F5F0FF',  // 极淡紫白（近乎白色）
        '#EBE0FA',  // 浅紫白
        '#DDCCF5',  // 薰衣草白
        '#CFB8F0',  // 淡紫丁香
        '#C1A4EB',  // 浅紫罗兰
        '#B390E6',  // 紫罗兰
        '#A57CE0',  // 淡绮罗紫
        '#9768DB',  // 紫藤色
        '#8954D6',  // 中紫色
        '#7B40D0',  // 较深紫
        '#6D2CCB',  // 深紫色
        '#5F18C6'   // 紫罗兰深
    ];

    // 深色背景的文字颜色阈值
    const DARK_THRESHOLD = 140;

    // ============================================
    // 工具函数
    // ============================================

    /**
     * 随机打乱数组（Fisher-Yates 洗牌算法）
     */
    function shuffleArray(arr) {
        const array = [...arr];
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * 从色表中随机选取指定数量的颜色
     * @param {number} count - 需要的颜色数量
     * @returns {Array} 随机颜色数组
     */
    function getRandomColors(count) {
        // 如果颜色不够用，就重复使用色表
        if (count <= colorPalette.length) {
            // 随机打乱后取前 count 个
            const shuffled = shuffleArray(colorPalette);
            return shuffled.slice(0, count);
        } else {
            // 标签数量超过色表，需要重复使用颜色
            const result = [];
            for (let i = 0; i < count; i++) {
                const randomIndex = Math.floor(Math.random() * colorPalette.length);
                result.push(colorPalette[randomIndex]);
            }
            return result;
        }
    }

    /**
     * 根据背景色判断文字颜色
     */
    function getTextColor(bgColor) {
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        if (brightness > DARK_THRESHOLD) {
            return '#4A2A7A';  // 深紫色文字
        } else {
            return '#FFFFFF';  // 白色文字
        }
    }

    /**
     * 判断是否为浅色背景（用于添加边框）
     */
    function isLightColor(bgColor) {
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > DARK_THRESHOLD;
    }

    function getTagElements() {
        const selectors = [
            '.tag-cloud-list a',           // 标签云页面
            '.tag-cloud-tags a',           // 标签云（另一种）
            '.post-tags a',                // 文章内页标签
            '.card-tag-cloud a',           // 侧边栏标签卡片
            '.tag-list a'                  // 其他可能的位置
        ];
        
        let allTags = [];
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length) {
                allTags = [...allTags, ...elements];
            }
        });
        
        return allTags;
    }

    function applyTagColors() {
        const tags = getTagElements();
        
        if (!tags.length) {
            console.log('[Tag Colorizer] 未找到标签元素');
            return;
        }
        
        // 关键改动：随机为每个标签分配颜色
        // 为每个标签单独随机选择一个颜色
        tags.forEach(tag => {
            // 随机从色表中选一个颜色
            const randomIndex = Math.floor(Math.random() * colorPalette.length);
            const bgColor = colorPalette[randomIndex];
            const textColor = getTextColor(bgColor);
            const isLight = isLightColor(bgColor);
            const originalFontSize = tag.style.fontSize;
            
            // 浅色背景加细边框，深色背景不加
            const borderStyle = isLight ? `border: 1px solid ${bgColor} !important;` : 'border: none !important;';
            
            // 应用样式
            tag.setAttribute('style', 
                `background-color: ${bgColor} !important; ` +
                `color: ${textColor} !important; ` +
                `display: inline-block !important; ` +
                `padding: 4px 14px !important; ` +
                `margin: 4px 6px !important; ` +
                `border-radius: 24px !important; ` +
                `text-decoration: none !important; ` +
                `transition: all 0.25s ease !important; ` +
                `${borderStyle} ` +
                `font-size: ${originalFontSize || '1em'} !important; ` +
                `box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;`
            );
            
            // 悬浮效果
            tag.addEventListener('mouseenter', function() {
                this.style.opacity = '0.85';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 12px rgba(101, 48, 184, 0.2)';
            });
            
            tag.addEventListener('mouseleave', function() {
                this.style.opacity = '1';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            });
        });
        
        console.log(`[Tag Colorizer] 已为 ${tags.length} 个标签随机分配紫色系配色`);
    }

    // 等待 DOM 加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyTagColors);
    } else {
        applyTagColors();
    }
    
    // 监听 PJAX
    document.addEventListener('pjax:complete', applyTagColors);
})();