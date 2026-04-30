/**
 * 标签颜色分配器 - 淡雅紫色系（完整版）
 */

(function() {
    'use strict';

    // 配色方案：淡雅紫色系
    const colorPalette = [
        '#E8E0F5', '#DDD0F0', '#D1C0EB', '#C5B0E6',
        '#B9A0E0', '#AD90DB', '#A180D5', '#9570CF',
        '#8960CA', '#7D50C4', '#7140BE', '#6530B8'
    ];

    const DARK_THRESHOLD = 128;

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    function getTagColor(tagName) {
        const index = hashCode(tagName) % colorPalette.length;
        return colorPalette[index];
    }

    function getTextColor(bgColor) {
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > DARK_THRESHOLD ? '#4A2A7A' : '#FFFFFF';
    }

    function getTagElements() {
        const selectors = [
            '.tag-cloud-list a',           // 标签云页面（你发现的这个）
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
        
        tags.forEach(tag => {
            // 获取标签名
            let tagName = tag.textContent.trim();
            
            // 移除可能的图标影响
            const icon = tag.querySelector('i');
            if (icon && icon.nextSibling) {
                tagName = icon.nextSibling.textContent.trim();
            }
            
            if (!tagName) return;
            
            const bgColor = getTagColor(tagName);
            const textColor = getTextColor(bgColor);
            
            // 强制应用样式（保留原有的 font-size，只改颜色）
            const originalFontSize = tag.style.fontSize;
            tag.setAttribute('style', 
                `background-color: ${bgColor} !important; ` +
                `color: ${textColor} !important; ` +
                `display: inline-block !important; ` +
                `padding: 4px 12px !important; ` +
                `margin: 4px !important; ` +
                `border-radius: 20px !important; ` +
                `text-decoration: none !important; ` +
                `transition: all 0.25s ease !important; ` +
                `border: none !important; ` +
                `font-size: ${originalFontSize || '1em'} !important;`
            );
            
            // 添加悬浮效果
            tag.addEventListener('mouseenter', function() {
                this.style.opacity = '0.8';
                this.style.transform = 'translateY(-2px)';
            });
            
            tag.addEventListener('mouseleave', function() {
                this.style.opacity = '1';
                this.style.transform = 'translateY(0)';
            });
        });
        
        console.log(`[Tag Colorizer] 已为 ${tags.length} 个标签应用紫色系配色`);
        console.log('[Tag Colorizer] 标签列表:', tags.map(t => t.textContent.trim()));
    }

    // 等待 DOM 加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyTagColors);
    } else {
        applyTagColors();
    }
    
    // 监听 PJAX（如果 Butterfly 开启了）
    document.addEventListener('pjax:complete', applyTagColors);
})();