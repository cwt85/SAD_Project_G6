// ==========================================
// js/ticket.js - 票務模組專屬前端互動邏輯
// ==========================================

// 1. 左側選單切換邏輯
function switchMainFlow(flowId) {
    // 隱藏所有右側畫面
    document.querySelectorAll('.flow-view').forEach(el => el.style.display = 'none');
    // 移除所有按鈕的 active 狀態
    document.querySelectorAll('.flow-btn').forEach(el => el.classList.remove('active'));

    // 顯示目標畫面並反白對應按鈕
    const targetView = document.getElementById('main-flow-' + flowId);
    const targetBtn = document.getElementById('f-btn-' + flowId);

    if (targetView) targetView.style.display = 'block';
    if (targetBtn) targetBtn.classList.add('active');
}

// 2. 模擬搜尋車次
function simulateSearch() {
    const resultsDiv = document.getElementById('search-results');
    const tbody = document.getElementById('train-table-body');

    resultsDiv.style.display = 'block';
    tbody.innerHTML = `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">高鐵</td>
            <td>0813</td>
            <td>1.5 小時</td>
            <td>12</td>
            <td><button class="btn btn-primary btn-sm" onclick="goBookingStage(2)">選擇劃位</button></td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">台鐵 (自強)</td>
            <td>143</td>
            <td>2.5 小時</td>
            <td>38</td>
            <td><button class="btn btn-primary btn-sm" onclick="goBookingStage(2)">選擇劃位</button></td>
        </tr>
    `;
}

// 3. 訂票階段切換 (進度條)
function goBookingStage(stage) {
    document.getElementById('stage-search').style.display = 'none';
    document.getElementById('stage-booking').style.display = 'none';
    document.getElementById('stage-confirm').style.display = 'none';

    // 更新進度條 UI
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    for (let i = 1; i <= stage; i++) {
        const stepEl = document.getElementById('step-ui-' + i);
        if (stepEl) stepEl.classList.add('active');
    }

    // 顯示對應階段
    if (stage === 1) document.getElementById('stage-search').style.display = 'block';
    if (stage === 2) document.getElementById('stage-booking').style.display = 'block';
    if (stage === 3) document.getElementById('stage-confirm').style.display = 'block';
}

// 4. 票種選擇 UI 互動
function selectTicketType(type, rate, name, element) {
    document.querySelectorAll('.ticket-card-sel').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

// 5. Modal 與送出互動
function closeModal() {
    const modal = document.getElementById('action-modal');
    if (modal) modal.style.display = 'none';
}

function executeBooking() {
    alert('確認無誤！準備前往付款系統...');
    goBookingStage(1); // 測試完先跳回首頁
}

// ==========================================
// 6. 劃位系統邏輯 (手動選位)
// ==========================================

function toggleSeatMap() {
    // 取得目前選取的劃位方式
    const method = document.querySelector('input[name="seat-method"]:checked').value;
    const section = document.getElementById('manual-seat-section');

    if (method === 'manual') {
        section.style.display = 'block';
        renderSeats(); // 顯示區塊並產生座位
    } else {
        section.style.display = 'none';
        clearSeats();  // 切回自動配位時，清空已選座位
    }
}

function renderSeats() {
    const container = document.getElementById('seat-map-container');
    // 如果已經畫過座位，就不重複產生
    if (container.innerHTML.trim() !== '') return;

    let html = '';
    const rows = 6; // 模擬 6 排座位
    const cols = ['A', 'B', 'C', 'D']; // 模擬一排 4 個位子 (中間走道)

    for (let i = 1; i <= rows; i++) {
        html += '<div class="seat-row" style="margin-bottom: 8px;">';
        cols.forEach(col => {
            // 隨機模擬有 30% 的位子已經被別人訂走
            const isBooked = Math.random() < 0.3;
            const seatClass = isBooked ? 'seat booked' : 'seat';
            const seatId = `${i}${col}`;

            // 根據是否被訂走，決定能不能點擊 (onclick)
            const clickEvent = isBooked ? '' : `onclick="selectSeat(this, '${seatId}')"`;

            html += `<div class="${seatClass}" ${clickEvent}>${seatId}</div>`;

            // B 和 C 中間插入走道空間
            if (col === 'B') html += '<div style="width: 24px;"></div>';
        });
        html += '</div>';
    }
    container.innerHTML = html;
}

function selectSeat(element, seatId) {
    if (element.classList.contains('booked')) return; // 防呆：已售出的不能點

    const maxPassengers = parseInt(document.getElementById('passenger-count').value) || 1;
    const currentSelected = document.querySelectorAll('.seat.selected');

    // 如果這個位子已經被選了，就取消選取
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
    } else {
        // 如果還沒選滿人數，才可以繼續選
        if (currentSelected.length < maxPassengers) {
            element.classList.add('selected');
        } else {
            alert(`您目前只選擇了 ${maxPassengers} 位乘客，無法劃更多座位！\n若需多選，請更改「乘車人數」。`);
        }
    }

    updateSelectedSeatsDisplay();
}

function updateSelectedSeatsDisplay() {
    const selectedElements = document.querySelectorAll('.seat.selected');
    const displaySpan = document.getElementById('selected-seats-display');

    if (selectedElements.length === 0) {
        displaySpan.innerText = '尚未選擇';
        displaySpan.style.color = 'var(--secondary)';
    } else {
        const seats = Array.from(selectedElements).map(el => el.innerText);
        displaySpan.innerText = seats.join(', ');
        displaySpan.style.color = '#b45309'; // 換個醒目的顏色
    }
}

// 當改變乘車人數時，強制清空目前的劃位重新選
function clearSeats() {
    document.querySelectorAll('.seat.selected').forEach(el => el.classList.remove('selected'));
    updateSelectedSeatsDisplay();
}