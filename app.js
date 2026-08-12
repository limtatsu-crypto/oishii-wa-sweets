/* =====================================================================
   app.js  —  サイトの動きを作る本体
   ★ ここは触らなくてOKです。内容の変更は week.js / menu.js / config.js で。★
   ===================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var WEEKLY = window.WEEKLY_SPECIAL || {};
  var ITEMS = window.STANDARD_ITEMS || [];
  var SCHED = window.SALES_SCHEDULE || {};
  var WA_BASE = "https://wa.me/" + (CFG.whatsappNumber || "");

  // ---- WhatsAppアイコン ----
  var WA_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex:none"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.7.8-.9 1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4a.5.5 0 0 0 0-.5c-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7.1.2 1.9 2.9 4.7 4a5.4 5.4 0 0 0 1.6.4 3.6 3.6 0 0 0 2.4-.6 2 2 0 0 0 .8-1.4c0-.2.1-.9-.1-1z"/></svg>';

  // ---- 便利関数 ----
  function pad(n) { return String(n).padStart(2, "0"); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function waLink(text) { return WA_BASE + "?text=" + encodeURIComponent(text); }

  // 写真スロット（写真があれば表示、無ければ準備中プレースホルダー）
  function imageSlot(file, placeholder, styleExtra) {
    var s = styleExtra || "";
    if (file) {
      return '<div style="' + s + 'border-radius:14px;overflow:hidden;background:#efe7db">' +
        '<img src="images/' + esc(file) + '" alt="' + esc(placeholder) + '" style="width:100%;height:100%;object-fit:cover;display:block"/></div>';
    }
    return '<div style="' + s + 'border-radius:14px;background:repeating-linear-gradient(45deg,#f2ece1,#f2ece1 10px,#efe7db 10px,#efe7db 20px);border:1.5px dashed rgba(198,54,43,0.35);display:flex;align-items:center;justify-content:center;text-align:center;color:#9a7c66;font-size:12px;padding:8px;line-height:1.5">' + esc(placeholder) + '</div>';
  }

  // ---- 締切カウントダウン（毎週木曜18時） ----
  function nextDeadline(now) {
    var d = new Date(now);
    var day = d.getDay();
    var daysUntilThu = (4 - day + 7) % 7;
    var deadline = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilThu, 18, 0, 0);
    if (deadline.getTime() <= now) deadline = new Date(deadline.getTime() + 7 * 864e5);
    return deadline;
  }
  function formatCountdown(now) {
    var diff = Math.max(0, nextDeadline(now).getTime() - now);
    var days = Math.floor(diff / 864e5);
    var hours = Math.floor((diff % 864e5) / 36e5);
    var mins = Math.floor((diff % 36e5) / 6e4);
    var secs = Math.floor((diff % 6e4) / 1e3);
    if (days > 0) return "あと" + days + "日" + pad(hours) + "時間 / " + days + "d " + hours + "h left";
    return "あと" + pad(hours) + ":" + pad(mins) + ":" + pad(secs) + " / " + hours + "h " + mins + "m left";
  }

  // ---- カレンダー ----
  var WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
  var MONTH_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function buildCalendarHTML(now) {
    var d = new Date(now), year = d.getFullYear(), month = d.getMonth();
    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var kiosk = SCHED.kioskDays || [], online = SCHED.onlineDays || [];
    var html = "";
    for (var i = 0; i < firstDow; i++) html += '<div></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var color = "#2B211C", bg = "transparent";
      if (kiosk.indexOf(day) > -1) { color = "#fff"; bg = "#C6362B"; }
      else if (online.indexOf(day) > -1) { color = "#fff"; bg = "#2B211C"; }
      html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:13px;font-weight:700;color:' + color + ';background:' + bg + '">' + day + '</div>';
    }
    var monthLabel = year + "年" + (month + 1) + "月 / " + MONTH_EN[month] + " " + year;
    return { html: html, monthLabel: monthLabel };
  }

  // =====================================================================
  //  状態（ユーザーが選んだ数量など）
  // =====================================================================
  var state = {
    page: "home",
    now: Date.now(),
    weeklyQty: 1,
    weeklyIncluded: true,
    // selections[itemId] = [{flavorIdx, qty}, ...]
    selections: {},
    // included[itemId] = true/false
    included: {},
  };

  function getLines(id) {
    if (!state.selections[id]) state.selections[id] = [{ flavorIdx: 0, qty: 1 }];
    return state.selections[id];
  }

  // =====================================================================
  //  価格計算
  // =====================================================================
  function weeklyTotal() { return (WEEKLY.unitPrice || 0) * state.weeklyQty; }

  function itemTotal(item) {
    var lines = getLines(item.id), sum = 0;
    for (var i = 0; i < lines.length; i++) {
      var fl = item.flavors[lines[i].flavorIdx] || item.flavors[0];
      sum += (fl ? fl.price : 0) * lines[i].qty;
    }
    return sum;
  }

  function standardGrandTotal() {
    var sum = 0;
    for (var i = 0; i < ITEMS.length; i++) {
      if (state.included[ITEMS[i].id]) sum += itemTotal(ITEMS[i]);
    }
    return sum;
  }

  function orderGrandTotal() {
    return (state.weeklyIncluded ? weeklyTotal() : 0) + standardGrandTotal();
  }

  // =====================================================================
  //  WhatsApp注文メッセージ
  // =====================================================================
  function weeklyOrderText() {
    return "【今週の限定を注文したいです】\n" + (WEEKLY.nameJp || "") + " × " + state.weeklyQty + " 個\n合計: RM" + weeklyTotal() + "\n\n(I'd like to order this week's special)";
  }
  function itemOrderText(item) {
    var lines = getLines(item.id), body = "";
    for (var i = 0; i < lines.length; i++) {
      var fl = item.flavors[lines[i].flavorIdx] || item.flavors[0];
      body += "・" + item.jp + "（" + (fl ? fl.jp : "") + "）× " + lines[i].qty + " = RM" + ((fl ? fl.price : 0) * lines[i].qty) + "\n";
    }
    return "【" + item.jp + " を注文したいです】\n" + body + "小計: RM" + itemTotal(item);
  }
  function combinedOrderText() {
    var t = "【まとめて注文したいです / Combined order】\n\n";
    if (state.weeklyIncluded && weeklyTotal() > 0) {
      t += "■ 今週の限定\n・" + (WEEKLY.nameJp || "") + " × " + state.weeklyQty + " = RM" + weeklyTotal() + "\n\n";
    }
    for (var i = 0; i < ITEMS.length; i++) {
      var item = ITEMS[i];
      if (!state.included[item.id]) continue;
      var lines = getLines(item.id);
      t += "■ " + item.jp + "\n";
      for (var j = 0; j < lines.length; j++) {
        var fl = item.flavors[lines[j].flavorIdx] || item.flavors[0];
        t += "・" + (fl ? fl.jp : "") + " × " + lines[j].qty + " = RM" + ((fl ? fl.price : 0) * lines[j].qty) + "\n";
      }
      t += "\n";
    }
    t += "ご注文合計 / Order Total: RM" + orderGrandTotal();
    return t;
  }

  // =====================================================================
  //  操作（ボタンから呼ばれる）
  // =====================================================================
  window.APP = {
    go: function (page) { state.page = page; window.scrollTo(0, 0); render(); },

    weeklyDec: function () { if (state.weeklyQty > 1) state.weeklyQty--; render(); },
    weeklyInc: function () { state.weeklyQty++; render(); },
    toggleWeekly: function () { state.weeklyIncluded = !state.weeklyIncluded; render(); },

    toggleItem: function (id) { state.included[id] = !state.included[id]; render(); },
    lineDec: function (id, idx) { var l = getLines(id); if (l[idx].qty > 1) l[idx].qty--; render(); },
    lineInc: function (id, idx) { getLines(id)[idx].qty++; render(); },
    lineFlavor: function (id, idx, v) { getLines(id)[idx].flavorIdx = Number(v); render(); },
    addLine: function (id) { getLines(id).push({ flavorIdx: 0, qty: 1 }); render(); },
    removeLine: function (id, idx) { var l = getLines(id); if (l.length > 1) { l.splice(idx, 1); render(); } },

    orderWeekly: function () { window.open(waLink(weeklyOrderText()), "_blank"); },
    orderItem: function (id) { var it = findItem(id); if (it) window.open(waLink(itemOrderText(it)), "_blank"); },
    orderCombined: function () { window.open(waLink(combinedOrderText()), "_blank"); },
    askGeneral: function () { window.open(waLink("こんにちは、Oishii 和 Sweets について質問があります。/ Hello, I have a question about Oishii Wa Sweets."), "_blank"); },
  };

  function findItem(id) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i]; return null; }

  // =====================================================================
  //  画面の組み立て（HTMLを作る）
  // =====================================================================
  var C = { red: "#C6362B", dark: "#2B211C", cream: "#FAF6EE", brown: "#6b4a35", ink: "#4a362a" };

  function header() {
    function navBtn(label, page) {
      var active = state.page === page;
      return '<button onclick="APP.go(\'' + page + '\')" style="border:none;font-family:\'Noto Sans JP\',sans-serif;font-size:14px;font-weight:700;padding:8px 10px;border-radius:999px;cursor:pointer;color:' + (active ? "#fff" : C.dark) + ';background-color:' + (active ? C.red : "transparent") + '">' + label + '</button>';
    }
    return '<header style="position:sticky;top:0;z-index:50;background:rgba(250,246,238,0.94);backdrop-filter:blur(6px);border-bottom:1px solid rgba(198,54,43,0.18);display:flex;align-items:center;justify-content:space-between;padding:10px 18px;gap:10px">' +
      '<div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="APP.go(\'home\')">' +
      '<img src="assets/logo.png" alt="Oishii 和 Sweets" style="width:44px;height:44px;object-fit:contain;flex:none"/>' +
      '<div style="display:flex;flex-direction:column;line-height:1.1">' +
      '<span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;color:' + C.red + '">Oishii 和 Sweets</span>' +
      '<span style="font-size:11px;letter-spacing:0.06em;color:' + C.brown + '">HANDMADE WAGASHI · KUALA LUMPUR</span>' +
      '</div></div>' +
      '<nav style="display:flex;align-items:center;gap:4px">' + navBtn("HOME", "home") + navBtn("注文 / ORDER", "order") + navBtn("STORY", "story") + '</nav>' +
      '</header>';
  }

  function footer() {
    return '<footer style="background:' + C.dark + ';color:#ddceBD;padding:30px 20px;text-align:center">' +
      '<img src="assets/logo.png" alt="" style="width:40px;height:40px;object-fit:contain;margin:0 auto 10px;display:block;opacity:0.9"/>' +
      '<div style="font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:13px;color:#fff;margin-bottom:4px">Oishii 和 Sweets</div>' +
      '<div style="font-size:12px;margin-bottom:14px">Handmade Wagashi · Kuala Lumpur</div>' +
      '<a href="#" onclick="APP.askGeneral();return false;" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:13px;border:1px solid rgba(255,255,255,0.3);padding:8px 14px;border-radius:999px">' + WA_ICON + ' ' + esc(CFG.whatsappDisplay) + '</a>' +
      '<div style="font-size:11px;margin-top:16px;color:' + C.brown + '">© Oishii 和 Sweets</div></footer>';
  }

  // ---------- HOME ----------
  function homePage() {
    var cal = buildCalendarHTML(state.now);
    var wdRow = WEEKDAY_LABELS.map(function (w) { return '<div style="font-size:11px;font-weight:700;color:' + C.brown + ';padding:4px 0">' + w + '</div>'; }).join("");
    var stdPreview = ITEMS.map(function (it) {
      var flavorLabel = it.flavors.length > 1 ? '<div style="font-size:11px;color:' + C.red + ';margin-top:4px">' + it.flavors.length + '種類 / flavours</div>' : "";
      return '<div style="background:' + C.cream + ';border-radius:16px;overflow:hidden;border:1px solid rgba(198,54,43,0.10)">' +
        imageSlot(it.image, it.jp + "の写真", "width:100%;height:110px;") +
        '<div style="padding:10px 12px"><div style="font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:13px;color:' + C.dark + '">' + esc(it.jp) + '</div>' +
        '<div style="font-size:12px;color:' + C.brown + '">' + esc(it.en) + '</div>' + flavorLabel + '</div></div>';
    }).join("");

    return '<div>' +
      // HERO
      '<section style="position:relative;padding:56px 20px 44px;text-align:center;overflow:hidden;background:radial-gradient(circle at 50% 0%, rgba(198,54,43,0.08), transparent 60%)">' +
      '<img src="assets/logo.png" alt="Oishii 和 Sweets logo" style="width:150px;height:150px;object-fit:contain;margin:0 auto 18px;display:block"/>' +
      '<h1 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:30px;margin:0 0 8px;color:' + C.dark + ';line-height:1.35">手作りの温かみを、<br/>クアラルンプールへ。</h1>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 26px;letter-spacing:0.02em">Handmade Japanese wagashi, delivered warm to your door in KL.</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;max-width:340px;margin:0 auto">' +
      '<button onclick="APP.go(\'order\')" style="border:none;background:' + C.red + ';color:#fff;font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:15px;padding:15px 20px;border-radius:999px;cursor:pointer;box-shadow:0 8px 20px rgba(198,54,43,0.28)">今週の限定を見る / This Week\'s Specials</button>' +
      '<a href="#" onclick="APP.askGeneral();return false;" style="text-decoration:none;border:1.5px solid ' + C.red + ';color:' + C.red + ';font-weight:700;font-size:14px;padding:13px 20px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px">' + WA_ICON + ' WhatsAppで質問する / Ask on WhatsApp</a>' +
      '</div></section>' +

      // THIS WEEK TEASER
      '<section style="padding:8px 20px 40px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(43,33,28,0.08);border:1px solid rgba(198,54,43,0.12)">' +
      '<div style="padding:14px 18px 0;display:flex;align-items:center;justify-content:space-between"><span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:13px;color:' + C.red + ';letter-spacing:0.04em">今週の限定 / THIS WEEK</span><span style="background:' + C.red + ';color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">残りわずか · LIMITED</span></div>' +
      '<div style="padding:14px 18px">' + imageSlot(WEEKLY.image, "今週の限定商品の写真 / Weekly special photo", "width:100%;height:220px;") + '</div>' +
      '<div style="padding:0 18px 20px">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-size:19px;margin:0 0 2px;color:' + C.dark + '">限定の大福・和菓子</h3>' +
      '<p style="font-size:12px;color:' + C.brown + ';margin:0 0 8px">Limited-Edition Daifuku &amp; Wagashi</p>' +
      '<p style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:24px;margin:0 0 6px;color:' + C.red + '">' + esc(WEEKLY.nameJp) + '<span style="font-size:14px;font-weight:700;color:' + C.dark + '"> — ' + esc(WEEKLY.priceLabel) + '</span></p>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 10px">' + esc(WEEKLY.nameEn) + ' — ' + esc(WEEKLY.priceEn) + '</p>' +
      '<p style="font-size:14px;color:' + C.ink + ';margin:0 0 10px;line-height:1.7">' + esc(WEEKLY.descJp) + '<br/><span style="font-size:13px;color:' + C.brown + '">' + esc(WEEKLY.descEn) + '</span></p>' +
      '<p style="font-size:14px;color:' + C.ink + ';margin:0 0 12px">数量限定・売り切れ次第終了です。詳細・価格はWhatsAppでご確認ください。<br/>Quantity limited, while stocks last. Ask WhatsApp for details &amp; price.</p>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;background:' + C.cream + ';border-radius:12px;padding:10px 14px;margin-bottom:14px"><span style="font-size:13px;color:' + C.ink + '">注文締切まで / Order deadline</span><span data-countdown style="font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:13px;color:' + C.red + '">' + formatCountdown(state.now) + '</span></div>' +
      '<button onclick="APP.go(\'order\')" style="width:100%;border:none;background:' + C.dark + ';color:#fff;font-weight:700;font-size:13px;padding:14px;border-radius:999px;cursor:pointer">詳しく見て注文する / View &amp; Order</button>' +
      '</div></div></section>' +

      // STANDARD PREVIEW
      '<section style="padding:8px 20px 44px;background:#fff"><h2 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:20px;text-align:center;margin:24px 0 4px;color:' + C.dark + '">定番商品 <span style="font-size:13px;color:' + C.brown + ';font-weight:500;display:block;margin-top:4px">Everyday Favourites</span></h2>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:520px;margin:22px auto 0">' + stdPreview + '</div></section>' +

      // ORDER FLOW
      '<section style="padding:44px 20px"><h2 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:20px;text-align:center;margin:0 0 26px;color:' + C.dark + '">注文の流れ <span style="font-size:13px;color:' + C.brown + ';font-weight:500;display:block;margin-top:4px">How to Order</span></h2>' +
      '<div style="display:flex;flex-direction:column;gap:16px;max-width:420px;margin:0 auto">' +
      flowStep("1", "WhatsAppで注文", "Message us on WhatsApp") +
      flowStep("2", "確認のご連絡", "We confirm your order") +
      '<div style="display:flex;gap:14px;align-items:flex-start"><div style="flex:none;width:34px;height:34px;border-radius:50%;background:' + C.red + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:\'Noto Serif JP\',serif">3</div><div style="flex:1"><div style="font-weight:700;font-size:14px">QRコードでお支払い(WhatsAppで送信)</div><div style="font-size:13px;color:' + C.brown + ';margin-bottom:8px">Pay via QR code (sent over WhatsApp)</div>' + imageSlot("", "お支払い用QRコード / Payment QR code", "width:120px;height:120px;") + '</div></div>' +
      flowStep("4", "Grabでお届け", "Delivered by Grab") +
      '</div></section>' +

      // DELIVERY INFO
      '<section style="padding:0 20px 44px"><div style="max-width:480px;margin:0 auto;background:' + C.dark + ';border-radius:20px;padding:24px 22px;color:#F3E8DB">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;margin:0 0 12px;color:#fff">配送について / Delivery</h3>' +
      '<div style="display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.6">' +
      '<div>📍 配送エリア：クアラルンプール市内限定<br/><span style="color:#ddceBD">Delivery area: within Kuala Lumpur city only</span></div>' +
      '<div>🛵 Grab配送でお届けします<br/><span style="color:#ddceBD">Delivered via Grab</span></div>' +
      '<div>📅 ご注文期限：前週の日曜日まで<br/><span style="color:#ddceBD">Order deadline: by Sunday the week before</span></div>' +
      '<div>🕒 お届け日：水曜日<br/><span style="color:#ddceBD">Delivery day: Wednesday</span></div>' +
      '<div>💰 商品代金はQRコードでの先払い、配送費(Grab実費)は確定後に改めて別途ご請求します。お手数をお掛けして申し訳ございませんが、ご了承ください。<br/><span style="color:#ddceBD">Item total is paid upfront via QR code; delivery fee (actual Grab cost) is billed separately afterward, once confirmed. We apologize for the inconvenience and thank you for your understanding.</span></div>' +
      '</div></div></section>' +

      // KIOSK
      '<section style="padding:0 20px 44px"><div style="max-width:480px;margin:0 auto;border:1.5px dashed rgba(198,54,43,0.4);border-radius:20px;padding:22px">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;margin:0 0 10px;color:' + C.red + '">週末キオスク販売 / Weekend Kiosk</h3>' +
      '<p style="font-size:14px;line-height:1.7;color:' + C.ink + ';margin:0">KL日本人会内、ロビーキオスクにて対面販売しております。<br/><span style="color:' + C.brown + '">Sold in person at the lobby kiosk, Japan Club of Kuala Lumpur.</span><br/><br/>販売日：毎週土・日曜日（開催していない場合もございます。スケジュールをご確認ください）<br/><span style="color:' + C.brown + '">Days: Saturdays &amp; Sundays (not every week — please check the schedule)</span><br/><br/>販売時間：10:00〜18:00<br/><span style="color:' + C.brown + '">Hours: 10am–6pm</span></p></div></section>' +

      // CALENDAR
      '<section style="padding:0 20px 44px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:22px;border:1px solid rgba(198,54,43,0.12);box-shadow:0 10px 30px rgba(43,33,28,0.06)">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;margin:0 0 4px;color:' + C.dark + '">販売スケジュール / Sales Schedule</h3>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 14px">' + cal.monthLabel + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;margin-bottom:8px">' + wdRow + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' + cal.html + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;font-size:12px">' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:4px;background:' + C.red + ';flex:none"></span>キオスク販売日（土・日）/ Kiosk sale days (Sat &amp; Sun)</div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:4px;background:' + C.dark + ';flex:none"></span>オンライン販売日（水）/ Online sale day (Wed)</div></div>' +
      (SCHED.specialNoteJp ? '<div style="margin-top:14px;background:' + C.cream + ';border-radius:12px;padding:12px 14px"><p style="font-size:13px;color:' + C.red + ';font-weight:700;margin:0 0 4px">📌 今月の特別販売 / Special this month</p><p style="font-size:13px;color:' + C.ink + ';margin:0;line-height:1.6">' + esc(SCHED.specialNoteJp) + '<br/><span style="color:' + C.brown + '">' + esc(SCHED.specialNoteEn) + '</span></p></div>' : "") +
      '<p style="font-size:12px;color:' + C.brown + ';margin:16px 0 0;line-height:1.6">※ スケジュールは変更になる場合があります。最新情報はWhatsAppでご確認ください。<br/><span style="color:' + C.ink + '">Schedule may change without notice — please confirm the latest via WhatsApp.</span></p>' +
      '</div></section>' +

      // STORY TEASER
      '<section style="padding:0 20px 50px"><div style="max-width:480px;margin:0 auto;text-align:center">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:18px;margin:0 0 10px;color:' + C.dark + '">日本の手作りの和菓子を、<br/>クアラルンプールで楽しめます。</h3>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 16px">Handmade Japanese wagashi, made to enjoy right here in KL.</p>' +
      '<button onclick="APP.go(\'story\')" style="border:none;background:none;color:' + C.red + ';font-weight:700;font-size:13px;cursor:pointer;text-decoration:underline">ストーリーを読む / Read Our Story →</button>' +
      '</div></section>' +
      '</div>';
  }

  function flowStep(n, jp, en) {
    return '<div style="display:flex;gap:14px;align-items:flex-start"><div style="flex:none;width:34px;height:34px;border-radius:50%;background:' + C.red + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:\'Noto Serif JP\',serif">' + n + '</div><div><div style="font-weight:700;font-size:14px">' + jp + '</div><div style="font-size:13px;color:' + C.brown + '">' + en + '</div></div></div>';
  }

  // ---------- ORDER ----------
  function orderPage() {
    var itemsHTML = ITEMS.map(function (item) {
      var lines = getLines(item.id);
      var hasFlavors = item.flavors.length > 1;
      var linesHTML = lines.map(function (line, idx) {
        var fl = item.flavors[line.flavorIdx] || item.flavors[0];
        var flavorSelect = "";
        if (hasFlavors) {
          var opts = item.flavors.map(function (f, i) { return '<option value="' + i + '"' + (i === line.flavorIdx ? " selected" : "") + '>' + esc(f.jp) + ' / ' + esc(f.en) + '</option>'; }).join("");
          flavorSelect = '<select onchange="APP.lineFlavor(\'' + item.id + '\',' + idx + ',this.value)" style="flex:1;min-width:0;font-size:13px;color:' + C.dark + ';background:' + C.cream + ';border:1px solid rgba(198,54,43,0.2);border-radius:10px;padding:8px;font-family:\'Noto Sans JP\',sans-serif">' + opts + '</select>';
        }
        var removeBtn = lines.length > 1 ? '<button onclick="APP.removeLine(\'' + item.id + '\',' + idx + ')" style="flex:none;width:24px;height:24px;border:none;border-radius:50%;background:none;color:' + C.brown + ';font-size:15px;cursor:pointer">×</button>' : "";
        return '<div style="display:flex;flex-direction:column;gap:3px"><div style="display:flex;align-items:center;gap:8px">' + flavorSelect +
          '<div style="display:flex;align-items:center;gap:8px;background:' + C.cream + ';border-radius:999px;padding:4px 6px;flex:none">' +
          '<button onclick="APP.lineDec(\'' + item.id + '\',' + idx + ')" style="width:24px;height:24px;border:none;border-radius:50%;background:#fff;color:' + C.red + ';font-weight:700;font-size:14px;cursor:pointer">−</button>' +
          '<span style="font-size:13px;font-weight:700;min-width:14px;text-align:center">' + line.qty + '</span>' +
          '<button onclick="APP.lineInc(\'' + item.id + '\',' + idx + ')" style="width:24px;height:24px;border:none;border-radius:50%;background:#fff;color:' + C.red + ';font-weight:700;font-size:14px;cursor:pointer">＋</button>' +
          '</div>' + removeBtn + '</div>' +
          '<div style="font-size:11px;color:' + C.brown + ';padding-left:2px">RM' + (fl ? fl.price : 0) + ' × ' + line.qty + ' = RM' + ((fl ? fl.price : 0) * line.qty) + '</div></div>';
      }).join("");
      var addLineBtn = hasFlavors ? '<button onclick="APP.addLine(\'' + item.id + '\')" style="align-self:flex-start;border:none;background:none;color:' + C.red + ';font-size:12px;font-weight:700;cursor:pointer;padding:2px 0">＋ フレーバーを追加 / Add flavour</button>' : "";
      return '<div style="display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid rgba(198,54,43,0.12);border-radius:16px;padding:12px">' +
        '<div style="display:flex;gap:12px;align-items:center">' + imageSlot(item.image, item.jp, "width:64px;height:64px;flex:none;") +
        '<div style="flex:1;min-width:0"><div style="font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:14px;color:' + C.dark + '">' + esc(item.jp) + '</div><div style="font-size:12px;color:' + C.brown + '">' + esc(item.en) + '</div></div>' +
        '<label style="flex:none;display:flex;align-items:center;gap:6px;font-size:11px;color:' + C.ink + ';cursor:pointer"><input type="checkbox"' + (state.included[item.id] ? " checked" : "") + ' onchange="APP.toggleItem(\'' + item.id + '\')" style="width:16px;height:16px;accent-color:' + C.red + '"/>まとめ注文に追加</label></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + linesHTML + addLineBtn +
        '<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(198,54,43,0.12);padding-top:8px"><span style="font-size:12px;color:' + C.ink + '">小計 / Subtotal</span><span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:15px;color:' + C.dark + '">RM' + itemTotal(item) + '</span></div>' +
        '<button onclick="APP.orderItem(\'' + item.id + '\')" style="text-align:center;border:none;background:' + C.red + ';color:#fff;font-weight:700;font-size:13px;padding:10px 12px;border-radius:999px;cursor:pointer">注文 / Order</button>' +
        '</div></div>';
    }).join("");

    var anyIncluded = state.included && (Object.keys(state.included).some(function (k) { return state.included[k]; }) || state.weeklyIncluded);

    return '<div>' +
      '<section style="padding:40px 20px 20px;text-align:center;background:radial-gradient(circle at 50% 0%, rgba(198,54,43,0.08), transparent 60%)">' +
      '<h1 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:24px;margin:0 0 6px;color:' + C.dark + '">今週の限定 &amp; 注文</h1>' +
      '<p style="font-size:14px;color:' + C.brown + ';margin:0">This Week\'s Specials &amp; Ordering</p></section>' +

      // WEEKLY ORDER CARD
      '<section style="padding:20px 20px 10px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(43,33,28,0.08);border:1px solid rgba(198,54,43,0.12)">' +
      '<div style="padding:16px 18px 0;display:flex;align-items:center;justify-content:space-between"><span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:13px;color:' + C.red + ';letter-spacing:0.04em">今週の限定 / THIS WEEK</span><span style="background:' + C.red + ';color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px">残りわずか · LIMITED</span></div>' +
      '<div style="padding:14px 18px">' + imageSlot(WEEKLY.image, "今週の限定商品の写真 / Weekly special photo", "width:100%;height:240px;") + '</div>' +
      '<div style="padding:0 18px 22px">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-size:20px;margin:0 0 2px;color:' + C.dark + '">限定の大福・和菓子</h3>' +
      '<p style="font-size:12px;color:' + C.brown + ';margin:0 0 8px">Limited-Edition Daifuku &amp; Wagashi</p>' +
      '<p style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:26px;margin:0 0 6px;color:' + C.red + '">' + esc(WEEKLY.nameJp) + '<span style="font-size:15px;font-weight:700;color:' + C.dark + '"> — ' + esc(WEEKLY.priceLabel) + '</span></p>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 10px">' + esc(WEEKLY.nameEn) + ' — ' + esc(WEEKLY.priceEn) + '</p>' +
      '<p style="font-size:14px;color:' + C.ink + ';margin:0 0 12px;line-height:1.7">' + esc(WEEKLY.descJp) + '<br/><span style="font-size:13px;color:' + C.brown + '">' + esc(WEEKLY.descEn) + '</span></p>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;background:' + C.cream + ';border-radius:12px;padding:12px 14px;margin-bottom:16px"><span style="font-size:13px;color:' + C.ink + '">注文締切まで / Order deadline</span><span data-countdown style="font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:14px;color:' + C.red + '">' + formatCountdown(state.now) + '</span></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div style="display:flex;align-items:center;gap:12px;background:' + C.cream + ';border-radius:999px;padding:5px 8px">' +
      '<button onclick="APP.weeklyDec()" style="width:30px;height:30px;border:none;border-radius:50%;background:#fff;color:' + C.red + ';font-weight:700;font-size:16px;cursor:pointer">−</button>' +
      '<span style="font-size:15px;font-weight:700;min-width:18px;text-align:center">' + state.weeklyQty + '</span>' +
      '<button onclick="APP.weeklyInc()" style="width:30px;height:30px;border:none;border-radius:50%;background:#fff;color:' + C.red + ';font-weight:700;font-size:16px;cursor:pointer">＋</button></div>' +
      '<span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;color:' + C.dark + '">RM' + weeklyTotal() + '</span></div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:' + C.ink + ';cursor:pointer;margin-bottom:12px"><input type="checkbox"' + (state.weeklyIncluded ? " checked" : "") + ' onchange="APP.toggleWeekly()" style="width:16px;height:16px;accent-color:' + C.red + '"/>まとめ注文に追加 / Add to combined order</label>' +
      '<button onclick="APP.orderWeekly()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:none;background:' + C.red + ';color:#fff;font-weight:700;font-size:14px;padding:15px;border-radius:999px;cursor:pointer;box-shadow:0 8px 20px rgba(198,54,43,0.28)">' + WA_ICON + ' この商品をWhatsAppで注文 / Order via WhatsApp</button>' +
      '</div></div></section>' +

      // STANDARD ITEMS
      '<section style="padding:30px 20px 10px"><h2 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:18px;text-align:center;margin:0 0 4px;color:' + C.dark + '">定番商品</h2><p style="font-size:13px;color:' + C.brown + ';text-align:center;margin:0 0 20px">Everyday Favourites</p>' +
      '<div style="display:flex;flex-direction:column;gap:12px;max-width:480px;margin:0 auto">' + itemsHTML + '</div>' +

      // COMBINED TOTAL
      '<div style="max-width:480px;margin:16px auto 0;background:' + C.dark + ';border-radius:14px;padding:16px 18px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#ddceBD;margin-bottom:6px"><span>今週の限定 / Weekly Special</span><span>RM' + (state.weeklyIncluded ? weeklyTotal() : 0) + '</span></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#ddceBD;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:10px"><span>定番商品 / Standard Items</span><span>RM' + standardGrandTotal() + '</span></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><span style="font-size:14px;color:#fff;font-weight:700">ご注文合計 / Order Total</span><span style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:20px;color:#fff">RM' + orderGrandTotal() + '</span></div>' +
      (anyIncluded
        ? '<button onclick="APP.orderCombined()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:none;background:' + C.red + ';color:#fff;font-weight:700;font-size:14px;padding:14px;border-radius:999px;cursor:pointer">' + WA_ICON + ' 全部まとめてWhatsAppで注文する / Send Combined Order</button>'
        : '<p style="font-size:11px;color:#ddceBD;text-align:center;margin:10px 0 0">上の「まとめ注文に追加」にチェックを入れた商品がここに含まれます。<br/>Items checked "Add to combined order" above are included here.</p>') +
      '<p style="font-size:11px;color:#ddceBD;text-align:center;margin:10px 0 0">※ 上記合計は商品代金のみです(QRコードで先払い)。配送費(Grab実費)は確定後に改めて別途ご請求します。お手数をお掛けして申し訳ございませんが、ご了承ください。<br/>Above total is for items only (paid upfront via QR). Delivery fee (actual Grab cost) will be billed separately afterward. We apologize for the inconvenience and thank you for your understanding.</p>' +
      '</div></section>' +

      // DELIVERY
      '<section style="padding:34px 20px 10px"><div style="max-width:480px;margin:0 auto;background:' + C.dark + ';border-radius:20px;padding:22px;color:#F3E8DB">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:15px;margin:0 0 10px;color:#fff">配送エリア / Delivery Area</h3>' +
      '<p style="font-size:14px;line-height:1.7;margin:0">クアラルンプール市内限定・Grab配送<br/><span style="color:#ddceBD">Kuala Lumpur city only, delivered via Grab</span><br/><br/>ご注文期限：前週の日曜日まで／お届け日：水曜日<br/><span style="color:#ddceBD">Order by Sunday the week before · Delivered on Wednesday</span><br/><br/>商品代金はQRコードでの先払い、配送費(Grab実費)は確定後に改めて別途ご請求します。お手数をお掛けして申し訳ございませんが、ご了承ください。<br/><span style="color:#ddceBD">Item total is paid upfront via QR code; delivery fee (actual Grab cost) is billed separately afterward. We apologize for the inconvenience and thank you for your understanding.</span></p></div></section>' +

      '<section style="padding:30px 20px 50px;text-align:center"><p style="font-size:14px;color:' + C.brown + ';margin:0 0 12px">ご不明な点はお気軽にWhatsAppで / Questions? Message us anytime</p>' +
      '<a href="#" onclick="APP.askGeneral();return false;" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;border:1.5px solid ' + C.red + ';color:' + C.red + ';font-weight:700;font-size:13px;padding:12px 20px;border-radius:999px">' + WA_ICON + ' WhatsApp: ' + esc(CFG.whatsappDisplay) + '</a></section>' +
      '</div>';
  }

  // ---------- STORY ----------
  function storyPage() {
    return '<div>' +
      '<section style="padding:40px 20px 10px;text-align:center;background:radial-gradient(circle at 50% 0%, rgba(198,54,43,0.08), transparent 60%)">' +
      '<h1 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:24px;margin:0 0 6px;color:' + C.dark + '">ブランドストーリー</h1><p style="font-size:14px;color:' + C.brown + ';margin:0">Our Story</p></section>' +
      '<section style="padding:20px 20px 10px"><div style="max-width:480px;margin:0 auto">' + imageSlot("azuki.jpg", "和菓子づくりの様子 / Making wagashi", "width:100%;height:240px;") + '</div></section>' +
      '<section style="padding:20px 20px 30px"><div style="max-width:480px;margin:0 auto;text-align:center">' +
      '<h2 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:19px;line-height:1.7;margin:0 0 14px;color:' + C.dark + '">日本の手作りの和菓子を、<br/>クアラルンプールで楽しめます。</h2>' +
      '<p style="font-size:13px;color:' + C.brown + ';margin:0 0 18px">Handmade Japanese wagashi, made to enjoy right here in Kuala Lumpur.</p>' +
      '<p style="font-size:13px;line-height:1.9;color:' + C.ink + ';margin:0 0 14px;text-align:left">ひとつひとつ手作りで、丁寧に。季節を感じられる和菓子を、週末は対面で、平日はWhatsAppからオンラインでお届けしています。<br/><span style="color:' + C.brown + ';font-size:13px">Every piece is made by hand, with care — bringing a sense of the season to your table. Sold in person on weekends, and by online order via WhatsApp during the week.</span></p>' +
      '<p style="font-size:13px;line-height:1.9;color:' + C.ink + ';margin:0;text-align:left">異国の地クアラルンプールで、日本の和菓子の温かさをそのままに。これからも変わらぬ味を、丁寧にお届けします。<br/><span style="color:' + C.brown + ';font-size:13px">Even far from home, we keep the warmth of Japanese wagashi just as it is — and will keep delivering that same care, one sweet at a time.</span></p>' +
      '</div></section>' +
      '<section style="padding:10px 20px 40px;background:#fff"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:480px;margin:24px auto 0">' +
      storyStat("手作り", "Handmade") + storyStat("丁寧", "With care") + storyStat("季節感", "Seasonal") +
      '</div></section>' +
      '<section style="padding:40px 20px 10px"><div style="max-width:480px;margin:0 auto;border:1.5px dashed rgba(198,54,43,0.4);border-radius:20px;padding:22px">' +
      '<h3 style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:16px;margin:0 0 10px;color:' + C.red + '">週末キオスク販売 / Weekend Kiosk</h3>' +
      '<p style="font-size:14px;line-height:1.7;color:' + C.ink + ';margin:0">KL日本人会内、ロビーキオスクにて対面販売しております。<br/><span style="color:' + C.brown + '">Sold in person at the lobby kiosk, Japan Club of Kuala Lumpur.</span><br/><br/>販売日：毎週土・日曜日（開催していない場合もございます。スケジュールをご確認ください）<br/><span style="color:' + C.brown + '">Days: Saturdays &amp; Sundays (not every week — please check the schedule)</span><br/><br/>販売時間：10:00〜18:00<br/><span style="color:' + C.brown + '">Hours: 10am–6pm</span></p></div></section>' +
      '<section style="padding:30px 20px 50px;text-align:center"><button onclick="APP.go(\'order\')" style="border:none;background:' + C.red + ';color:#fff;font-family:\'Noto Serif JP\',serif;font-weight:700;font-size:14px;padding:15px 24px;border-radius:999px;cursor:pointer">今週の限定を注文する / Order This Week\'s Special</button></section>' +
      '</div>';
  }
  function storyStat(jp, en) {
    return '<div style="text-align:center"><div style="font-family:\'Noto Serif JP\',serif;font-weight:900;font-size:22px;color:' + C.red + '">' + jp + '</div><div style="font-size:13px;color:' + C.dark + ';margin-top:6px">' + en + '</div></div>';
  }

  // =====================================================================
  //  描画
  // =====================================================================
  function render() {
    var body = state.page === "order" ? orderPage() : state.page === "story" ? storyPage() : homePage();
    document.getElementById("app").innerHTML =
      '<div style="font-family:\'Noto Sans JP\',sans-serif;color:' + C.dark + ';background:' + C.cream + ';min-height:100vh;width:100%;overflow-x:hidden">' +
      header() + body + footer() + '</div>';
  }

  // カウントダウンを毎秒更新（画面全体は作り直さず、数字だけ差し替え）
  function tickCountdown() {
    state.now = Date.now();
    var els = document.querySelectorAll("[data-countdown]");
    for (var i = 0; i < els.length; i++) els[i].textContent = formatCountdown(state.now);
  }

  document.addEventListener("DOMContentLoaded", function () {
    render();
    setInterval(tickCountdown, 1000);
  });
})();

