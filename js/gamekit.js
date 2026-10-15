/* ============================================================
   GameKit ── 三個遊戲共用的玩家資料、IP 取得與成績上傳
   需先載入 js/config.js
   ============================================================ */
(function(){
"use strict";
var C = window.GAME_CONFIG || {};
var DEF_SCHOOL = C.DEFAULT_SCHOOL || "布理斯本亞洲語文學校";
var DEF_CLASS  = C.DEFAULT_CLASS  || "11B";
var KEY = { name:"blsa.name", school:"blsa.school", cls:"blsa.class", queue:"blsa.queue", ip:"blsa.ip" };
var GAMES = { "air":"故宮詞語空戰", "pacman":"網路購物吃豆人", "frog":"跳跳蛙過河" };

function lsGet(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function ssSet(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function endpoint(){ return String(C.ENDPOINT || "").trim(); }
function token(){ return String(C.TOKEN || "").trim(); }
function hasEndpoint(){ return !!endpoint(); }
function withQuery(extra){
  var q = [], url = endpoint();
  if(extra) q.push(extra);
  if(token()) q.push("token=" + encodeURIComponent(token()));
  return q.length ? url + (url.indexOf("?") < 0 ? "?" : "&") + q.join("&") : url;
}

/* ---------- 狀態訊息 ---------- */
var statusFns = [];
function onStatus(fn){ statusFns.push(fn); }
function status(msg, cls){ statusFns.forEach(function(f){ try{ f(msg || "", cls || ""); }catch(e){} }); }

/* ---------- 玩家資料（三個遊戲與首頁共用同一份） ---------- */
function player(){
  return {
    name  : (lsGet(KEY.name,"")   || "").trim(),
    school: (lsGet(KEY.school,"") || "").trim() || DEF_SCHOOL,
    cls   : (lsGet(KEY.cls,"")    || "").trim() || DEF_CLASS
  };
}
function bindPlayer(nameEl, schoolEl, clsEl){
  if(nameEl){
    nameEl.value = player().name;
    nameEl.addEventListener("input", function(){ lsSet(KEY.name, this.value.trim()); });
  }
  [[schoolEl, KEY.school, DEF_SCHOOL], [clsEl, KEY.cls, DEF_CLASS]].forEach(function(a){
    var el = a[0]; if(!el) return;
    el.value = (lsGet(a[1],"") || "").trim() || a[2];
    el.placeholder = a[2];
    el.addEventListener("input", function(){ lsSet(a[1], this.value.trim()); });
    el.addEventListener("blur", function(){
      if(!this.value.trim()){ this.value = a[2]; lsSet(a[1], a[2]); }
    });
  });
}

/* ---------- IP 位址（由瀏覽器向公開服務查詢；Apps Script 本身拿不到來源 IP） ---------- */
function fetchTimeout(url, ms){
  var ctl = ("AbortController" in window) ? new AbortController() : null;
  var t = setTimeout(function(){ if(ctl) ctl.abort(); }, ms);
  return fetch(url, { cache:"no-store", signal: ctl ? ctl.signal : undefined })
    .then(function(r){ clearTimeout(t); if(!r.ok) throw new Error("http"); return r; },
          function(e){ clearTimeout(t); throw e; });
}
var ipPromise = null;
function getIP(){
  if(C.COLLECT_IP === false) return Promise.resolve("未收集");
  if(ipPromise) return ipPromise;
  var cached = ssGet(KEY.ip);
  if(cached) return (ipPromise = Promise.resolve(cached));
  var valid = function(ip){
    ip = String(ip || "").trim();
    if(!/^[0-9a-f.:]{3,45}$/i.test(ip)) throw new Error("bad ip");
    return ip;
  };
  ipPromise = fetchTimeout("https://api.ipify.org?format=json", 4000)
    .then(function(r){ return r.json(); }).then(function(o){ return valid(o.ip); })
    .catch(function(){
      return fetchTimeout("https://api64.ipify.org?format=json", 4000)
        .then(function(r){ return r.json(); }).then(function(o){ return valid(o.ip); });
    })
    .then(function(ip){ ssSet(KEY.ip, ip); return ip; })
    .catch(function(){ ipPromise = null; return "未取得"; });
  return ipPromise;
}

/* ---------- 上傳 ---------- */
function queueGet(){ try{ return JSON.parse(lsGet(KEY.queue,"[]")) || []; }catch(e){ return []; } }
function queueSet(a){ lsSet(KEY.queue, JSON.stringify(a.slice(-100))); }

function send(payload){
  var url = endpoint();
  if(!url) return Promise.reject(new Error("no-endpoint"));
  var p = {};
  for(var k in payload) if(Object.prototype.hasOwnProperty.call(payload,k)) p[k] = payload[k];
  p.token = token();
  var body = JSON.stringify(p);
  return fetch(url, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:body })
    .then(function(r){ return r.json(); })
    .then(function(o){
      if(o && o.ok) return o;
      var m = (o && o.error) ? o.error : "server";
      var err = new Error(m); err.fatal = /token|game/.test(m); throw err;
    })
    .catch(function(err){
      if(err && err.fatal) throw err;
      /* 有些網路環境讀不到 Apps Script 的回應，改用 no-cors 盲送一次 */
      return fetch(url, { method:"POST", mode:"no-cors",
        headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:body })
        .then(function(){ return { ok:true, blind:true }; });
    });
}

/**
 * 送出一局成績。
 * game: "air" | "pacman" | "frog"
 * rec : { result, score, seconds, ...各遊戲自己的欄位 }
 */
function submit(game, rec){
  var pl = player();
  var payload = {
    game  : game,
    id    : game.charAt(0) + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    name  : pl.name || "（未填姓名）",
    school: pl.school,
    cls   : pl.cls,
    ua    : (navigator.userAgent || "").slice(0,120)
  };
  for(var k in rec) if(Object.prototype.hasOwnProperty.call(rec,k)) payload[k] = rec[k];

  if(!hasEndpoint()){
    status("尚未設定試算表網址，本局成績只顯示在畫面上。");
    return Promise.resolve({ ok:false });
  }
  status("成績上傳中…", "busy");
  return getIP().then(function(ip){
    payload.ip = ip;
    return send(payload);
  }).then(function(o){
    status(o.blind ? "成績已送出（無法確認結果，請開試算表查看）。" : "成績已寫入 Google 試算表。", "ok");
    return o;
  }, function(err){
    if(err && err.fatal){
      status("成績沒有寫入（" + (/token/.test(err.message) ? "通行碼不符" : "試算表不認得這個遊戲") + "），請通知老師。", "bad");
      return { ok:false };
    }
    var q = queueGet(); q.push(payload); queueSet(q);
    status("上傳失敗，已暫存在本機（共 " + q.length + " 筆），連上網後會自動補傳。", "bad");
    return { ok:false, queued:true };
  });
}

function flush(silent){
  var q = queueGet();
  if(!q.length){ if(!silent) status("目前沒有待上傳的成績。"); return Promise.resolve(); }
  if(!hasEndpoint()){ if(!silent) status("尚未設定試算表網址，無法補傳。", "bad"); return Promise.resolve(); }
  status("補傳 " + q.length + " 筆成績…", "busy");
  var left = [], i = 0;
  return new Promise(function(done){
    (function next(){
      if(i >= q.length){
        queueSet(left);
        status(left.length ? "仍有 " + left.length + " 筆補傳失敗。" : "待上傳成績已全部補傳完成。", left.length ? "bad" : "ok");
        done(); return;
      }
      var rec = q[i++];
      send(rec).then(next, function(){ left.push(rec); next(); });
    })();
  });
}

/* ---------- 讀取 ---------- */
function test(){
  if(!hasEndpoint()) return Promise.reject(new Error("no-endpoint"));
  return fetch(withQuery("")).then(function(r){ return r.json(); });
}
function leaderboard(game, top){
  return fetch(withQuery("game=" + encodeURIComponent(game) + "&top=" + (top || 15)))
    .then(function(r){ return r.json(); });
}
function renderLeaderboard(game, msgEl, tableEl, extraLabel){
  tableEl.innerHTML = "";
  if(!hasEndpoint()){ msgEl.textContent = "尚未設定試算表網址，無法讀取排行榜。"; return; }
  msgEl.textContent = "讀取中…";
  leaderboard(game, 15).then(function(o){
    if(o && o.ok === false && /token/.test(o.error || "")){ msgEl.textContent = "通行碼不符，無法讀取排行榜。"; return; }
    if(!o || !o.ok || !o.list) throw new Error("bad");
    if(!o.list.length){ msgEl.textContent = "試算表裡還沒有這個遊戲的成績。"; return; }
    msgEl.textContent = "共 " + o.count + " 筆紀錄，以下為每個人的最高分。";
    tableEl.innerHTML = "<tr><th></th><th>姓名</th><th>班級</th><th class='sc'>最高分</th><th class='sc'>" +
      esc(extraLabel || "") + "</th></tr>" +
      o.list.map(function(x, i){
        return "<tr><td class='r'>" + (i+1) + "</td><td>" + esc(x.name || "") + "</td><td>" + esc(x.cls || "") +
               "</td><td class='sc'>" + esc(x.score) + "</td><td class='sc'>" + esc(x.extra == null ? "" : x.extra) + "</td></tr>";
      }).join("");
  }).catch(function(){
    msgEl.textContent = "讀不到排行榜。請確認網址正確，且部署時「誰可以存取」設為「任何人」。";
  });
}

/* 開頁時若有暫存成績且已設定網址，就默默補傳 */
setTimeout(function(){ if(queueGet().length && hasEndpoint()) flush(true); }, 1500);
/* 先在背景查好 IP，結束時就不必等 */
setTimeout(function(){ if(hasEndpoint()) getIP(); }, 800);

window.GameKit = {
  GAMES: GAMES, DEF_SCHOOL: DEF_SCHOOL, DEF_CLASS: DEF_CLASS,
  player: player, bindPlayer: bindPlayer, ip: getIP,
  submit: submit, flush: flush, pending: function(){ return queueGet().length; },
  test: test, leaderboard: leaderboard, renderLeaderboard: renderLeaderboard,
  hasEndpoint: hasEndpoint, onStatus: onStatus, esc: esc
};
})();
