// renderer.js

// --- DOM 元素获取 ---
const selectImageBtn = document.getElementById('select-image-btn');
const sendBtn = document.getElementById('send-btn');
const recoverAllBtn = document.getElementById('recover-all-btn');
const imagePathDisplay = document.getElementById('image-path-display');
const imagePreview = document.getElementById('image-preview');
const imagePreviewPlaceholder = document.getElementById('image-preview-placeholder');
const ipListContainer = document.getElementById('ip-list-container');
const footerStatusText = document.getElementById('footer-status-text');
const loadingPlaceholder = document.querySelector('.loading-placeholder');
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

const addComputerBtn = document.getElementById('add-computer-btn');
const deleteComputerBtn = document.getElementById('delete-computer-btn');
const importComputersBtn = document.getElementById('import-computers-btn');
const refreshStatusBtn = document.getElementById('refresh-status-btn'); 
const aboutAppBtn = document.getElementById('about-app-btn'); // 获取“关于”按钮

// 添加计算机模态框元素
const addComputerModal = document.getElementById('add-computer-modal');
const computerNameInput = document.getElementById('computer-name-input');
const computerIpInput = document.getElementById('computer-ip-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// 通用 Alert 模态框元素
const alertModal = document.getElementById('alert-modal');
const alertModalTitle = document.getElementById('alert-modal-title');
const alertModalMessage = document.getElementById('alert-modal-message');
const alertModalOkBtn = document.getElementById('alert-modal-ok-btn');

// 通用 Confirm 模态框元素
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalConfirmBtn = document.getElementById('confirm-modal-confirm-btn');

// --- 应用状态变量 ---
let selectedImagePath = null; // Store the temp path of the processed image for sending
let originalSelectedImagePathForPreview = null; // Store the original path for preview
let finalFilenameForHeader = null; // Store the filename to be used in the header

let selectedTargetIp = null; // For single selection
let selectedComputerName = null; 
let selectedComputerId = null; 
let computers = []; // 存储计算机列表 { id: string, name: string, ip: string, onlineStatus: 'pending' | 'online' | 'offline' }
let globalSendOperationCount = 0; 
let selectedComputerIdsForDelete = []; // 用于存储多选删除的ID

// --- 函数定义 ---
console.log('Renderer script loaded. window.electronAPI:', window.electronAPI); 

/**
 * 更新页脚状态文本及其样式。
 * @param {string} message - 要显示的消息。
 * @param {'default'|'success'|'error'|'warning'|'info'} [type='default'] - 消息类型，用于CSS样式。
 */
function updateFooterStatus(message, type = 'default') { 
    if (footerStatusText) {
        footerStatusText.textContent = message;
        // 确保在添加新类之前移除所有可能的状态类，以避免颜色冲突
        footerStatusText.className = ''; 
        if (type && type !== 'default') { // 只有当 type 不是 'default' 或空字符串时才添加类
            footerStatusText.classList.add(type);
        }
    } else {
        console.error("页脚状态元素 (footerStatusText) 未找到!");
    }
}

/**
 * 检查并更新“发送选中图片”按钮的禁用状态。
 */
function checkSendButtonState() {
    console.log(`检查发送按钮状态: ImagePath='${selectedImagePath}', TargetIp='${selectedTargetIp}', OpsCount=${globalSendOperationCount}`);
    if (sendBtn) {
        const selectedComputer = computers.find(c => c.id === selectedComputerId);
        const multiSelectedCount = selectedComputerIdsForDelete.length;

        if (selectedImagePath && finalFilenameForHeader && selectedTargetIp && multiSelectedCount === 0 && globalSendOperationCount === 0 && selectedComputer && selectedComputer.onlineStatus === 'online') { 
            sendBtn.disabled = false;
            console.log('发送按钮已启用。');
        } else {
            sendBtn.disabled = true;
            console.log('发送按钮已禁用。');
        }
    } else {
        console.error("发送按钮 (sendBtn) 未找到!");
    }
}

/**
 * 检查并更新“删除”按钮的禁用状态。
 */
function checkDeleteButtonState() {
    if (deleteComputerBtn) {
        const multiSelectedCount = selectedComputerIdsForDelete.length;
        deleteComputerBtn.disabled = !(selectedComputerId || multiSelectedCount > 0) ;
    }
}

/**
 * 将当前计算机列表保存到本地JSON文件。
 */
async function saveComputersList() {
    if (!window.electronAPI || typeof window.electronAPI.saveComputers !== 'function') {
        updateFooterStatus("错误: 保存功能不可用 (API缺失)", "error");
        console.error("saveComputers API is missing from window.electronAPI", window.electronAPI);
        return { success: false, error: "API缺失" }; 
    }
    try {
        // 保存时只保存核心数据，onlineStatus 是临时的
        const dataToSave = computers.map(c => ({ id: c.id, name: c.name, ip: c.ip }));
        const result = await window.electronAPI.saveComputers(dataToSave);
        if (result.success) {
            console.log('计算机列表已成功保存。');
            updateFooterStatus('计算机列表已保存。', 'success');
        } else {
            console.error('保存计算机列表失败:', result.error);
            updateFooterStatus(`错误: 保存列表失败 - ${result.error}`, 'error');
        }
        return result;
    } catch (error) {
        console.error('通过IPC保存计算机列表时出错:', error);
        updateFooterStatus(`错误: 保存列表IPC调用失败 - ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

/**
 * 根据 `computers` 数组更新UI中的计算机列表显示。
 */
function displayComputerList() {
    if (!ipListContainer) {
        console.error("ipListContainer is null!");
        return;
    }
    const currentSingleSelectedId = selectedComputerId; 
    selectedComputerIdsForDelete = Array.from(ipListContainer.querySelectorAll('.ip-card-checkbox:checked')).map(cb => cb.dataset.id);

    ipListContainer.innerHTML = ''; 
    if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';

    if (computers.length === 0) {
        ipListContainer.innerHTML = '<div class="loading-placeholder">没有计算机信息。请添加或导入。</div>';
        if(recoverAllBtn) recoverAllBtn.disabled = true;
        selectedTargetIp = null; 
        selectedComputerName = null;
        selectedComputerId = null;
        selectedComputerIdsForDelete = []; 
        checkDeleteButtonState();
        checkSendButtonState();
        return;
    }

    if(recoverAllBtn) recoverAllBtn.disabled = computers.length === 0;

    computers.forEach((comp, index) => { 
        const card = document.createElement('div');
        card.classList.add('ip-card');
        card.dataset.ip = comp.ip;
        card.dataset.name = comp.name; 
        card.dataset.id = comp.id; 
        card.draggable = true; 

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('ip-card-checkbox');
        checkbox.dataset.id = comp.id;
        if (selectedComputerIdsForDelete.includes(comp.id)) { 
            checkbox.checked = true;
            card.classList.add('multi-selected');
        }

        const orderIdSpan = document.createElement('span');
        orderIdSpan.classList.add('ip-card-order-id');
        orderIdSpan.textContent = `${index + 1}.`;

        const statusIndicatorSpan = document.createElement('span');
        statusIndicatorSpan.classList.add('ip-card-status-indicator');
        statusIndicatorSpan.dataset.ipForStatus = comp.ip; 
        statusIndicatorSpan.classList.remove('online', 'offline', 'pending'); 
        statusIndicatorSpan.classList.add(comp.onlineStatus || 'pending'); 
        statusIndicatorSpan.title = `状态: ${comp.onlineStatus || '未知'}`;

        const detailsSpan = document.createElement('div');
        detailsSpan.classList.add('ip-card-details');
        detailsSpan.innerHTML = `<span class="name">${comp.name}</span><span class="ip">${comp.ip}</span>`;
        
        card.appendChild(checkbox); 
        card.appendChild(orderIdSpan);
        card.appendChild(statusIndicatorSpan);
        card.appendChild(detailsSpan);
        
        if (comp.id === currentSingleSelectedId && !selectedComputerIdsForDelete.includes(comp.id)) { 
            card.classList.add('selected');
        }

        checkbox.addEventListener('change', (event) => {
            event.stopPropagation(); 
            const computerId = event.target.dataset.id;
            if (event.target.checked) {
                card.classList.add('multi-selected');
                card.classList.remove('selected'); 
                selectedTargetIp = null; 
                selectedComputerName = null;
                selectedComputerId = null;
                if (!selectedComputerIdsForDelete.includes(computerId)) {
                    selectedComputerIdsForDelete.push(computerId);
                }
            } else {
                card.classList.remove('multi-selected');
                selectedComputerIdsForDelete = selectedComputerIdsForDelete.filter(id => id !== computerId);
            }
            console.log("Multi-selected IDs:", selectedComputerIdsForDelete);
            checkDeleteButtonState(); 
            checkSendButtonState(); 
        });
        
        card.addEventListener('click', (event) => {
            if (event.target.type === 'checkbox') return; 

            document.querySelectorAll('.ip-card.multi-selected').forEach(mc => {
                mc.classList.remove('multi-selected');
                const cb = mc.querySelector('.ip-card-checkbox');
                if (cb) cb.checked = false;
            });
            selectedComputerIdsForDelete = [];

            document.querySelectorAll('.ip-card.selected').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTargetIp = comp.ip;
            selectedComputerName = comp.name; 
            selectedComputerId = comp.id; 
            
            const statusText = comp.onlineStatus === 'online' ? '在线' : comp.onlineStatus === 'offline' ? '离线' : '状态未知';
            if (originalSelectedImagePathForPreview) { 
                updateFooterStatus(`已选目标: ${comp.name} (${statusText})。图片: "${originalSelectedImagePathForPreview.split(/[\\/]/).pop()}" 就绪。`, comp.onlineStatus === 'online' ? 'info' : 'warning');
            } else {
                updateFooterStatus(`已选目标: ${comp.name} (${statusText})。请选择一张图片。`, comp.onlineStatus === 'online' ? 'info' : 'warning');
            }
            checkSendButtonState();
            checkDeleteButtonState(); 
        });

        let draggedItemId = null;
        card.addEventListener('dragstart', (event) => {
            if (selectedComputerIdsForDelete.length > 0 && !selectedComputerIdsForDelete.includes(comp.id)) {
                event.preventDefault(); 
                return;
            }
            if (selectedComputerIdsForDelete.length > 0 && selectedComputerIdsForDelete.includes(comp.id)) {
                console.log("Dragging a multi-selected item. Dragging multiple items is not yet implemented.");
            }
            draggedItemId = comp.id;
            event.dataTransfer.setData('text/plain', comp.id);
            event.target.classList.add('dragging');
        });
        card.addEventListener('dragend', (event) => {
            event.target.classList.remove('dragging');
            document.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
            draggedItemId = null;
        });
        card.addEventListener('dragenter', (event) => {
            event.preventDefault();
            const targetCard = event.target.closest('.ip-card');
            if (targetCard && targetCard.dataset.id !== draggedItemId) { 
                targetCard.classList.add('drag-over-target');
            }
        });
        card.addEventListener('dragleave', (event) => {
            const targetCard = event.target.closest('.ip-card');
            if (targetCard) {
                targetCard.classList.remove('drag-over-target');
            }
        });
        card.addEventListener('dragover', (event) => {
            event.preventDefault(); 
            event.dataTransfer.dropEffect = 'move';
        });
        card.addEventListener('drop', async (event) => {
            event.preventDefault();
            const targetCard = event.target.closest('.ip-card');
            if (targetCard) {
                targetCard.classList.remove('drag-over-target');
            }
            
            const droppedOnItemId = comp.id;
            const draggedItemIdFromData = event.dataTransfer.getData('text/plain');

            if (draggedItemIdFromData && droppedOnItemId && draggedItemIdFromData !== droppedOnItemId) {
                const draggedIndex = computers.findIndex(c => c.id === draggedItemIdFromData);
                let targetIndex = computers.findIndex(c => c.id === droppedOnItemId);

                if (draggedIndex !== -1 && targetIndex !== -1) {
                    const [draggedItem] = computers.splice(draggedIndex, 1);
                    computers.splice(targetIndex, 0, draggedItem);
                    
                    selectedComputerId = draggedItem.id; 
                    selectedTargetIp = draggedItem.ip;
                    selectedComputerName = draggedItem.name;
                    selectedComputerIdsForDelete = []; 

                    displayComputerList(); 
                    await saveComputersList();
                    updateFooterStatus("列表顺序已更新并保存。", "success");
                }
            }
        });

        ipListContainer.appendChild(card);
    });
    
    if (currentSingleSelectedId && !computers.find(c => c.id === currentSingleSelectedId) && selectedComputerIdsForDelete.length === 0) {
        selectedTargetIp = null;
        selectedComputerName = null;
        selectedComputerId = null;
    }
    checkDeleteButtonState(); 
    checkSendButtonState();
}

/**
 * 从本地文件加载计算机列表，并在加载完成后（可选）探测其在线状态。
 * @param {boolean} [probeStatus=false] - 是否在加载后探测在线状态。
 */
async function loadAndDisplayComputers(probeStatus = false) {
    console.log('Loading computers from local file...');
    if (loadingPlaceholder) loadingPlaceholder.style.display = 'block';
    try {
        if (!window.electronAPI || typeof window.electronAPI.loadComputers !== 'function') {
            throw new Error("loadComputers API is missing from window.electronAPI! Check preload.js");
        }
        const loadedComputers = await window.electronAPI.loadComputers();
        computers = loadedComputers.map((comp, index) => ({ 
            id: comp.id || `comp-id-${Date.now()}-${index}`, 
            name: comp.name || `计算机${index + 1}`, 
            ip: comp.ip,
            onlineStatus: 'pending' 
        })).filter(comp => comp.ip); 
        console.log('Computers loaded:', computers);
        displayComputerList(); 
        updateFooterStatus(computers.length > 0 ? "计算机列表已加载。" : "未找到计算机列表，请添加或导入。", computers.length > 0 ? "info" : "warning");
        
        if (probeStatus && computers.length > 0) {
            await probeAllComputersStatus(); 
        }
    } catch (error) {
        console.error('Error loading computers via IPC:', error);
        computers = [];
        displayComputerList();
        updateFooterStatus(`错误: 加载计算机列表失败 - ${error.message}`, "error");
    }
    if (loadingPlaceholder) loadingPlaceholder.style.display = 'none';
    checkDeleteButtonState();
    checkSendButtonState();
}

/**
 * 探测单个计算机的在线状态。
 * @param {object} computer - 计算机对象 { id, name, ip, onlineStatus }。
 * @returns {Promise<'online'|'offline'|'pending'>} 探测结果。
 */
async function probeComputerStatus(computer) {
    if (!window.electronAPI || typeof window.electronAPI.checkComputerOnline !== 'function') {
        console.warn("checkComputerOnline API is missing from window.electronAPI!");
        return 'pending'; 
    }
    try {
        console.log(`Probing ${computer.ip}...`);
        const cardIndicator = ipListContainer.querySelector(`.ip-card-status-indicator[data-ip-for-status="${computer.ip}"]`);
        if (cardIndicator) {
            cardIndicator.classList.remove('online', 'offline');
            cardIndicator.classList.add('pending');
            cardIndicator.title = "状态: 探测中...";
        }

        const isOnline = await window.electronAPI.checkComputerOnline(computer.ip); 
        console.log(`Status for ${computer.ip}: ${isOnline ? 'online' : 'offline'}`);
        return isOnline ? 'online' : 'offline';
    } catch (error) {
        console.error(`Error probing ${computer.ip}:`, error);
        return 'offline'; 
    }
}

/**
 * 探测列表中所有计算机的在线状态并更新UI。
 */
async function probeAllComputersStatus() {
    if (computers.length === 0) {
        updateFooterStatus("列表为空，无需刷新状态。", "info");
        return;
    }
    updateFooterStatus("正在刷新所有节点在线状态...", "info");
    if(refreshStatusBtn) refreshStatusBtn.disabled = true;
    if(recoverAllBtn) recoverAllBtn.disabled = true; 

    const statusUpdatePromises = computers.map(async (comp) => {
        const status = await probeComputerStatus(comp);
        comp.onlineStatus = status;
        const cardIndicator = ipListContainer.querySelector(`.ip-card-status-indicator[data-ip-for-status="${comp.ip}"]`);
        if (cardIndicator) {
            cardIndicator.classList.remove('online', 'offline', 'pending');
            cardIndicator.classList.add(status);
            cardIndicator.title = `状态: ${status}`;
        }
        return comp; 
    });

    await Promise.all(statusUpdatePromises);
    if(refreshStatusBtn) refreshStatusBtn.disabled = false;
    if(recoverAllBtn) recoverAllBtn.disabled = computers.length === 0; 
    updateFooterStatus("节点在线状态已刷新。", "success");
    checkSendButtonState(); 
}

/**
 * 显示自定义的提示框。
 * @param {string} message - 要显示的消息。
 * @param {string} [title="提示"] - 模态框标题。
 * @returns {Promise<void>}
 */
function showCustomAlert(message, title = "提示") {
    return new Promise((resolve) => {
        if (!alertModal || !alertModalTitle || !alertModalMessage || !alertModalOkBtn) {
            console.error("Alert modal elements not found!");
            window.alert(message); 
            resolve();
            return;
        }
        alertModalTitle.textContent = title;
        alertModalMessage.textContent = message;
        alertModal.style.display = 'flex';
        setTimeout(() => alertModal.classList.add('active'), 10);

        const listener = () => {
            alertModal.classList.remove('active');
            setTimeout(() => alertModal.style.display = 'none', 300);
            alertModalOkBtn.removeEventListener('click', listener);
            resolve();
        };
        alertModalOkBtn.removeEventListener('click', listener); 
        alertModalOkBtn.addEventListener('click', listener);
    });
}

/**
 * 显示自定义的确认框。
 * @param {string} message - 要显示的消息。
 * @param {string} [title="请确认"] - 模态框标题。
 * @returns {Promise<boolean>} - 用户点击“确定”则为 true，点击“取消”则为 false。
 */
function showCustomConfirm(message, title = "请确认") {
    return new Promise((resolve) => {
        if (!confirmModal || !confirmModalTitle || !confirmModalMessage || !confirmModalCancelBtn || !confirmModalConfirmBtn) {
            console.error("Confirm modal elements not found!");
            resolve(window.confirm(message)); 
            return;
        }
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmModal.style.display = 'flex';
        setTimeout(() => confirmModal.classList.add('active'), 10);

        let confirmListener, cancelListener; 

        confirmListener = () => {
            confirmModal.classList.remove('active');
            setTimeout(() => confirmModal.style.display = 'none', 300);
            confirmModalConfirmBtn.removeEventListener('click', confirmListener);
            confirmModalCancelBtn.removeEventListener('click', cancelListener);
            resolve(true);
        };
        cancelListener = () => {
            confirmModal.classList.remove('active');
            setTimeout(() => confirmModal.style.display = 'none', 300);
            confirmModalConfirmBtn.removeEventListener('click', confirmListener);
            confirmModalCancelBtn.removeEventListener('click', cancelListener);
            resolve(false);
        };
        
        confirmModalConfirmBtn.removeEventListener('click', confirmListener); 
        confirmModalCancelBtn.removeEventListener('click', cancelListener); 
        confirmModalConfirmBtn.addEventListener('click', confirmListener);
        confirmModalCancelBtn.addEventListener('click', cancelListener);
    });
}

/**
 * 打开用于添加新计算机的模态框。
 */
function openAddComputerModal() {
    console.log('Attempting to open Add Computer Modal...');
    if (addComputerModal && computerNameInput && computerIpInput) {
        console.log('Modal elements found.');
        computerNameInput.value = ''; 
        computerIpInput.value = '';
        addComputerModal.style.display = 'flex'; 
        setTimeout(() => { 
            addComputerModal.classList.add('active');
        }, 10);
        console.log('Modal "active" class added.');
        computerNameInput.focus();
    } else {
        console.error('Add Computer Modal or its input elements not found!');
        updateFooterStatus("错误:无法打开添加对话框。", "error");
    }
}

/**
 * 关闭添加新计算机的模态框。
 */
function closeAddComputerModal() {
    console.log('Attempting to close Add Computer Modal...');
    if (addComputerModal) {
        addComputerModal.classList.remove('active');
        setTimeout(() => {
            addComputerModal.style.display = 'none';
        }, 300); 
        console.log('Modal "active" class removed and display set to none.');
    } else {
        console.error('Add Computer Modal element not found on close attempt!');
    }
}

/**
 * 处理从模态框确认添加新计算机的逻辑。
 */
async function handleAddComputerConfirm() {
    console.log('handleAddComputerConfirm called.');
    const name = computerNameInput ? computerNameInput.value.trim() : '';
    const ip = computerIpInput ? computerIpInput.value.trim() : '';

    if (name === "") { await showCustomAlert("请输入计算机名称。", "输入错误"); if(computerNameInput) computerNameInput.focus(); return; }
    if (ip === "") { await showCustomAlert("请输入IP地址。", "输入错误"); if(computerIpInput) computerIpInput.focus(); return; }
    if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) { await showCustomAlert("IP地址格式不正确！", "输入错误"); if(computerIpInput) computerIpInput.focus(); return; }
    if (computers.some(comp => comp.ip === ip)) { await showCustomAlert(`IP地址 "${ip}" 已存在！`, "添加失败"); if(computerIpInput) computerIpInput.focus(); return; }
    if (computers.some(comp => comp.name.toLowerCase() === name.toLowerCase())) {
        const proceed = await showCustomConfirm(`名称 "${name}" 已存在，确定要添加吗？`, "名称重复");
        if (!proceed) { updateFooterStatus("添加操作已取消。", "info"); closeAddComputerModal(); return; }
    }

    const newComputer = { id: `comp-id-${Date.now()}`, name: name, ip: ip, onlineStatus: 'pending' }; 
    computers.push(newComputer);
    await saveComputersList(); 
    updateFooterStatus(`计算机 "${name}" (${ip}) 已添加。正在探测其状态...`, "success");
    
    const newCompEntry = computers.find(c => c.id === newComputer.id);
    if (newCompEntry) {
        selectedTargetIp = newCompEntry.ip;
        selectedComputerName = newCompEntry.name;
        selectedComputerId = newCompEntry.id;
        
        newCompEntry.onlineStatus = await probeComputerStatus(newCompEntry); 
        displayComputerList(); 
        const newCard = ipListContainer.querySelector(`div[data-id="${newComputer.id}"]`);
        if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        updateFooterStatus(`计算机 "${name}" (${ip}) 添加完成，状态: ${newCompEntry.onlineStatus}。`, "success");
    }
    closeAddComputerModal();
}

/**
 * 处理删除选中（单个或多个）计算机的逻辑。
 */
async function handleDeleteComputer() {
    selectedComputerIdsForDelete = Array.from(ipListContainer.querySelectorAll('.ip-card-checkbox:checked'))
                                     .map(cb => cb.dataset.id);

    if (selectedComputerIdsForDelete.length === 0 && selectedComputerId) { 
        selectedComputerIdsForDelete.push(selectedComputerId);
    }

    if (selectedComputerIdsForDelete.length === 0) {
        await showCustomAlert("请先选择至少一个要删除的计算机。", "操作提示");
        updateFooterStatus("未选择计算机，无法删除。", "warning");
        return;
    }
    
    const namesToDelete = selectedComputerIdsForDelete
        .map(id => computers.find(c => c.id === id)?.name || `ID: ${id.substring(0,8)}...`) 
        .join(', ');
    const confirmMessage = `确定要删除选中的 ${selectedComputerIdsForDelete.length} 台计算机 (${namesToDelete}) 吗？`;

    const confirmDel = await showCustomConfirm(confirmMessage, "删除确认");
    if (!confirmDel) {
        updateFooterStatus("删除操作已取消。", "info");
        return;
    }

    const originalComputerCount = computers.length;
    computers = computers.filter(comp => !selectedComputerIdsForDelete.includes(comp.id));
    const deletedCount = originalComputerCount - computers.length;

    selectedTargetIp = null; 
    selectedComputerName = null;
    selectedComputerId = null;
    selectedComputerIdsForDelete = []; 

    displayComputerList(); 
    await saveComputersList(); 
    updateFooterStatus(`${deletedCount} 台计算机已删除。`, "success");
}

/**
 * 处理从文件导入计算机列表的逻辑。
 */
async function handleImportComputers() { 
    try {
        if (!window.electronAPI || typeof window.electronAPI.showOpenDialog !== 'function' || typeof window.electronAPI.readFile !== 'function') {
            await showCustomAlert("错误: 导入功能所需API不可用。", "功能缺失");
            throw new Error("导入功能API不可用。");
        }
        const result = await window.electronAPI.showOpenDialog({
            title: '选择要导入的计算机列表文件 (txt, csv)',
            filters: [{ name: '文本文件', extensions: ['txt', 'csv'] }],
            properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const fileNameForStatus = filePath.substring(filePath.lastIndexOf(/[\\/]/) + 1);
            updateFooterStatus(`正在读取文件: ${fileNameForStatus}...`, 'info');
            const fileContentResult = await window.electronAPI.readFile(filePath);

            if (fileContentResult.success) {
                const lines = fileContentResult.data.split(/\r?\n/);
                let importedCount = 0;
                let skippedCount = 0;
                const tempNewComputers = []; 

                lines.forEach((line, lineIndex) => {
                    if (line.trim() === "") return; 
                    const parts = line.split(',');
                    if (parts.length === 2) {
                        const name = parts[0].trim();
                        const ip = parts[1].trim();
                        
                        if (name && ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
                            const ipExistsInCurrent = computers.some(existingComp => existingComp.ip === ip);
                            const ipExistsInTemp = tempNewComputers.some(newComp => newComp.ip === ip);

                            if (!ipExistsInCurrent && !ipExistsInTemp) {
                                tempNewComputers.push({ id: `comp-id-${Date.now()}-${importedCount}`, name: name, ip: ip, onlineStatus: 'pending' });
                                importedCount++;
                            } else {
                                console.log(`Skipping duplicate IP during import: ${name}, ${ip} (Line ${lineIndex + 1})`);
                                skippedCount++;
                            }
                        } else {
                            console.log(`Skipping invalid line (format or IP) during import: ${line} (Line ${lineIndex + 1})`);
                            skippedCount++;
                        }
                    } else {
                        console.log(`Skipping malformed line (not 2 parts) during import: ${line} (Line ${lineIndex + 1})`);
                        skippedCount++;
                    }
                });

                if (tempNewComputers.length > 0) {
                    computers = computers.concat(tempNewComputers); 
                    await saveComputersList();
                    await probeAllComputersStatus(); 
                }
                let message = `成功导入 ${importedCount} 条新计算机信息。`;
                if (skippedCount > 0) message += ` 跳过 ${skippedCount} 条无效或重复记录。`;
                updateFooterStatus(message, "success");
                await showCustomAlert(message, "导入结果");

            } else {
                updateFooterStatus(`错误: 读取文件失败 - ${fileContentResult.error}`, "error");
                await showCustomAlert(`读取文件失败: ${fileContentResult.error}`, "导入错误");
            }
        } else {
            updateFooterStatus("导入操作已取消。", "info");
        }
    } catch (error) {
        console.error("导入计算机列表时发生错误:", error);
        updateFooterStatus(`错误: 导入失败 - ${error.message}`, "error");
        await showCustomAlert(`导入失败: ${error.message}`, "导入错误");
    }
}


// --- 事件监听器 ---
if (minimizeBtn) minimizeBtn.addEventListener('click', () => {
    if (window.electronAPI && typeof window.electronAPI.minimizeApp === 'function') window.electronAPI.minimizeApp(); 
    else console.error("minimizeApp API not found on window.electronAPI");
});
if (maximizeBtn) maximizeBtn.addEventListener('click', () => {
    if (window.electronAPI && typeof window.electronAPI.maximizeApp === 'function') window.electronAPI.maximizeApp();
    else console.error("maximizeApp API not found on window.electronAPI");
});
if (closeBtn) closeBtn.addEventListener('click', () => {
    if (window.electronAPI && typeof window.electronAPI.closeApp === 'function') window.electronAPI.closeApp();
    else console.error("closeApp API not found on window.electronAPI");
});

if (addComputerBtn) addComputerBtn.addEventListener('click', openAddComputerModal);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAddComputerModal);
if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', handleAddComputerConfirm);

if (deleteComputerBtn) deleteComputerBtn.addEventListener('click', handleDeleteComputer);
if (importComputersBtn) importComputersBtn.addEventListener('click', handleImportComputers);
if (refreshStatusBtn) refreshStatusBtn.addEventListener('click', probeAllComputersStatus);

if (aboutAppBtn) {
    aboutAppBtn.addEventListener('click', () => {
        console.log('“关于”按钮被点击');
        if (window.electronAPI && typeof window.electronAPI.openAboutWindow === 'function') {
            window.electronAPI.openAboutWindow();
        } else {
            console.error("openAboutWindow API not found on window.electronAPI. Check preload.js");
            showCustomAlert("无法打开“关于”页面 (API缺失)。", "功能错误");
        }
    });
} else {
    console.error("“关于”按钮 (aboutAppBtn) 未找到!");
}


if (selectImageBtn) selectImageBtn.addEventListener('click', async () => {
    console.log('Select image button clicked');
    try {
        if (typeof window.electronAPI === 'undefined' || 
            typeof window.electronAPI.showOpenDialog !== 'function' || 
            typeof window.electronAPI.processImageForSending !== 'function') {
            console.error("Required image processing API is not available. window.electronAPI:", window.electronAPI);
            updateFooterStatus("错误: 图片处理功能不可用。", "error");
            return;
        }
        
        const openDialogResult = await window.electronAPI.showOpenDialog({
            title: '选择图片文件 (JPG, PNG, BMP)',
            filters: [
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (openDialogResult.canceled || !openDialogResult.filePaths || openDialogResult.filePaths.length === 0) {
            console.log('Image selection cancelled.');
            return; 
        }
        const originalFilePath = openDialogResult.filePaths[0];
        originalSelectedImagePathForPreview = originalFilePath; 
        updateFooterStatus(`正在处理图片: ${originalFilePath.split(/[\\/]/).pop()}...`, 'info');

        const processResult = await window.electronAPI.processImageForSending(originalFilePath);

        if (processResult.success) {
            selectedImagePath = processResult.tempFilePath; 
            finalFilenameForHeader = processResult.finalFilenameForHeader; 
            
            if(imagePathDisplay) imagePathDisplay.textContent = originalFilePath; 
            if(imagePreview) {
                imagePreview.src = originalFilePath; 
                imagePreview.style.display = 'block'; 
            }
            if(imagePreviewPlaceholder) imagePreviewPlaceholder.style.display = 'none'; 
            
            if (selectedTargetIp) {
                const targetName = selectedComputerName || selectedTargetIp;
                updateFooterStatus(`图片 "${finalFilenameForHeader}" 已处理。准备发送到 ${targetName}。`, 'info');
            } else {
                updateFooterStatus(`图片 "${finalFilenameForHeader}" 已处理。请从左侧选择目标电脑。`, 'info');
            }
        } else {
            selectedImagePath = null;
            originalSelectedImagePathForPreview = null;
            finalFilenameForHeader = null;
            if(imagePathDisplay) imagePathDisplay.textContent = '图片处理失败';
            if(imagePreview) {imagePreview.style.display = 'none'; imagePreview.src = '#';}
            if(imagePreviewPlaceholder) imagePreviewPlaceholder.style.display = 'flex'; 
            await showCustomAlert(processResult.error || '图片处理失败，未知错误。', '处理错误');
            updateFooterStatus(`图片处理失败: ${processResult.error}`, 'error');
        }
        checkSendButtonState();
    } catch (error) {
        console.error('选择并处理图片错误:', error);
        updateFooterStatus(`图片处理错误: ${error.message}`, 'error');
        selectedImagePath = null;
        originalSelectedImagePathForPreview = null;
        finalFilenameForHeader = null;
        if(imagePathDisplay) imagePathDisplay.textContent = '未选定图像';
        if(imagePreview) {imagePreview.style.display = 'none'; imagePreview.src = '#';}
        if(imagePreviewPlaceholder) imagePreviewPlaceholder.style.display = 'flex'; 
        checkSendButtonState();
    }
});

if (sendBtn) sendBtn.addEventListener('click', async () => {
    console.log('Send button clicked.');
    const selectedComputer = computers.find(c => c.id === selectedComputerId);
    if (!selectedImagePath || !finalFilenameForHeader || !selectedTargetIp) {
        await showCustomAlert('错误: 图片未处理或未选择目标电脑！', "操作无效"); return;
    }
    if (!selectedComputer || selectedComputer.onlineStatus !== 'online') {
        await showCustomAlert(`目标电脑 "${selectedComputerName}" 当前不在线或状态未知，无法发送。请先刷新状态。`, "发送限制");
        return;
    }

    globalSendOperationCount++;
    checkSendButtonState(); 
    if(recoverAllBtn) recoverAllBtn.disabled = true;
    const originalButtonText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在发送...';
    
    const targetNameForStatus = selectedComputerName || selectedTargetIp;
    updateFooterStatus(`正在发送到 ${targetNameForStatus}...`, 'info');

    let finalResultForDisplay = null; 

    try {
        if (!window.electronAPI || typeof window.electronAPI.sendImage !== 'function') {
            throw new Error("发送图片功能不可用。");
        }
        const results = await window.electronAPI.sendImage({
            processedPath: selectedImagePath, 
            filenameForHeader: finalFilenameForHeader, 
            targetIp: selectedTargetIp,
            targetComputerList: computers, 
            isRecovery: false
        });
        console.log('Send image results:', results);
        if (results && results.length > 0) {
            finalResultForDisplay = results[0]; 
        } else {
            throw new Error('未收到发送结果。');
        }
    } catch (error) {
        console.error('发送图片失败:', error);
        finalResultForDisplay = { 
            ip: selectedTargetIp, 
            room: selectedComputerName || selectedTargetIp,
            image: finalFilenameForHeader,
            status: 'error', 
            message: error.message 
        };
    } finally {
        globalSendOperationCount--;
        sendBtn.innerHTML = originalButtonText;
        checkSendButtonState();
        if (recoverAllBtn && globalSendOperationCount === 0) recoverAllBtn.disabled = false;

        if (finalResultForDisplay) {
            const displayName = finalResultForDisplay.room || finalResultForDisplay.ip;
            updateFooterStatus(`发送到 ${displayName}: ${finalResultForDisplay.message}`, finalResultForDisplay.status); 
        } else {
            updateFooterStatus(`发送操作结束，但状态未知。`, 'warning');
        }
    }
});

if(recoverAllBtn) recoverAllBtn.addEventListener('click', async () => {
    console.log('Recover all button clicked (now "一键恢复").');
    if (computers.length === 0) {
        await showCustomAlert("计算机列表为空，无法执行一键恢复。", "操作无效");
        return;
    }
    
    const onlineComputers = computers.filter(c => c.onlineStatus === 'online');
    if (onlineComputers.length === 0) {
        const proceedOffline = await showCustomConfirm("警告: 列表中没有检测到在线计算机。仍要尝试向所有计算机发送恢复图片吗？（这可能导致所有发送都失败）", "离线恢复确认");
        if (!proceedOffline) {
            updateFooterStatus("一键恢复已取消。", "info");
            return;
        }
    } else if (onlineComputers.length < computers.length) {
        const proceedPartial = await showCustomConfirm(`警告: 列表中有 ${computers.length - onlineComputers.length} 台计算机不在线或状态未知。确定要继续向所有计算机发送恢复图片吗？（离线部分会失败）`, "部分离线恢复确认");
        if (!proceedPartial) {
            updateFooterStatus("一键恢复已取消。", "info");
            return;
        }
    }
    
    if (!window.electronAPI || typeof window.electronAPI.showOpenDirectoryDialog !== 'function') {
        await showCustomAlert("错误：选择文件夹功能不可用。", "功能缺失");
        return;
    }
    const dialogResult = await window.electronAPI.showOpenDirectoryDialog({
        title: '选择包含恢复图片的文件夹 (图片需命名为 1.bmp, 2.bmp, ...)',
        properties: ['openDirectory']
    });

    if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        updateFooterStatus("未选择恢复图片文件夹，一键恢复已取消。", "info");
        return;
    }
    const recoveryImagesFolderPath = dialogResult.filePaths[0];
    console.log("Recovery images folder selected:", recoveryImagesFolderPath);

    globalSendOperationCount = computers.length; 
    checkSendButtonState(); 
    if(recoverAllBtn) recoverAllBtn.disabled = true;

    const originalButtonText = recoverAllBtn.innerHTML;
    recoverAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在恢复...';
    updateFooterStatus('正在执行一键恢复，日志将在弹出窗口显示...', 'info');

    let operationSummaryMessage = '';
    let operationSummaryType = 'info'; 
    let footerSummaryText = ''; 

    try {
        if (!window.electronAPI || typeof window.electronAPI.sendImage !== 'function') {
            throw new Error("一键恢复功能不可用。");
        }
        const results = await window.electronAPI.sendImage({ 
            isRecovery: true, 
            targetComputerList: computers, 
            recoveryImagesPath: recoveryImagesFolderPath 
        });
        console.log('Recover all results:', results);
        
        const allSuccess = results.every(r => r.status === 'success');
        const failedCount = results.filter(r => r.status === 'error').length;

        if (allSuccess) {
            operationSummaryMessage = '所有目标均已成功恢复默认图片！';
            operationSummaryType = 'success';
            footerSummaryText = '一键恢复完成: 全部成功';
        } else if (failedCount > 0) {
            operationSummaryMessage = `一键恢复操作完成，${failedCount} 个目标失败。详情请查看日志窗口。`;
            operationSummaryType = 'warning';
            footerSummaryText = `一键恢复完成: ${failedCount} 个失败`;
        } else { 
            operationSummaryMessage = '一键恢复操作完成，部分状态未知。详情请查看日志窗口。';
            operationSummaryType = 'info';
            footerSummaryText = '一键恢复完成: 状态不明确';
        }
    } catch (error) {
        console.error('一键恢复操作失败:', error);
        operationSummaryMessage = `一键恢复操作失败: ${error.message}`;
        operationSummaryType = 'error';
        footerSummaryText = '错误: 一键恢复失败';
    } finally {
        globalSendOperationCount = 0;
        if(recoverAllBtn) recoverAllBtn.disabled = false;
        if(recoverAllBtn) recoverAllBtn.innerHTML = originalButtonText;
        checkSendButtonState();
        updateFooterStatus(footerSummaryText, operationSummaryType);
    }
});

// DOM 内容加载完成后执行初始化操作
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed. Checking window.electronAPI again:', window.electronAPI);
    // 确保所有关键DOM元素都已正确获取
    const requiredIds = [
        'select-image-btn', 'send-btn', 'recover-all-btn', 'image-path-display', 'image-preview', 
        'image-preview-placeholder', 'ip-list-container', 'footer-status-text', 
        'add-computer-btn', 'delete-computer-btn', 'import-computers-btn', 'refresh-status-btn', 'about-app-btn', 
        'add-computer-modal', 'computer-name-input', 'computer-ip-input', 'modal-cancel-btn', 'modal-confirm-btn',
        'alert-modal', 'alert-modal-title', 'alert-modal-message', 'alert-modal-ok-btn',
        'confirm-modal', 'confirm-modal-title', 'confirm-modal-message', 'confirm-modal-cancel-btn', 'confirm-modal-confirm-btn',
        'minimize-btn', 'maximize-btn', 'close-btn'
    ];
    let allElementsFound = true;
    for (const id of requiredIds) {
        if (!document.getElementById(id)) {
            console.error(`关键DOM元素未找到: ${id}`);
            allElementsFound = false;
        }
    }

    if (!allElementsFound || !loadingPlaceholder) { 
        console.error("一个或多个关键DOM元素未找到! 请检查HTML中的ID是否正确。");
        updateFooterStatus("错误: 界面元素加载不完整，请检查控制台。", "error");
        return; 
    }

    loadAndDisplayComputers(true); 
    updateFooterStatus('系统状态: 就绪'); 
    checkSendButtonState();
    checkDeleteButtonState(); 
});
