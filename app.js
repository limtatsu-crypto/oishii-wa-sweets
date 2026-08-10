/* =====================================================================
   サイトの動きを担当するファイル / SITE LOGIC
   ---------------------------------------------------------------------
   ★ このファイルは基本さわりません。
   ★ 毎週の変更は week.js だけでOKです。
   ===================================================================== */

(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var WEEK = window.WEEKLY_SPECIAL || {};
  var ITEMS = window.STANDARD_ITEMS || [];

  var WA_BASE = "https://wa.me/" + (CFG.whatsappNumber || "");
  var ORDER_MSG = CFG.orderMessage || "ご注文をお願いします";

  function waLink(extra) {
    var text = ORDER_MSG + (extra ? " — " + extra : "");
    return WA_BASE + "?text=" + encodeURIComponent(text);
  }

  // ---- ページ切り替え ----
  window.showPage = function (name) {
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove("active");
    var el = document.getElementById("page-" + name);
    if (el) el.classList.add("active");

    var navs = ["home", "order", "story"];
    navs.forEach(function (n) {
      var b = document.getElementById("nav-" + n);
      if (b) b.classList.toggle("active", n === name);
    });
    window.scrollTo(0, 0);
  };

  // ---- 写真スロットに画像を入れる（無ければプレースホルダーのまま）----
  function fillPhoto(el, src, placeholder) {
    if (!el) return;
    if (src) {
      el.innerHTML = "";
      var img = document.createElement("img");
      img.src = src;
      img.alt = placeholder || "";
      el.appendChild(img);
      el.style.background = "none";
    } else if (placeholder && !el.textContent.trim()) {
      el.textContent = placeholder;
    }
  }

  // ---- 今週の限定を反映 ----
  function applyWeekly() {
    document.querySelectorAll("[data-weekly-title-jp]").forEach(function (e) {
      e.textContent = WEEK.titleJP || "";
    });
    document.querySelectorAll("[data-weekly-title-en]").forEach(function (e) {
      e.textContent = WEEK.titleEN || "";
    });
    document.querySelectorAll("[data-weekly-desc]").forEach(function (e) {
      e.textContent = WEEK.descJP || "";
      if (WEEK.descEN) {
        e.innerHTML = escapeHtml(WEEK.descJP || "") + "<br/>" +
          '<span style="color:var(--brown)">' + escapeHtml(WEEK.descEN) + "</span>";
      }
    });
    document.querySelectorAll("[data-weekly-photo]").forEach(function (e) {
      fillPhoto(e, WEEK.photo, "今週の限定商品の写真 / Weekly special photo");
    });
    // 残りわずかバッジの表示/非表示
    document.querySelectorAll("[data-limited-badge]").forEach(function (e) {
      e.style.display = (WEEK.showLimitedBadge === false) ? "none" : "";
    });
  }

  // ---- 定番商品リストを描画 ----
  function renderMenu() {
    // HOME側（カード2列）
    var home = document.getElementById("home-menu");
    if (home) {
      home.innerHTML = "";
      ITEMS.forEach(function (it) {
        var card = document.createElement("div");
        card.style.cssText = "background:var(--cream);border-radius:16px;overflow:hidden;border:1px solid rgba(198,54,43,0.10)";
        var slot = '<div class="imgslot" style="width:100%;height:110px">' +
          (it.photo ? '<img src="' + it.photo + '" alt="' + escapeAttr(it.jp) + '"/>' : escapeHtml(it.jp) + "の写真") + "</div>";
        card.innerHTML = slot +
          '<div style="padding:10px 12px">' +
          '<div style="font-family:var(--serif);font-weight:700;font-size:13px;color:var(--ink)">' + escapeHtml(it.jp) + "</div>" +
          '<div style="font-size:10px;color:var(--brown)">' + escapeHtml(it.en) + "</div>" +
          "</div>";
        home.appendChild(card);
      });
    }

    // ORDER側（横並び＋注文ボタン）
    var order = document.getElementById("order-menu");
    if (order) {
      order.innerHTML = "";
      ITEMS.forEach(function (it) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;gap:12px;align-items:center;background:#fff;border:1px solid rgba(198,54,43,0.12);border-radius:16px;padding:10px";
        var slot = '<div class="imgslot" style="width:72px;height:72px;flex:none;border-radius:12px;overflow:hidden">' +
          (it.photo ? '<img src="' + it.photo + '" alt="' + escapeAttr(it.jp) + '"/>' : escapeHtml(it.jp)) + "</div>";
        row.innerHTML = slot +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-family:var(--serif);font-weight:700;font-size:14px;color:var(--ink)">' + escapeHtml(it.jp) + "</div>" +
          '<div style="font-size:10px;color:var(--brown)">' + escapeHtml(it.en) + "</div>" +
          "</div>" +
          '<a href="' + waLink(it.jp) + '" target="_blank" rel="noopener" style="flex:none;text-decoration:none;border:1.5px solid var(--red);color:var(--red);font-weight:700;font-size:11px;padding:9px 12px;border-radius:999px">注文 / Order</a>';
        order.appendChild(row);
      });
    }
  }

  // ---- WhatsAppリンク（汎用・今週用）と表示番号 ----
  function applyWhatsApp() {
    document.querySelectorAll('[data-wa="general"]').forEach(function (a) {
      a.href = waLink("");
    });
    document.querySelectorAll('[data-wa="weekly"]').forEach(function (a) {
      a.href = waLink(WEEK.titleJP || "今週の限定");
    });
    document.querySelectorAll("[data-wa-display]").forEach(function (e) {
      e.textContent = "WhatsApp: " + (CFG.whatsappDisplay || "");
    });
  }

  // ---- 締切カウントダウン ----
  function pad(n) { return String(n).padStart(2, "0"); }

  function nextDeadline(now) {
    var targetDay = (typeof WEEK.deadlineDay === "number") ? WEEK.deadlineDay : 4;
    var targetHour = (typeof WEEK.deadlineHour === "number") ? WEEK.deadlineHour : 18;
    var d = new Date(now);
    var daysUntil = (targetDay - d.getDay() + 7) % 7;
    var deadline = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntil, targetHour, 0, 0);
    if (deadline.getTime() <= now) deadline = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
    return deadline;
  }

  function formatCountdown(now) {
    var deadline = nextDeadline(now);
    var diff = Math.max(0, deadline.getTime() - now);
    var days = Math.floor(diff / (24 * 3600 * 1000));
    var hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    var mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    var secs = Math.floor((diff % 60000) / 1000);
    if (days > 0) return "あと" + days + "日" + pad(hours) + "時間 / " + days + "d " + hours + "h left";
    return "あと" + pad(hours) + ":" + pad(mins) + ":" + pad(secs) + " / " + hours + "h " + mins + "m left";
  }

  function tickCountdown() {
    var now = Date.now();
    var txt = formatCountdown(now);
    document.querySelectorAll("[data-countdown]").forEach(function (e) {
      e.textContent = txt;
    });
  }

  // ---- 小さなユーティリティ（安全のため）----
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---- 起動 ----
  document.addEventListener("DOMContentLoaded", function () {
    applyWeekly();
    renderMenu();
    applyWhatsApp();
    tickCountdown();
    setInterval(tickCountdown, 1000);
    showPage("home");
  });
})();
