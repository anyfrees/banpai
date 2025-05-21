// log-renderer.js
const logListPopup = document.getElementById('log-list-popup');
const okButton = document.getElementById('ok-button');
let closeTimer = null; // 用于自动关闭的计时器

// 监听从主进程发送过来的日志数据
window.electronAPI.onLogUpdate((logEntry) => {
    console.log('Log window received log entry:', logEntry);
    if (logListPopup && logEntry) {
        if (Array.isArray(logEntry)) {
            logListPopup.innerHTML = ''; 
            logEntry.forEach(entry => appendLogEntry(entry));
        } else if (logEntry.clearAll) {
             logListPopup.innerHTML = '';
        } else {
            updateOrAddLogEntry(logEntry);
        }
        // 自动滚动到底部
        if(logListPopup.scrollHeight > logListPopup.clientHeight){
            logListPopup.scrollTop = logListPopup.scrollHeight;
        }
        resetCloseTimer(); // 每次收到日志更新都重置计时器
    }
});

function appendLogEntry(entry) {
    const listItem = document.createElement('li');
    const roomName = entry.room || (entry.ip ? `${entry.ip}` : '未知设备');
    const imageName = entry.image || (entry.status === 'error' ? 'N/A' : '未知图片');
    
    let statusIcon = '';
    let statusClass = 'log-status-info';
    let statusText = '未知';

    if (entry.status === 'success') {
        statusIcon = '<i class="fas fa-check-circle log-icon-success"></i> ';
        statusClass = 'log-status-success';
        statusText = '成功';
    } else if (entry.status === 'error') {
        statusIcon = '<i class="fas fa-times-circle log-icon-error"></i> ';
        statusClass = 'log-status-error';
        statusText = '失败';
    } else if (entry.status === 'sending') { 
        statusIcon = '<i class="fas fa-spinner fa-spin log-icon-sending"></i> ';
        statusClass = 'log-status-sending';
        statusText = '发送中...';
    }

    const displayName = entry.room ? `${entry.room} (${entry.ip})` : `${entry.ip}`;

    listItem.innerHTML = `
        <span class="log-ip" title="${displayName} - ${imageName}">${displayName} - ${imageName}</span>
        <span class="log-message ${statusClass}" title="${entry.message}">
            ${statusIcon}${statusText}: ${entry.message}
        </span>
    `;
    listItem.dataset.ip = entry.ip; 
    listItem.dataset.image = imageName; 

    logListPopup.appendChild(listItem);
}

function updateOrAddLogEntry(entry) {
    let existingEntry = null;
    const imageName = entry.image || 'N/A'; // 确保imageName有值
    if (entry.ip) { // 尝试通过IP和图片名（如果存在）来找到条目
        const selector = entry.image ? 
            `li[data-ip="${entry.ip}"][data-image="${imageName}"]` : 
            `li[data-ip="${entry.ip}"]`; // 如果没有图片名，只匹配IP
        existingEntry = logListPopup.querySelector(selector);
    }

    if (existingEntry) { 
        const messageSpan = existingEntry.querySelector('.log-message');
        let statusIcon = '';
        let statusClass = 'log-status-info';
        let statusText = '未知';

        if (entry.status === 'success') {
            statusIcon = '<i class="fas fa-check-circle log-icon-success"></i> ';
            statusClass = 'log-status-success';
            statusText = '成功';
        } else if (entry.status === 'error') {
            statusIcon = '<i class="fas fa-times-circle log-icon-error"></i> ';
            statusClass = 'log-status-error';
            statusText = '失败';
        } else if (entry.status === 'sending') {
            statusIcon = '<i class="fas fa-spinner fa-spin log-icon-sending"></i> ';
            statusClass = 'log-status-sending';
            statusText = '发送中...';
        }
        messageSpan.className = `log-message ${statusClass}`;
        messageSpan.innerHTML = `${statusIcon}${statusText}: ${entry.message}`;
        messageSpan.title = entry.message;
    } else { 
        appendLogEntry(entry);
    }
}

// “确定”按钮关闭窗口
okButton.addEventListener('click', () => {
    window.electronAPI.closeLogWindow(); // 通知主进程关闭日志窗口
});

// 设置10秒自动关闭计时器
function startCloseTimer() {
    if (closeTimer) clearTimeout(closeTimer); // 清除旧计时器
    closeTimer = setTimeout(() => {
        window.electronAPI.closeLogWindow();
    }, 10000); // 10秒
}

// 重置计时器（例如，当有新的日志更新时）
function resetCloseTimer() {
    startCloseTimer();
}

// 初始加载时启动计时器
startCloseTimer();

// (可选) 鼠标悬停在窗口上时暂停计时器
document.body.addEventListener('mouseenter', () => {
    if (closeTimer) clearTimeout(closeTimer);
});

// (可选) 鼠标离开窗口时重新启动计时器
document.body.addEventListener('mouseleave', () => {
    resetCloseTimer();
});


console.log('Log renderer script loaded.');
