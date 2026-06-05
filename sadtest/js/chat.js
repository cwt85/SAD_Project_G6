/* =========================================================
   聊天與客服系統 (chat.js)
   - 使用者端：與管理員一對一對話
   - 管理員端：客服訊息中心，管理多位使用者對話
   - 資料持久化至 localStorage
========================================================= */

const CHAT_STORAGE_KEY = "taitungBookingChat";

// 所有對話資料：key = userId, value = 訊息陣列
let chatConversations = {};

// 管理員當前選中的聊天使用者 ID
let adminSelectedChatUserId = null;

// 聊天室分類：客服、行程討論、投票決策
let activeChatCategory = "service";


/* =========================================================
   初始化
========================================================= */

function initChat() {
  loadChatData();
  bindChatInputEvents();
}

function bindChatInputEvents() {
  // 使用者端 Enter 鍵發送
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 管理員端 Enter 鍵發送
  const adminChatInput = document.getElementById("adminChatInput");
  if (adminChatInput) {
    adminChatInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        adminSendMessage();
      }
    });
  }
}


/* =========================================================
   使用者端：發送訊息
========================================================= */

function sendMessage() {
  try {
    if (!isLoggedIn || !currentUser) {
      alert("請先登入後再使用聊天功能。");
      return;
    }

    if (currentUser.role === "admin") {
      alert("管理員請使用管理員後台的客服訊息中心回覆訊息。");
      return;
    }

    const input = document.getElementById("chatInput");
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
      alert("請輸入訊息內容。");
      return;
    }

    const userId = String(currentUser.id);

    // 確保此使用者的對話陣列存在
    if (!chatConversations[userId]) {
      chatConversations[userId] = [];
    }

    const msg = {
      sender: "customer",
      senderName: currentUser.displayName || currentUser.account,
      senderAccount: currentUser.account,
      text: text,
      time: formatChatTime(),
      read: false
    };

    chatConversations[userId].push(msg);
    input.value = "";

    saveChatData();
    renderUserChat();
    renderAll();
  } catch (error) {
    console.error("訊息傳送失敗：", error);
    alert("訊息傳送失敗，請重新發送。若網路異常，請稍後再試。");
  }
}


/* =========================================================
   管理員端：發送回覆
========================================================= */

function adminSendMessage() {
  try {
    if (!isAdmin()) {
      alert("此功能僅限管理員使用。");
      return;
    }

    if (!adminSelectedChatUserId) {
      alert("請先選擇要回覆的使用者。");
      return;
    }

    const input = document.getElementById("adminChatInput");
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
      alert("請輸入回覆內容。");
      return;
    }

    if (!chatConversations[adminSelectedChatUserId]) {
      chatConversations[adminSelectedChatUserId] = [];
    }

    const msg = {
      sender: "admin",
      senderName: "管理員",
      senderAccount: currentUser.account,
      text: text,
      time: formatChatTime(),
      read: true
    };

    chatConversations[adminSelectedChatUserId].push(msg);
    input.value = "";

    saveChatData();
    renderAdminChat();
    renderAll();
  } catch (error) {
    console.error("管理員回覆失敗：", error);
    alert("訊息傳送失敗，請重新發送。若系統服務異常，請稍後再試。");
  }
}


/* =========================================================
   管理員端：選擇使用者
========================================================= */

function adminSelectChatUser(userId) {
  adminSelectedChatUserId = String(userId);

  // 將該使用者的所有 customer 訊息標為已讀
  const conversation = chatConversations[adminSelectedChatUserId];
  if (conversation) {
    conversation.forEach(msg => {
      if (msg.sender === "customer") {
        msg.read = true;
      }
    });
  }

  saveChatData();
  renderAdminChat();
}


/* =========================================================
   使用者端：渲染自己的對話
========================================================= */

function renderUserChat() {
  const chatBox = document.getElementById("chatBox");
  const emptyState = document.getElementById("chatEmptyState");

  if (!chatBox) return;

  // 未登入或管理員
  if (!isLoggedIn || !currentUser || currentUser.role === "admin") {
    chatBox.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <p>${!isLoggedIn ? "請先登入後使用聊天功能" : "管理員請使用後台客服訊息中心"}</p>
      </div>
    `;
    return;
  }

  const userId = String(currentUser.id);
  const conversation = chatConversations[userId] || [];

  if (conversation.length === 0) {
    chatBox.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <p>尚未有對話紀錄，輸入訊息開始對話吧！</p>
      </div>
    `;
    return;
  }

  // 標記管理員回覆為已讀（使用者查看時）
  conversation.forEach(msg => {
    if (msg.sender === "admin") {
      msg.read = true;
    }
  });
  saveChatData();

  chatBox.innerHTML = conversation.map(msg => {
    const isMe = msg.sender === "customer";
    return `
      <div class="message ${isMe ? "message-customer" : "message-admin"}">
        <div class="message-header">
          <strong>${escapeHtml(msg.senderName)}</strong>
          <span class="message-time">${escapeHtml(msg.time)}</span>
        </div>
        <div class="message-body">${escapeHtml(msg.text)}</div>
      </div>
    `;
  }).join("");

  chatBox.scrollTop = chatBox.scrollHeight;
}


/* =========================================================
   管理員端：渲染客服訊息中心
========================================================= */

function renderAdminChat() {
  renderAdminChatStats();
  renderAdminChatUserList();
  renderAdminChatConversation();
}

function renderAdminChatStats() {
  const stats = document.getElementById("adminChatStats");
  if (!stats) return;

  const userIds = getAdminChatUserIds();
  const totalMessages = userIds.reduce((sum, userId) => sum + chatConversations[userId].length, 0);
  const unreadTotal = userIds.reduce((sum, userId) => sum + getUnreadCount(userId), 0);
  const waitingReplyCount = userIds.filter(userId => {
    const conversation = chatConversations[userId];
    const lastMsg = conversation[conversation.length - 1];
    return lastMsg && lastMsg.sender === "customer";
  }).length;

  stats.innerHTML = `
    <div>
      <span>對話數</span>
      <strong>${userIds.length}</strong>
    </div>
    <div>
      <span>總訊息</span>
      <strong>${totalMessages}</strong>
    </div>
    <div>
      <span>未讀訊息</span>
      <strong>${unreadTotal}</strong>
    </div>
    <div>
      <span>待回覆</span>
      <strong>${waitingReplyCount}</strong>
    </div>
  `;
}

function renderAdminChatUserList() {
  const usersBody = document.getElementById("adminChatUsersBody");
  if (!usersBody) return;

  const userIds = getAdminChatUserIds();

  if (userIds.length === 0) {
    usersBody.innerHTML = `
      <div class="chat-empty-state small">
        <p>尚無使用者訊息</p>
      </div>
    `;
    return;
  }

  usersBody.innerHTML = userIds.map(userId => {
    const conversation = chatConversations[userId];
    const lastMsg = conversation[conversation.length - 1];
    const unreadCount = getUnreadCount(userId);
    const isActive = adminSelectedChatUserId === userId;
    const customer = getAdminChatCustomerInfo(userId, conversation);
    const lastSender = lastMsg.sender === "customer" ? "顧客" : "管理員";

    return `
      <div class="admin-chat-user-item ${isActive ? "active" : ""}" onclick="adminSelectChatUser('${escapeHtml(userId)}')">
        <div class="admin-chat-user-info">
          <div class="admin-chat-user-avatar">${escapeHtml(customer.initial)}</div>
          <div class="admin-chat-user-detail">
            <div class="admin-chat-user-name">${escapeHtml(customer.displayName)}</div>
            <div class="admin-chat-user-account">${escapeHtml(customer.account)}</div>
            <div class="admin-chat-user-preview">${escapeHtml(lastSender)}：${escapeHtml(truncateText(lastMsg.text, 34))}</div>
            <div class="admin-chat-user-footnote">${conversation.length} 則訊息｜使用者 ID ${escapeHtml(userId)}</div>
          </div>
        </div>
        <div class="admin-chat-user-meta">
          <div class="admin-chat-user-time">${escapeHtml(lastMsg.time.split(" ").pop() || lastMsg.time)}</div>
          ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderAdminChatConversation() {
  const convBody = document.getElementById("adminChatConvBody");
  const convHeader = document.getElementById("adminChatConvHeader");
  const convInput = document.getElementById("adminChatConvInput");

  if (!convBody) return;

  if (!adminSelectedChatUserId || !chatConversations[adminSelectedChatUserId]) {
    convBody.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">📩</div>
        <p>請從左側選擇使用者以檢視對話記錄</p>
      </div>
    `;
    if (convHeader) convHeader.innerHTML = `<span>請選擇使用者以檢視對話</span>`;
    if (convInput) convInput.style.display = "none";
    return;
  }

  const conversation = chatConversations[adminSelectedChatUserId];
  const customer = getAdminChatCustomerInfo(adminSelectedChatUserId, conversation);
  const unreadCount = getUnreadCount(adminSelectedChatUserId);
  const lastMsg = conversation[conversation.length - 1];

  // 更新 header
  if (convHeader) {
    convHeader.innerHTML = `
      <div class="admin-chat-conv-header-info">
        <div class="admin-chat-user-avatar small">${escapeHtml(customer.initial)}</div>
        <div>
          <strong>${escapeHtml(customer.displayName)}</strong>
          <span>${escapeHtml(customer.account)}｜ID ${escapeHtml(adminSelectedChatUserId)}</span>
          <span>${conversation.length} 則訊息｜未讀 ${unreadCount}｜最後互動 ${escapeHtml(lastMsg.time)}</span>
        </div>
      </div>
      <button class="secondary-btn" onclick="adminMarkSelectedConversationRead()">標為已讀</button>
    `;
  }

  // 顯示輸入框
  if (convInput) convInput.style.display = "flex";

  // 渲染對話
  convBody.innerHTML = `
    <div class="admin-chat-thread-meta">
      <span>顧客訊息 ${conversation.filter(msg => msg.sender === "customer").length}</span>
      <span>管理員回覆 ${conversation.filter(msg => msg.sender === "admin").length}</span>
      <span>${unreadCount > 0 ? "有未讀訊息" : "已讀"}</span>
    </div>
    ${conversation.map(msg => {
      const isAdmin = msg.sender === "admin";
      return `
        <div class="message ${isAdmin ? "message-admin" : "message-customer"}">
          <div class="message-header">
            <strong>${escapeHtml(msg.senderName)}</strong>
            <span class="message-time">${escapeHtml(msg.time)}</span>
          </div>
          <div class="message-body">${escapeHtml(msg.text)}</div>
        </div>
      `;
    }).join("")}
  `;

  convBody.scrollTop = convBody.scrollHeight;
}

function getAdminChatUserIds() {
  return Object.keys(chatConversations)
    .filter(id => chatConversations[id] && chatConversations[id].length > 0)
    .sort((a, b) => {
      const unreadDiff = getUnreadCount(b) - getUnreadCount(a);
      if (unreadDiff !== 0) return unreadDiff;

      const lastA = chatConversations[a][chatConversations[a].length - 1];
      const lastB = chatConversations[b][chatConversations[b].length - 1];
      return String(lastB.time || "").localeCompare(String(lastA.time || ""));
    });
}

function getAdminChatCustomerInfo(userId, conversation) {
  const customerMsg = conversation.find(msg => msg.sender === "customer");
  const displayName = customerMsg
    ? (customerMsg.senderName || customerMsg.senderAccount || `使用者 ${userId}`)
    : `使用者 ${userId}`;
  const account = customerMsg
    ? (customerMsg.senderAccount || "未提供帳號")
    : "未提供帳號";

  return {
    displayName,
    account,
    initial: String(displayName).charAt(0).toUpperCase()
  };
}

function adminMarkSelectedConversationRead() {
  if (!adminSelectedChatUserId || !chatConversations[adminSelectedChatUserId]) return;

  chatConversations[adminSelectedChatUserId].forEach(msg => {
    if (msg.sender === "customer") {
      msg.read = true;
    }
  });

  saveChatData();
  renderAdminChat();
}


/* =========================================================
   未讀數量計算
========================================================= */

function getUnreadCount(userId) {
  const conversation = chatConversations[userId];
  if (!conversation) return 0;
  return conversation.filter(msg => msg.sender === "customer" && !msg.read).length;
}

function getTotalUnreadCount() {
  let total = 0;
  Object.keys(chatConversations).forEach(userId => {
    total += getUnreadCount(userId);
  });
  return total;
}

function getUserUnreadCount() {
  if (!isLoggedIn || !currentUser || currentUser.role !== "customer") return 0;
  const userId = String(currentUser.id);
  const conversation = chatConversations[userId];
  if (!conversation) return 0;
  return conversation.filter(msg => msg.sender === "admin" && !msg.read).length;
}


/* =========================================================
   localStorage 持久化
========================================================= */

function saveChatData() {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatConversations));
  } catch (error) {
    console.error("聊天資料儲存失敗：", error);
  }
}

function loadChatData() {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      chatConversations = JSON.parse(saved);
    }
  } catch (error) {
    console.error("聊天資料讀取失敗：", error);
    chatConversations = {};
  }
}


/* =========================================================
   渲染入口（由 renderAll 呼叫）
========================================================= */

function renderChat() {
  renderUserChat();
  renderChatCategoryPanels();
  updateChatCategoryUI();

  if (isAdmin()) {
    renderAdminChat();
  }
}

function switchChatCategory(category) {
  activeChatCategory = ["service", "itinerary", "polls"].includes(category) ? category : "service";
  renderChatCategoryPanels();
  updateChatCategoryUI();
}

function openChatCategory(category) {
  activeChatCategory = ["service", "itinerary", "polls"].includes(category) ? category : "service";
  showSection("chat");
  renderChatCategoryPanels();
  updateChatCategoryUI();
}

function updateChatCategoryUI() {
  document.querySelectorAll(".chat-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.chatCategory === activeChatCategory);
  });

  const panels = {
    service: document.getElementById("serviceChatPanel"),
    itinerary: document.getElementById("itineraryChatPanel"),
    polls: document.getElementById("pollChatPanel")
  };

  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle("active", key === activeChatCategory);
  });

  const subtitle = document.getElementById("chatSubtitle");
  if (!subtitle) return;

  const subtitles = {
    service: "客服訊息會由平台管理員回覆。",
    itinerary: "行程留言集中在這裡，方便和同行成員討論每日安排。",
    polls: "投票決策集中在這裡，適合決定住宿、景點與交通選項。"
  };
  subtitle.textContent = subtitles[activeChatCategory] || subtitles.service;
}

function renderChatCategoryPanels() {
  renderItineraryChatPanel();
  renderPollChatPanel();
}

function renderItineraryChatPanel() {
  const panel = document.getElementById("itineraryChatPanel");
  if (!panel) return;

  const itinerary = getChatItinerary();
  if (!itinerary) {
    panel.innerHTML = buildChatItineraryEmptyState("請先登入並選擇一個行程，才能使用行程討論。");
    return;
  }

  panel.innerHTML = `
    <div class="chat-linked-header">
      <div>
        <span class="status-pill">A 行程規劃</span>
        <h3>${escapeHtml(itinerary.name)}</h3>
        <p>${escapeHtml(itinerary.startDate)} ~ ${escapeHtml(itinerary.endDate)}，${escapeHtml(itinerary.destination)}</p>
      </div>
      <button class="secondary-btn" onclick="showSection('itinerary')">回到行程</button>
    </div>
    ${renderCommentPanel(itinerary)}
  `;
  setTimeout(scrollItineraryDiscussionToBottom, 0);
}

function renderPollChatPanel() {
  const panel = document.getElementById("pollChatPanel");
  if (!panel) return;

  const itinerary = getChatItinerary();
  if (!itinerary) {
    panel.innerHTML = buildChatItineraryEmptyState("請先登入並選擇一個行程，才能建立投票。");
    return;
  }

  panel.innerHTML = `
    <div class="chat-linked-header">
      <div>
        <span class="status-pill">投票決策</span>
        <h3>${escapeHtml(itinerary.name)}</h3>
        <p>把原本行程內的投票功能移到聊天室分類，討論與決策分開管理。</p>
      </div>
      <button class="secondary-btn" onclick="showSection('itinerary')">回到行程</button>
    </div>
    ${renderVotingPanel(itinerary)}
  `;
}

function getChatItinerary() {
  if (!isLoggedIn || !currentUser || currentUser.role === "admin") return null;

  const active = typeof getActiveItinerary === "function" ? getActiveItinerary() : null;
  if (active && (typeof canAccessItinerary !== "function" || canAccessItinerary(active))) return active;

  const visible = typeof getVisibleItineraries === "function" ? getVisibleItineraries() : [];
  return visible[0] || null;
}

function buildChatItineraryEmptyState(message) {
  return `
    <div class="chat-empty-state">
      <div class="chat-empty-icon">💬</div>
      <p>${escapeHtml(message)}</p>
      <button class="primary-btn" onclick="showSection('itinerary')">前往行程規劃</button>
    </div>
  `;
}


/* =========================================================
   工具函式
========================================================= */

function formatChatTime() {
  const now = new Date();
  return now.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function truncateText(text, maxLen) {
  if (!text) return "";
  return text.length > maxLen ? text.substring(0, maxLen) + "…" : text;
}


/* =========================================================
   DOMContentLoaded 初始化
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  initChat();
});
