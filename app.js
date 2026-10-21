/* vplay Games v4 for Opera Mini on keypad phones.
   ES5 only. Opera Mini runs this on Opera's servers on every page load and
   sends the phone a snapshot, so: no timers, no key events, no animation.
   Every move is a link; the game position travels in the link (?s=...).
   Controls are one vertical list of at most 4 choices, usual move first,
   because only Up/Down move the highlight and the first link is highlighted
   after each load (tested on an HMD phone, 21 Oct 2026). */
var V = (function () {
  var G = {}, Q = {}, PW = 226, MAXH = 120, SMALL = false, BOOT = { w: 0 };
  var ORDER = ['whot', 'danfo', 'dambe', 'pen', 'ayo', 'mango', 'cowrie', 'story'];
  var CATS = {
    cards: ['Cards', '#8a1c1c'], racing: ['Racing', '#e03c32'], action: ['Action', '#f28c1e'], sports: ['Sports', '#1e8a3c'],
    board: ['Board', '#8a5a2e'], shooting: ['Shooting', '#1c3e9c'], puzzle: ['Puzzle', '#9a4fd0'], story: ['Story', '#22a6a0']
  };

  /* ---------- helpers ---------- */
  function each(a, f) { for (var i = 0; i < a.length; i++) { f(a[i], i); } }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function b36(n) { return n.toString(36); }
  function p36(s) { var n = parseInt(s, 36); return isNaN(n) ? 0 : n; }
  function rnd(st) { st.r = (st.r * 16807) % 2147483647; return st.r; }
  function ri(st, n) { return Math.floor(rnd(st) / 65536) % n; }
  function newSeed() { return (new Date().getTime() % 2147483646) + 1; }
  function shuffle(st, a) { var i, j, t; for (i = a.length - 1; i > 0; i--) { j = ri(st, i + 1); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* State packing: spec = [[name, 'i'|'a'], ...]; ints >= 0 only. */
  function pack(spec, st) {
    var out = [];
    each(spec, function (f) {
      var v = st[f[0]], p = [];
      if (f[1] === 'a') { each(v, function (x) { p.push(b36(x)); }); out.push(p.length ? p.join('_') : 'n'); }
      else { out.push(b36(v)); }
    });
    return out.join('.');
  }
  function unpack(spec, s) {
    var a = String(s || '').split('.'), st = {};
    if (a.length !== spec.length) { throw new Error('bad state'); }
    each(spec, function (f, i) {
      if (f[1] === 'a') { st[f[0]] = []; if (a[i] !== 'n') { each(a[i].split('_'), function (x) { st[f[0]].push(p36(x)); }); } }
      else { st[f[0]] = p36(a[i]); }
    });
    return st;
  }

  /* ---------- SVG pictures ---------- */
  function svg(vw, vh, body, pw, bg) {
    var ph = Math.round(pw * vh / vw);
    if (ph > MAXH) { ph = MAXH; pw = Math.round(MAXH * vw / vh); }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + pw + '" height="' + ph + '" viewBox="0 0 ' + vw + ' ' + vh + '">' +
      (bg ? '<rect width="' + vw + '" height="' + vh + '" fill="' + bg + '"/>' : '') + body + '</svg>';
  }
  function n1(v) { return Math.round(v * 10) / 10; }
  function R(x, y, w, h, f, extra) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function C(x, y, r, f, extra) { return '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(r) + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function P(d, f, extra) { return '<path d="' + d + '" fill="' + f + '"' + (extra || '') + '/>'; }
  function T(x, y, s, size, f, anchor) {
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-size="' + size + '" font-family="sans-serif" font-weight="bold" text-anchor="' + (anchor || 'middle') + '" fill="' + f + '">' + esc(s) + '</text>';
  }
  function GH(x, y, w, h, c) { return R(x, y, w, h, 'none', ' stroke="' + c + '" stroke-width="0.6" stroke-dasharray="1.2 0.8"'); }

  /* ---------- links and cookies ---------- */
  function parseQ(search) {
    var q = {}, s = (search || '').replace(/^\?/, '');
    if (!s) { return q; }
    each(s.split('&'), function (part) {
      var i = part.indexOf('='), k = i < 0 ? part : part.substr(0, i), v = i < 0 ? '' : part.substr(i + 1);
      try { q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { }
    });
    return q;
  }
  function url(o) {
    var parts = [], k;
    if (o.z === undefined && Q.z) { o.z = Q.z; }
    for (k in o) { if (o.hasOwnProperty(k) && o[k] !== undefined && o[k] !== null && o[k] !== '') { parts.push(k + '=' + encodeURIComponent(o[k])); } }
    return parts.length ? '?' + parts.join('&') : './';
  }
  function lnk(href, label, cls) { return '<a href="' + esc(href) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</a>'; }
  function getC(k) { try { var m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }
  function setC(k, v) { try { document.cookie = k + '=' + encodeURIComponent(v) + '; max-age=31536000; path=/'; } catch (e) { } }

  /* ---------- page parts ---------- */
  var KENTE = ['#ffd23c', '#1e8a3c', '#e03c32', '#101a3a'];
  function kente() { var b = '', i; for (i = 0; i < 24; i++) { b += R(i * 10, 0, 10, 4, KENTE[i % 4]); } var mh = MAXH; MAXH = 999; b = '<div class="kt">' + svg(240, 4, b, PW) + '</div>'; MAXH = mh; return b; }
  function header(left, right) { return '<div class="hd"><span class="r">' + (right || '') + '</span>' + left + '</div>' + kente(); }
  function logo() { return '<span class="lg">v</span>play' + (SMALL ? '' : ' Games'); }
  function icon(id, px) { return svg(24, 24, ICONS[id] || '', px); }
  function tag(cat) { var c = CATS[cat]; return '<span class="tag" style="background:' + c[1] + '">' + c[0] + '</span>'; }
  function adSlot() {
    /* Google AdSense: paste the ad unit here once the domain is approved in
       AdSense. Keep it below the game controls (Opera Mini highlights the first
       link on the page, which must be the game, not the ad). */
    return '<div class="ad">Advertisement</div>';
  }
  function gameRow(id) {
    var g = G[id], c = CATS[g.cat];
    return '<a class="row" style="border-left-color:' + c[1] + '" href="' + esc(url({ p: 'i', g: id })) + '">' +
      '<span class="ic">' + icon(id, SMALL ? 20 : 32) + '</span><span class="tx"><b>' + g.name + '</b>' +
      (SMALL ? '' : '<br>' + tag(g.cat) + ' <span class="d">' + g.short + '</span>') + '</span></a>';
  }
  function startUrl(id) { return url({ p: 'p', g: id, s: G[id].enc(G[id].init(newSeed())) }); }

  /* ---------- pages ---------- */
  function pageHome() {
    var h = header(logo(), SMALL ? '8 free' : '8 free games'), cont = getC('vc'), parts, pick, g;
    if (cont) {
      parts = cont.split('|');
      if (G[parts[0]] && parts[1]) { h += lnk(url({ p: 'p', g: parts[0], s: parts[1] }), 'Continue ' + G[parts[0]].name + ' &raquo;', 'cont'); }
    }
    pick = ORDER[Math.floor(new Date().getTime() / 86400000) % ORDER.length]; g = G[pick];
    h += '<div class="pick"><span class="pi">' + icon(pick, SMALL ? 28 : 48) + '</span><span class="pt"><span class="lab">' + (SMALL ? 'PICK' : 'TODAY\'S PICK') +
      '</span><br><b>' + g.name + '</b>' + (SMALL ? '' : '<br><span class="d">' + g.short + '</span>') + '</span>' + lnk(startUrl(pick), 'PLAY NOW', 'play') + '</div>';
    h += '<div class="sec"><span class="r">8</span>ALL GAMES</div>';
    each(ORDER, function (id) { h += gameRow(id); });
    h += adSlot() + '<div class="tip">Tip: press 1, then Fullscreen mode, for a bigger game.</div>';
    h += '<div class="ft">Size: ' + (SMALL ? '<b>Small</b> ' + lnk(url({ z: 'l' }), 'Large') : lnk(url({ z: 's' }), 'Small') + ' <b>Large</b>') +
      '<br>Free games, no sign-up. ' + lnk('test.html', 'Phone test') + '</div>';
    return h;
  }
  function pageIntro(id) {
    var g = G[id], best = getC('b' + id), h;
    h = header(g.name, CATS[g.cat][0]);
    h += '<div class="fr">' + g.draw(g.init(4242), PW) + '</div>';
    h += lnk(startUrl(id), 'PLAY', 'play big');
    h += '<div class="tags">' + tag(g.cat) + ' <span class="tag" style="background:#4a4f58">vs computer</span> <span class="tag" style="background:#22a6a0">2G ok</span>' +
      (best ? ' <span class="d">Best ' + esc(best) + '</span>' : '') + '</div>';
    h += '<div class="p">' + g.blurb + '</div><div class="sec">HOW TO PLAY</div>';
    h += '<div class="hl"><b>Up/Down</b> picks a choice. <b>Centre key</b> plays it.</div>';
    each(g.lines, function (l) { h += '<div class="hl">' + l + '</div>'; });
    h += '<div class="tip">Tip: press 1, then Fullscreen mode, for a bigger game.</div>';
    return h + '<div class="ft">' + lnk(url({}), '&laquo; All games') + '</div>';
  }
  function pagePlay(id) {
    var g = G[id], st, cur, h, ch, ev;
    try { st = g.dec(Q.s); cur = g.enc(st); } catch (e) { st = g.init(newSeed()); cur = g.enc(st); }
    if (g.over(st)) { return pageOver(id, st); }
    setC('vc', id + '|' + cur);
    ev = g.ev(st);
    if (SMALL && ev) { var sn = ev.match(/[^.!?]+[.!?]*/g); if (sn && sn.length > 1) { ev = sn[sn.length - 1].replace(/^ +/, ''); } }
    h = '<div class="ev' + (ev ? '' : ' ev0') + '">' + (SMALL ? '' : '<span class="r">' + g.status(st) + '</span>') + (ev || g.name) + '</div>';
    h += '<div class="fr">' + g.draw(st, PW) + '</div>';
    if (g.prompt) { h += '<div class="q">' + g.prompt(st) + '</div>'; }
    ch = g.choices(st);
    each(ch, function (c) {
      var nx = g.dec(cur);
      g.step(nx, c[0]);
      h += lnk(url({ p: 'p', g: id, s: g.enc(nx) }), c[1], 'ans');
    });
    h += '<div class="inf">' + (SMALL ? g.status(st) + ' &middot; ' : '') + g.info(st) + '</div>' + adSlot();
    return h + '<div class="ft">' + lnk(url({ p: 'i', g: id }), 'Help') + ' &middot; ' + lnk(url({}), 'All games') + '</div>';
  }
  function pageOver(id, st) {
    var g = G[id], res = g.result(st), best = parseInt(getC('b' + id), 10) || 0, nb = res.score > best, h, i, k = 0;
    if (nb) { setC('b' + id, res.score); best = res.score; }
    setC('vc', '');
    h = '<div class="ev' + (res.win ? '' : ' evl') + '">' + res.text + '</div>';
    h += lnk(startUrl(id), 'PLAY AGAIN', 'play big');
    h += '<div class="sb"><span class="d">' + g.name + ' score</span><br><span class="bg">' + res.score + '</span><br>' +
      (nb && res.score > 0 ? '<span class="nb">New best!</span>' : '<span class="d">Best ' + best + '</span>') + '</div>';
    h += '<div class="fr">' + g.draw(st, PW) + '</div>';
    h += '<div class="sec">TRY NEXT</div>';
    for (i = 0; i < ORDER.length && k < 2; i++) { if (ORDER[(ORDER.indexOf(id) + 1 + i) % ORDER.length] !== id) { h += gameRow(ORDER[(ORDER.indexOf(id) + 1 + i) % ORDER.length]); k++; } }
    return h + lnk(url({}), 'All games &raquo;', 'row') + adSlot();
  }

  function measure() {
    var w = 0;
    try { w = (document.body && document.body.clientWidth) || window.innerWidth || screen.width || 0; } catch (e) { w = 0; }
    BOOT.w = w;
    return w;
  }
  function setSize(w) {
    if (Q.z === 's') { SMALL = true; } else if (Q.z === 'l') { SMALL = false; } else { SMALL = !(w >= 180); }
    PW = SMALL ? 116 : Math.min(226, Math.max(120, (w || 230) - 4));
    MAXH = SMALL ? 64 : 124;
  }
  function render(search, w) {
    Q = parseQ(search);
    setSize(w === undefined ? BOOT.w : w);
    if (Q.g && !G[Q.g]) { Q.g = ''; }
    if (Q.p === 'p' && Q.g) { return pagePlay(Q.g); }
    if (Q.p === 'i' && Q.g) { return pageIntro(Q.g); }
    return pageHome();
  }
  function main() {
    var html, w = measure();
    try { html = render(location.search, w); } catch (e) {
      html = header(logo()) + '<div class="p">Something went wrong. ' + lnk('./', 'Start again') + '<br><span class="d">Error: ' + esc((e && (e.message || e.name)) || e) + '</span></div>';
    }
    try { if (window.operamini && window.operamini.page) { window.operamini.page.maxAge = Q.p ? 60 : 0; } } catch (e2) { }
    try { document.body.className = SMALL ? 'sm' : 'lg'; } catch (e3) { }
    document.write(html);
  }
  var ICONS = {
    whot: '<rect width="24" height="24" fill="#8a1c1c"/><rect x="3" y="2" width="12" height="17" fill="#fff" stroke="#141414" stroke-width=".8" transform="rotate(-12 9 10)"/><rect x="9" y="5" width="12" height="17" fill="#fff" stroke="#141414" stroke-width=".8"/><circle cx="15" cy="11" r="3" fill="#8a1c1c"/><path d="M12 19l3-4 3 4z" fill="#8a1c1c"/>',
    danfo: '<rect width="24" height="24" fill="#4a4f58"/><rect x="7.6" y="0" width=".8" height="4" fill="#fff"/><rect x="15.6" y="0" width=".8" height="4" fill="#fff"/><rect x="7.6" y="20" width=".8" height="4" fill="#fff"/><rect x="15.6" y="20" width=".8" height="4" fill="#fff"/><rect x="2" y="6" width="20" height="11" fill="#ffd23c"/><rect x="2" y="9" width="20" height="1.5" fill="#141414"/><rect x="4" y="7" width="3" height="2" fill="#8fd8ff"/><rect x="8.5" y="7" width="3" height="2" fill="#8fd8ff"/><rect x="13" y="7" width="3" height="2" fill="#8fd8ff"/><rect x="17.5" y="7" width="3" height="2" fill="#8fd8ff"/><circle cx="6" cy="17.5" r="2" fill="#141414"/><circle cx="18" cy="17.5" r="2" fill="#141414"/><rect x="20" y="12" width="2" height="2" fill="#e03c32"/>',
    dambe: '<rect width="24" height="24" fill="#e03c32"/><rect x="0" y="18" width="24" height="6" fill="#c8a06a"/><circle cx="7" cy="6" r="3" fill="#5a3a1c"/><rect x="5" y="9" width="4" height="9" fill="#5a3a1c"/><rect x="9" y="10" width="7" height="2.6" fill="#5a3a1c"/><rect x="15" y="9" width="4.5" height="4.5" fill="#fff"/><rect x="15" y="10.4" width="4.5" height=".8" fill="#c8a06a"/><rect x="15" y="12" width="4.5" height=".8" fill="#c8a06a"/><circle cx="20" cy="4" r="1.6" fill="#ffd23c"/><path d="M20 1v1.2M20 5.8V7M17 4h1.2M21.8 4H23" stroke="#ffd23c" stroke-width=".8"/>',
    pen: '<rect width="24" height="24" fill="#2e9e4a"/><rect x="2" y="3" width="20" height="11" fill="#fff"/><rect x="3" y="4" width="18" height="10" fill="#cfe9d6"/><path d="M3 6h18M3 8h18M3 10h18M3 12h18M6 4v10M9 4v10M12 4v10M15 4v10M18 4v10" stroke="#9cc8a8" stroke-width=".6"/><circle cx="12" cy="19" r="3.4" fill="#fff"/><path d="M11 17h2l1 1.5-1 1.5h-2l-1-1.5z" fill="#141414"/>',
    ayo: '<rect width="24" height="24" fill="#f4dca6"/><rect x="1" y="6" width="22" height="12" fill="#8a5a2e"/><g fill="#5a3a1c"><circle cx="4.5" cy="9.5" r="2"/><circle cx="9.5" cy="9.5" r="2"/><circle cx="14.5" cy="9.5" r="2"/><circle cx="19.5" cy="9.5" r="2"/><circle cx="4.5" cy="14.5" r="2"/><circle cx="9.5" cy="14.5" r="2"/><circle cx="14.5" cy="14.5" r="2"/><circle cx="19.5" cy="14.5" r="2"/></g><g fill="#ffd23c"><circle cx="9" cy="9" r=".8"/><circle cx="10.2" cy="10" r=".8"/><circle cx="14.5" cy="14.5" r=".8"/><circle cx="19" cy="9.4" r=".8"/><circle cx="4.5" cy="14" r=".8"/></g>',
    mango: '<rect width="24" height="24" fill="#8fd8ff"/><circle cx="17" cy="7" r="6" fill="#1e8a3c"/><ellipse cx="15" cy="9" rx="2" ry="2.6" fill="#f28c1e"/><ellipse cx="19.5" cy="6" rx="1.8" ry="2.3" fill="#ffd23c"/><rect x="16.5" y="12" width="2" height="10" fill="#8a5a2e"/><path d="M4 22V15M4 15L2 10M4 15L6.5 10" stroke="#5a3a1c" stroke-width="1.5" fill="none"/><path d="M2 10q2 3 4.5 0" stroke="#e03c32" stroke-width=".8" fill="none"/><circle cx="9.5" cy="9.5" r="1.1" fill="#141414"/><path d="M6 11L9 9.8" stroke="#141414" stroke-width=".5" stroke-dasharray="1 1"/>',
    cowrie: '<rect width="24" height="24" fill="#9a4fd0"/><rect x="1" y="1" width="10.5" height="10.5" fill="#f4dca6"/><rect x="12.5" y="1" width="10.5" height="10.5" fill="#ffd23c"/><rect x="1" y="12.5" width="10.5" height="10.5" fill="#ffd23c"/><rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#f4dca6"/><ellipse cx="6.2" cy="6.2" rx="3" ry="4" fill="#fff" stroke="#8a5a2e" stroke-width=".7"/><path d="M6.2 3v6.4" stroke="#8a5a2e" stroke-width=".7"/><ellipse cx="17.8" cy="17.8" rx="3" ry="4" fill="#fff" stroke="#8a5a2e" stroke-width=".7"/><path d="M17.8 14.6v6.4" stroke="#8a5a2e" stroke-width=".7"/><text x="17.7" y="9" font-size="7" font-weight="bold" text-anchor="middle" fill="#141414" font-family="sans-serif">4</text><text x="6.3" y="20.5" font-size="7" font-weight="bold" text-anchor="middle" fill="#141414" font-family="sans-serif">8</text>',
    story: '<rect width="24" height="24" fill="#f28c1e"/><circle cx="18" cy="5" r="3" fill="#ffd23c"/><path d="M0 14h3v-6h3v6h2v-9h4v9h2v-5h3v5h7v10H0z" fill="#101a3a"/><rect x="2" y="15" width="16" height="6" fill="#ffd23c"/><rect x="2" y="15" width="16" height="1.4" fill="#141414"/><rect x="4" y="17" width="3" height="2" fill="#8fd8ff"/><rect x="8.5" y="17" width="3" height="2" fill="#8fd8ff"/><rect x="13" y="17" width="3" height="2" fill="#8fd8ff"/><circle cx="5" cy="21.5" r="1.4" fill="#141414"/><circle cx="15" cy="21.5" r="1.4" fill="#141414"/>'
  };
  /* ---------- Whot: Nigeria's card game, you against the computer ----------
     Card id = shape*32 + number. Shapes: 0 circle 1 triangle 2 cross 3 square
     4 star 5 whot (20). Specials: 1 Hold on (play again), 2 Pick two
     (opponent draws 2 and misses a turn), 8 Suspension (opponent misses a
     turn), 14 General market (opponent draws 1 and misses a turn), 20 Whot
     (wild: call the shape the opponent must follow). */
  G.whot = (function () {
    var SH = ['Circle', 'Triangle', 'Cross', 'Square', 'Star', 'Whot'];
    var NUMS = [[1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14], [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
      [1, 2, 3, 5, 7, 10, 11, 13, 14], [1, 2, 3, 5, 7, 10, 11, 13, 14], [1, 2, 3, 4, 5, 7, 8]];
    var SPEC = { 1: 'Hold on', 2: 'Pick two', 8: 'Suspension', 14: 'General market', 20: 'Whot' };
    var SPEC_SPEC = [['d', 'a'], ['h', 'a'], ['c', 'a'], ['t', 'i'], ['sh', 'i'], ['ask', 'i'], ['m', 'i'], ['mc', 'i'], ['cs', 'i'], ['r', 'i'], ['o', 'i']];
    function shp(c) { return Math.floor(c / 32); }
    function num(c) { return c % 32; }
    function name(c) { return shp(c) === 5 ? 'Whot 20' : SH[shp(c)] + ' ' + num(c); }
    function deck() { var d = [], s; for (s = 0; s < 5; s++) { each(NUMS[s], function (n) { d.push(s * 32 + n); }); } for (s = 0; s < 5; s++) { d.push(5 * 32 + 20); } return d; }
    function canPlay(st, c) {
      if (shp(c) === 5) { return true; }
      if (shp(st.t) === 5) { return st.sh === 9 || shp(c) === st.sh; }
      return shp(c) === shp(st.t) || num(c) === num(st.t);
    }
    function draw1(st, hand) { if (st.d.length) { hand.push(st.d.pop()); return true; } return false; }
    function points(hand) { var p = 0; each(hand, function (c) { p += num(c); }); return p; }
    function value(c) { var n = num(c); return n === 20 ? 5 : (n === 2 ? 40 : (n === 14 ? 35 : (n === 8 ? 30 : (n === 1 ? 25 : n)))); }
    function playable(st, hand) { var out = []; each(hand, function (c, i) { if (canPlay(st, c)) { out.push(i); } }); out.sort(function (a, b) { return value(hand[b]) - value(hand[a]); }); return out; }
    function finish(st) { if (!st.h.length || !st.c.length || !st.d.length) { st.o = 1; } }
    /* returns true if the player who played goes again */
    function effect(st, c, other) {
      var n = num(c);
      st.sh = 9;
      if (n === 2) { draw1(st, other); draw1(st, other); return true; }
      if (n === 14) { draw1(st, other); return true; }
      return n === 1 || n === 8;
    }
    function bestShape(hand) { var cnt = [0, 0, 0, 0, 0], b = 0, i; each(hand, function (c) { if (shp(c) < 5) { cnt[shp(c)]++; } }); for (i = 1; i < 5; i++) { if (cnt[i] > cnt[b]) { b = i; } } return b; }
    function cpuTurn(st) {
      var guard = 0, p, c, again;
      st.mc = 0;
      do {
        again = false; guard++;
        if (st.o || !st.c.length) { break; }
        p = playable(st, st.c);
        if (!p.length) { draw1(st, st.c); st.mc = 1; break; }
        c = st.c.splice(p[0], 1)[0]; st.t = c;
        if (shp(c) === 5) { st.sh = bestShape(st.c); st.mc = 3; }
        else { again = effect(st, c, st.h); st.mc = again ? 4 : 2; }
        if (!st.c.length) { break; }
      } while (again && guard < 8);
      finish(st);
    }
    return {
      name: 'Whot', cat: 'cards', short: 'Nigeria\'s card game',
      blurb: 'Match the shape or the number on the top card. First to empty their hand wins.',
      lines: ['Play a card with the same shape or number, or go to market to pick one.',
        'Specials: 1 Hold on, 2 Pick two, 8 Suspension, 14 General market.',
        'Whot 20 plays on anything: then call the shape.'],
      init: function (sd) {
        var st = { d: [], h: [], c: [], t: 0, sh: 9, ask: 0, m: 0, mc: 0, cs: 0, r: sd, o: 0 }, i;
        st.d = shuffle(st, deck());
        for (i = 0; i < 5; i++) { st.h.push(st.d.pop()); st.c.push(st.d.pop()); }
        for (i = st.d.length - 1; i >= 0; i--) { if (!SPEC[num(st.d[i])]) { st.t = st.d.splice(i, 1)[0]; break; } }
        return st;
      },
      enc: function (st) { return pack(SPEC_SPEC, st); },
      dec: function (s) { return unpack(SPEC_SPEC, s); },
      over: function (st) { return st.o === 1; },
      choices: function (st) {
        var out = [], p, i;
        if (st.ask) {
          var cnt = [0, 0, 0, 0, 0], order = [0, 1, 2, 3, 4];
          each(st.h, function (c) { if (shp(c) < 5) { cnt[shp(c)]++; } });
          order.sort(function (a, b) { return cnt[b] - cnt[a]; });
          for (i = 0; i < 4; i++) { out.push(['S' + order[i], 'Call ' + SH[order[i]] + (cnt[order[i]] ? ' (you hold ' + cnt[order[i]] + ')' : '')]); }
          return out;
        }
        p = playable(st, st.h);
        for (i = 0; i < p.length && i < 3; i++) { out.push(['P' + st.h[p[i]], 'Play ' + name(st.h[p[i]]) + (SPEC[num(st.h[p[i]])] && num(st.h[p[i]]) !== 20 ? ' (' + SPEC[num(st.h[p[i]])] + ')' : '')]); }
        out.push(['M', 'Go to market (pick 1)']);
        return out;
      },
      step: function (st, a) {
        var c, i, again;
        st.m = 0; st.mc = 0;
        if (a.charAt(0) === 'S') { st.sh = parseInt(a.substr(1), 10); st.cs = st.sh; st.ask = 0; st.m = 3; cpuTurn(st); return; }
        if (a === 'M') { draw1(st, st.h); st.m = 1; finish(st); if (!st.o) { cpuTurn(st); } return; }
        c = parseInt(a.substr(1), 10); i = st.h.indexOf(c);
        if (i < 0 || !canPlay(st, c)) { return; }
        st.h.splice(i, 1); st.t = c;
        if (!st.h.length) { st.o = 1; st.m = 5; return; }
        if (shp(c) === 5) { st.ask = 1; st.m = 4; return; }
        again = effect(st, c, st.c);
        st.m = again ? 2 : 0;
        finish(st);
        if (!again && !st.o) { cpuTurn(st); }
      },
      prompt: function (st) { return st.ask ? 'You played Whot 20. Call a shape:' : ''; },
      draw: function (st, pw) {
        var b = '', i, n = st.c.length, hx;
        b += R(0, 0, 120, 70, '#1e6a34');
        for (i = 0; i < Math.min(n, 9); i++) { b += R(4 + i * 5, 4, 9, 13, '#8a1c1c', ' stroke="#fff" stroke-width="0.6"'); }
        b += T(4 + Math.min(n, 9) * 5 + 12, 13, n + (n === 1 ? ' card' : ' cards'), 6, '#fff', 'start');
        b += R(78, 4, 14, 20, '#8a1c1c', ' stroke="#fff" stroke-width="0.6"') + T(85, 30, st.d.length + ' left', 5, '#ffd23c');
        b += card(42, 21, st.t, 1.6);
        if (shp(st.t) === 5 && st.sh < 9) { b += T(86, 42, 'Called:', 6, '#ffd23c') + shape(86, 51, st.sh, 5, '#ffd23c'); }
        hx = Math.max(2, 60 - st.h.length * 6);
        for (i = 0; i < Math.min(st.h.length, 10); i++) { b += card(hx + i * 12, 52, st.h[i], 0.75, canPlay(st, st.h[i]) && !st.ask); }
        return svg(120, 70, b, pw);
      },
      ev: function (st) {
        var me = ['', 'You picked one.', 'You go again!', '', 'Call a shape for Whot.', 'You win!'][st.m] || '';
        var cpu = ['', 'Computer went to market.', 'Computer played ' + name(st.t) + '.', 'Computer played Whot, calls ' + SH[st.sh] + '.', 'Computer played ' + name(st.t) + ' and goes again.'][st.mc] || '';
        if (st.m === 3) { me = 'You called ' + SH[st.cs] + '.'; }
        return (me + ' ' + cpu).replace(/^ +| +$/g, '');
      },
      status: function (st) { return 'You ' + st.h.length + ' : ' + st.c.length + ' CPU'; },
      info: function (st) { return st.ask ? 'Pick the shape the computer must follow' : 'Top card: ' + name(st.t) + (shp(st.t) === 5 && st.sh < 9 ? ', called ' + SH[st.sh] : ''); },
      result: function (st) {
        var win = !st.h.length || (st.c.length && points(st.h) < points(st.c));
        if (!st.h.length) { return { win: true, score: 50 + points(st.c), text: 'You win! Hand emptied.' }; }
        if (!st.c.length) { return { win: false, score: 0, text: 'The computer emptied its hand.' }; }
        return { win: win, score: win ? 20 + points(st.c) - points(st.h) : 0, text: 'Market is empty. ' + (win ? 'You win on points!' : 'Computer wins on points.') };
      }
    };
    function shape(x, y, s, r, f) {
      if (s === 0) { return C(x, y, r, f); }
      if (s === 1) { return P('M' + n1(x) + ' ' + n1(y - r) + 'L' + n1(x + r) + ' ' + n1(y + r * 0.8) + 'H' + n1(x - r) + 'Z', f); }
      if (s === 2) { return R(x - r, y - r * 0.32, r * 2, r * 0.64, f) + R(x - r * 0.32, y - r, r * 0.64, r * 2, f); }
      if (s === 3) { return R(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, f); }
      if (s === 4) {
        var pts = [], i, a, rr;
        for (i = 0; i < 10; i++) { a = Math.PI / 5 * i - Math.PI / 2; rr = i % 2 ? r * 0.45 : r; pts.push(n1(x + Math.cos(a) * rr) + ',' + n1(y + Math.sin(a) * rr)); }
        return '<polygon points="' + pts.join(' ') + '" fill="' + f + '"/>';
      }
      return T(x, y + r * 0.45, 'W', r * 1.4, f);
    }
    function card(x, y, c, k, glow) {
      var w = 14 * k, h = 20 * k, col = '#8a1c1c';
      return R(x, y, w, h, '#fff', ' stroke="' + (glow ? '#ffd23c' : '#141414') + '" stroke-width="' + (glow ? 1.2 : 0.5) + '"') +
        shape(x + w / 2, y + h * 0.55, shp(c), 4.2 * k, col) + T(x + 2.6 * k, y + 5 * k, String(num(c)), 4.4 * k, col);
    }
  }());
  /* ---------- Danfo Dash: race a Lagos danfo bus through traffic ----------
     3 lanes, 6 visible rows (row 0 far ahead, row 5 = your bus). Each press
     the road scrolls 1 row (2 with Boost). Hitting a car costs 3 seconds.
     Dashed outlines show where every car will be after the next press. */
  G.danfo = (function () {
    var LEN = 40, ROWS = 6, RIVALS = [44, 46, 49, 52, 56];
    var SPEC = [['tr', 'a'], ['pl', 'i'], ['ds', 'i'], ['tm', 'i'], ['bo', 'i'], ['m', 'i'], ['r', 'i'], ['o', 'i']];
    function genRow(st) {
      var v = ri(st, 10);
      if (st.ds + ROWS > LEN) { return 0; }
      if (v < 4) { return 0; }
      if (v < 9) { return 1 << ri(st, 3); }
      return [3, 5, 6][ri(st, 3)];
    }
    function place(st) {
      var ahead = 0;
      each(RIVALS, function (ft) { if (st.tm * LEN / ft > st.ds) { ahead++; } });
      return ahead + 1;
    }
    function finalPlace(st) { var p = 1; each(RIVALS, function (ft) { if (ft < st.tm) { p++; } }); return p; }
    function ord(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
    function scroll(st) {
      var hit = false;
      st.tr.pop(); st.tr.unshift(genRow(st));
      st.ds++;
      if (st.tr[5] & (1 << st.pl)) { hit = true; st.tr[5] &= ~(1 << st.pl); }
      return hit;
    }
    return {
      name: 'Danfo Dash', cat: 'racing', short: 'Lagos traffic race',
      blurb: 'Race your yellow danfo bus through Lagos traffic against five other buses. Plan each move: dashed outlines show where the cars will be.',
      lines: ['Stay, move left or move right to dodge the cars ahead.',
        'Dashed outlines show where each car will be after your press.',
        'Boost jumps two rows, but you only have three. A crash costs 3 seconds.'],
      init: function (sd) {
        var st = { tr: [0, 0, 0, 0, 0, 0], pl: 1, ds: 0, tm: 0, bo: 3, m: 0, r: sd, o: 0 }, i;
        for (i = 0; i < 4; i++) { st.tr[i] = genRow(st); }
        return st;
      },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return st.o === 1; },
      choices: function (st) {
        var out = [['S', 'Stay in lane']];
        if (st.pl > 0) { out.push(['L', 'Move left']); }
        if (st.pl < 2) { out.push(['R', 'Move right']); }
        if (st.bo > 0) { out.push(['B', 'Boost (' + st.bo + ' left)']); }
        return out;
      },
      step: function (st, a) {
        var hit = false, n = 1;
        st.m = 0;
        if (a === 'L' && st.pl > 0) { st.pl--; }
        if (a === 'R' && st.pl < 2) { st.pl++; }
        if (a === 'B' && st.bo > 0) { st.bo--; n = 2; st.m = 2; }
        if (st.tr[5] & (1 << st.pl)) { hit = true; st.tr[5] &= ~(1 << st.pl); }
        while (n--) { if (scroll(st)) { hit = true; } }
        st.tm += 1;
        if (hit) { st.tm += 3; st.m = 1; }
        if (st.ds >= LEN) { st.o = 1; }
      },
      draw: function (st, pw) {
        var b = '', y, l, x, fin = ROWS - 1 - (LEN - st.ds), cols = ['#e03c32', '#1c3e9c', '#f4f4f4'];
        for (y = 0; y < ROWS; y++) { b += R(19.5, y * 10 + 2, 1, 5, '#fff') + R(39.5, y * 10 + 2, 1, 5, '#fff'); }
        if (fin >= 0 && fin < ROWS) { for (x = 0; x < 12; x++) { b += R(x * 5, fin * 10 + (x % 2) * 2.5, 5, 2.5, '#fff') + R(x * 5, fin * 10 + ((x + 1) % 2) * 2.5, 5, 2.5, '#141414'); } }
        for (y = 0; y < ROWS; y++) {
          for (l = 0; l < 3; l++) {
            if (st.tr[y] & (1 << l)) {
              x = l * 20 + 5;
              if (y < ROWS - 1) { b += GH(x, (y + 1) * 10 + 1.5, 10, 7, '#ffd23c'); }
              b += R(x, y * 10 + 1.5, 10, 7, cols[(y + l + st.ds) % 3]) + R(x + 1.5, y * 10 + 2.5, 7, 2, '#8fd8ff');
            }
          }
        }
        x = st.pl * 20 + 4;
        b += R(x, 51, 12, 8, '#ffd23c', ' stroke="#141414" stroke-width="0.5"') + R(x, 53.5, 12, 1, '#141414') + R(x + 1.5, 51.6, 9, 1.6, '#8fd8ff') +
          C(x + 3, 59, 1.5, '#141414') + C(x + 9, 59, 1.5, '#141414');
        return svg(60, 61, b, pw, '#4a4f58');
      },
      ev: function (st) { return ['', 'Crash! You lose 3 seconds.', 'Boost!'][st.m]; },
      status: function (st) { return ord(place(st)) + ' of 6'; },
      info: function (st) { return 'Distance ' + st.ds + ' of ' + LEN + ' &middot; Time ' + st.tm + ' s'; },
      result: function (st) {
        var p = finalPlace(st);
        return { win: p <= 3, score: Math.max(0, 200 - st.tm * 3) + (7 - p) * 20, text: 'Finished ' + ord(p) + ' of 6 in ' + st.tm + ' seconds' + (p === 1 ? ' - champion!' : '') };
      }
    };
  }());
  /* ---------- Dambe Fighter: Hausa traditional boxing ----------
     Jab beats Hook (faster), Hook beats Block (breaks the guard), Block beats
     Jab (stops it and counters). Same move: they cancel. Before each exchange
     the rival shows a tell; it is honest 6 times in 10. First to 3 clean hits. */
  G.dambe = (function () {
    var MV = ['Jab', 'Hook', 'Block'], BEATS = [1, 2, 0];
    var TELL = ['He bounces on his toes...', 'He winds up his right arm...', 'He raises his guard...'];
    var SPEC = [['y', 'i'], ['c', 'i'], ['nx', 'i'], ['tl', 'i'], ['ly', 'i'], ['lc', 'i'], ['m', 'i'], ['n', 'i'], ['r', 'i']];
    function plan(st) {
      st.nx = ri(st, 3);
      st.tl = ri(st, 10) < 6 ? st.nx : (st.nx + 1 + ri(st, 2)) % 3;
    }
    function fighter(x, c, face, mv, hit) {
      var d = face, b = '', arm;
      b += C(x, 10, 3.2, c) + R(x - 2.8, 13.2, 5.6, 9, c) + R(x - 2.8, 22, 2.2, 5, c) + R(x + 0.6, 22, 2.2, 5, c) + R(x - 2.8, 20, 5.6, 2, '#e03c32');
      if (mv === 2) { arm = R(x + d * 1, 9, 2.4, 6, c) + R(x + d * 1 - 0.2, 7.5, 2.8, 2.6, '#fff'); }
      else if (mv === 1) { arm = R(x + (d > 0 ? 2 : -9), 12, 7, 2.4, c) + R(x + (d > 0 ? 8 : -10.5), 10.5, 3, 3.6, '#fff'); }
      else if (mv === 0) { arm = R(x + (d > 0 ? 2 : -10), 14, 8, 2, c) + R(x + (d > 0 ? 9.5 : -11), 13.2, 2.6, 3, '#fff'); }
      else { arm = R(x + (d > 0 ? 2 : -6), 14.5, 4, 2, c) + R(x + (d > 0 ? 5.5 : -7.5), 13.5, 2.6, 3, '#fff'); }
      b += arm;
      if (hit) { b += P('M' + n1(x - 6) + ' 6l2 2 1-3 1 3 2-2-1 3 3 1-3 1', '#ffd23c'); }
      return b;
    }
    function bar(x, n, col) { var b = '', i; for (i = 0; i < 3; i++) { b += R(x + i * 6, 2, 5, 3, i < n ? col : '#5a3a1c'); } return b; }
    return {
      name: 'Dambe Fighter', cat: 'action', short: 'Hausa boxing',
      blurb: 'Dambe is the traditional boxing of the Hausa people. Read your rival, then strike. Three clean hits wins the bout.',
      lines: ['Jab beats Hook. Hook beats Block. Block beats Jab.',
        'Before each exchange your rival shows a tell. It is honest a bit more than half the time.',
        'First fighter to land 3 clean hits wins.'],
      init: function (sd) { var st = { y: 0, c: 0, nx: 0, tl: 0, ly: 3, lc: 3, m: 0, n: 0, r: sd }; plan(st); return st; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return st.y >= 3 || st.c >= 3 || st.n >= 20; },
      prompt: function (st) { return TELL[st.tl]; },
      choices: function () { return [['0', 'Jab (beats Hook)'], ['1', 'Hook (beats Block)'], ['2', 'Block (beats Jab)']]; },
      step: function (st, a) {
        var me = parseInt(a, 10), cp = st.nx;
        st.ly = me; st.lc = cp; st.n++;
        if (me === cp) { st.m = 3; }
        else if (BEATS[me] === cp) { st.y++; st.m = 1; }
        else { st.c++; st.m = 2; }
        plan(st);
      },
      draw: function (st, pw) {
        var b = '', me = st.m === 1, cpu = st.m === 2;
        b += R(0, 27, 60, 9, '#c8a06a') + C(52, 6, 3, '#ffd23c');
        b += bar(2, st.y, '#1e8a3c') + bar(41, st.c, '#e03c32');
        b += fighter(20, '#5a3a1c', 1, st.ly, cpu) + fighter(40, '#3a2412', -1, st.lc, me);
        b += T(20, 34.5, 'You', 4, '#141414') + T(40, 34.5, 'Rival', 4, '#141414');
        return svg(60, 36, b, pw, '#f28c1e');
      },
      ev: function (st) {
        if (!st.n) { return 'Fight! Read his tell.'; }
        var t = 'Your ' + MV[st.ly] + ' vs his ' + MV[st.lc] + ': ';
        return t + ['', 'clean hit!', 'he hits you!', 'no damage.'][st.m];
      },
      status: function (st) { return st.y + ' - ' + st.c; },
      info: function (st) { return 'Exchange ' + (st.n + 1) + ' &middot; first to 3 hits wins'; },
      result: function (st) {
        var win = st.y > st.c;
        return { win: win, score: win ? 100 + (3 - st.c) * 30 : st.y * 20, text: win ? 'Knock-out! You win ' + st.y + ' - ' + st.c + '.' : (st.y === st.c ? 'A draw, ' : 'You were knocked down, ') + st.y + ' - ' + st.c + '.' };
      }
    };
  }());
  /* ---------- Penalty King: shoot-out against the computer ----------
     Kicks alternate: you shoot (even k), you save (odd k). 5 each, then
     sudden death. The striker's run-up hints at his side, honest 6 in 10. */
  G.pen = (function () {
    var SIDE = ['left', 'centre', 'right'], HINT = ['He looks to your left...', 'He looks straight at you...', 'He looks to your right...'];
    var SPEC = [['k', 'i'], ['yk', 'a'], ['ck', 'a'], ['ls', 'i'], ['ld', 'i'], ['hn', 'i'], ['m', 'i'], ['r', 'i']];
    function sum(a) { var s = 0; each(a, function (v) { s += v === 1 ? 1 : 0; }); return s; }
    function decided(st) {
      var y = sum(st.yk), c = sum(st.ck), ny = st.yk.length, nc = st.ck.length;
      if (ny <= 5 && nc <= 5) { return y + (5 - ny) < c || c + (5 - nc) < y; }
      return ny === nc && y !== c;
    }
    function dots(b, x, y, a, n) { var i; for (i = 0; i < n; i++) { b.s += C(x + i * 6, y, 2, a[i] === 1 ? '#1e8a3c' : (a[i] === 0 ? '#e03c32' : '#d6d2c8')); } }
    return {
      name: 'Penalty King', cat: 'sports', short: 'Win the shoot-out',
      blurb: 'A penalty shoot-out against the computer. Take five kicks, save five, then sudden death.',
      lines: ['When you shoot, pick left, centre or right. The keeper guesses.',
        'When you save, read the striker, then dive.',
        'Most goals after five each wins. Level? Sudden death.'],
      init: function (sd) { var st = { k: 0, yk: [], ck: [], ls: 9, ld: 9, hn: 9, m: 0, r: sd }; return st; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return decided(st) || st.k >= 30; },
      prompt: function (st) {
        if (st.k % 2 === 0) { return 'Your kick. Where do you shoot?'; }
        return 'Save it! ' + HINT[this.hint(st)];
      },
      hint: function (st) { var t = { r: st.r * 7 + st.k }; var aim = this.aim(st); return ri(t, 10) < 6 ? aim : ri(t, 3); },
      aim: function (st) { var t = { r: st.r + st.k * 31 }; var v = ri(t, 10); return v < 4 ? 0 : (v < 8 ? 2 : 1); },
      choices: function (st) {
        var w = st.k % 2 === 0 ? 'Shoot ' : 'Dive ';
        return [['0', w + 'left'], ['1', w + 'centre'], ['2', w + 'right']];
      },
      step: function (st, a) {
        var me = parseInt(a, 10), other;
        if (st.k % 2 === 0) {
          other = ri(st, 10); other = other < 4 ? 0 : (other < 8 ? 2 : 1);
          st.ls = me; st.ld = other; st.yk.push(me === other ? 0 : 1); st.m = me === other ? 2 : 1;
        } else {
          other = this.aim(st);
          st.ls = other; st.ld = me; st.ck.push(me === other ? 0 : 1); st.m = me === other ? 3 : 4;
        }
        st.k++;
      },
      draw: function (st, pw) {
        var b = { s: '' }, bx = [14, 30, 46], kx;
        b.s += R(0, 22, 60, 18, '#2e9e4a') + R(6, 4, 48, 2, '#fff') + R(6, 4, 2, 19, '#fff') + R(52, 4, 2, 19, '#fff');
        b.s += R(8, 6, 44, 17, '#cfe9d6');
        kx = st.ld < 9 ? bx[st.ld] : 30;
        b.s += C(kx, 11, 2.4, '#ffd23c') + R(kx - 2.5, 13.4, 5, 7, '#ffd23c') + R(kx - 6, 14, 3.5, 1.6, '#ffd23c') + R(kx + 2.5, 14, 3.5, 1.6, '#ffd23c');
        if (st.ls < 9) { b.s += C(bx[st.ls], st.m === 2 || st.m === 3 ? 18 : 9, 2.2, '#fff', ' stroke="#141414" stroke-width="0.5"'); }
        else { b.s += C(30, 34, 2.2, '#fff', ' stroke="#141414" stroke-width="0.5"'); }
        b.s += T(2, 46, 'You', 4.5, '#141414', 'start'); dots(b, 18, 44.5, st.yk, Math.max(5, st.yk.length));
        b.s += T(2, 53, 'CPU', 4.5, '#141414', 'start'); dots(b, 18, 51.5, st.ck, Math.max(5, st.ck.length));
        return svg(60, 56, b.s, pw, '#fff8e8');
      },
      ev: function (st) { return ['Shoot-out! You kick first.', 'GOAL! Keeper went ' + SIDE[st.ld] + '.', 'Saved! The keeper read it.', 'Great save!', 'He scores. He went ' + SIDE[st.ls] + '.'][st.m]; },
      status: function (st) { return sum(st.yk) + ' - ' + sum(st.ck); },
      info: function (st) { return (st.k >= 10 ? 'Sudden death' : 'Kick ' + (Math.floor(st.k / 2) + 1) + ' of 5') + (st.k % 2 ? ' &middot; you are in goal' : ' &middot; you are shooting'); },
      result: function (st) {
        var y = sum(st.yk), c = sum(st.ck), win = y > c;
        return { win: win, score: win ? 100 + y * 10 : y * 10, text: (win ? 'You win the shoot-out ' : 'You lose the shoot-out ') + y + ' - ' + c + '.' };
      }
    };
  }());
  /* ---------- Ayo (Oware family), Yoruba sowing game ----------
     Pits 0-5 are yours (A-F, left to right), 6-11 the computer's (shown on
     top, right to left). Sow anticlockwise, skipping the pit you emptied.
     If your last seed lands on the computer's side making 2 or 3, capture
     them, and keep capturing backwards while pits hold 2 or 3. You must give
     the computer seeds if its side is empty. 25 seeds wins. */
  G.ayo = (function () {
    var SPEC = [['a', 'a'], ['sy', 'i'], ['sc', 'i'], ['lc', 'i'], ['ly', 'i'], ['gy', 'i'], ['gc', 'i'], ['n', 'i'], ['r', 'i'], ['o', 'i']];
    var L = 'ABCDEF';
    function sow(a, i) {
      var n = a[i], j = i, cap = 0, mine = i < 6, lo = mine ? 6 : 0;
      a[i] = 0;
      while (n > 0) { j = (j + 1) % 12; if (j === i) { continue; } a[j]++; n--; }
      while (j >= lo && j < lo + 6 && (a[j] === 2 || a[j] === 3)) { cap += a[j]; a[j] = 0; j--; }
      return cap;
    }
    function side(a, mine) { var s = 0, i; for (i = mine ? 0 : 6; i < (mine ? 6 : 12); i++) { s += a[i]; } return s; }
    function legal(a, mine) {
      var out = [], i, lo = mine ? 0 : 6, feed = side(a, !mine) === 0, t;
      for (i = lo; i < lo + 6; i++) {
        if (!a[i]) { continue; }
        if (feed) { t = a.slice(); sow(t, i); if (side(t, !mine) === 0) { continue; } }
        out.push(i);
      }
      return out;
    }
    function gain(a, i) { var t = a.slice(); return sow(t, i); }
    function endCheck(st) {
      if (st.sy >= 25 || st.sc >= 25) { st.o = 1; return; }
      if (!legal(st.a, true).length || !legal(st.a, false).length || st.n >= 200) {
        st.sy += side(st.a, true); st.sc += side(st.a, false);
        each(st.a, function (v, i) { st.a[i] = 0; });
        st.o = 1;
      }
    }
    function cpu(st) {
      var mv = legal(st.a, false), best = -1, bv = -1;
      if (!mv.length) { endCheck(st); return; }
      if (ri(st, 10) < 5) { best = mv[ri(st, mv.length)]; } else { each(mv, function (i) { var g = gain(st.a, i) * 10 + ri(st, 10); if (g > bv) { bv = g; best = i; } }); }
      st.lc = best; st.gc = sow(st.a, best); st.sc += st.gc; st.n++;
      endCheck(st);
    }
    return {
      name: 'Ayo', cat: 'board', short: 'Seed sowing',
      blurb: 'Ayo is the Yoruba sowing game, played across West Africa as Oware. Sow seeds, capture twos and threes, and collect 25 to win.',
      lines: ['Pick one of your pits (bottom row, A to F). Its seeds are sown one per pit, going right.',
        'If your last seed makes 2 or 3 in a computer pit, you take them, and the pits before it too.',
        'First to 25 seeds wins.'],
      init: function (sd) { return { a: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], sy: 0, sc: 0, lc: 12, ly: 12, gy: 0, gc: 0, n: 0, r: sd, o: 0 }; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return st.o === 1; },
      choices: function (st) {
        var mv = legal(st.a, true), out = [];
        mv.sort(function (x, y) { return gain(st.a, y) - gain(st.a, x) || st.a[y] - st.a[x]; });
        each(mv.slice(0, 4), function (i) { var g = gain(st.a, i); out.push([String(i), 'Pit ' + L.charAt(i) + ' (' + st.a[i] + ' seeds)' + (g ? ' takes ' + g : '')]); });
        return out;
      },
      step: function (st, a) {
        var i = parseInt(a, 10);
        if (legal(st.a, true).indexOf(i) < 0) { return; }
        st.ly = i; st.gy = sow(st.a, i); st.sy += st.gy; st.n++;
        st.lc = 12; st.gc = 0;
        endCheck(st);
        if (!st.o) { cpu(st); }
      },
      draw: function (st, pw) {
        var b = '', i, x, y, v, k, s;
        b += R(1, 3, 98, 32, '#8a5a2e') + R(1, 3, 98, 32, 'none', ' stroke="#5a3a1c" stroke-width="1"');
        for (i = 0; i < 12; i++) {
          x = i < 6 ? 15 + i * 14 : 15 + (11 - i) * 14; y = i < 6 ? 27 : 11; v = st.a[i];
          b += C(x, y, 6, '#5a3a1c', (i === st.lc || i === st.ly) ? ' stroke="#ffd23c" stroke-width="1.2"' : '');
          for (k = 0; k < Math.min(v, 6); k++) { b += C(x - 3 + (k % 3) * 3, y - 1.5 + Math.floor(k / 3) * 3, 1.1, '#f4dca6'); }
          if (v > 6) { b += T(x, y + 4.5, '+' + (v - 6), 3.6, '#ffd23c'); }
          b += T(x, i < 6 ? y + 12 : y - 7.5, String(v), 5, '#141414');
        }
        for (i = 0; i < 6; i++) { b += T(15 + i * 14 - 6.5, 22, L.charAt(i), 3.6, '#f4dca6', 'start'); }
        b = b.replace(/<text([^>]*)y="45"/g, '<text$1y="45"');
        return svg(100, 47, b, pw, '#f4dca6');
      },
      ev: function (st) {
        if (!st.n) { return 'Your move. Pick a pit.'; }
        var t = st.gy ? 'You took ' + st.gy + '. ' : '';
        return t + (st.lc < 12 ? 'CPU moved (outlined)' + (st.gc ? ' and took ' + st.gc : '') + '.' : '');
      },
      status: function (st) { return 'You ' + st.sy + ' : ' + st.sc + ' CPU'; },
      info: function () { return 'First to 25 seeds wins'; },
      result: function (st) {
        var win = st.sy > st.sc;
        return { win: win, score: st.sy * 4, text: (win ? 'You win ' : (st.sy === st.sc ? 'A draw, ' : 'The computer wins ')) + st.sy + ' - ' + st.sc + '.' };
      }
    };
  }());
  /* ---------- Mango Defender: slingshot against mango-stealing monkeys ----------
     Three branches (High, Middle, Low). Each branch holds monkeys at spots
     1-4 (4 = far end, 1 = next to the mangoes), stored as a 4-bit mask.
     Each press you fire at one branch and hit its nearest monkey; then every
     monkey creeps one spot closer, and one at spot 1 grabs a mango. Survive
     20 turns with at least one mango left. */
  G.mango = (function () {
    var BR = ['high', 'middle', 'low'], TURNS = 20;
    var SPEC = [['b', 'a'], ['mg', 'i'], ['t', 'i'], ['sc', 'i'], ['lh', 'i'], ['lb', 'i'], ['st', 'i'], ['r', 'i']];
    function low(m) { var i; for (i = 0; i < 4; i++) { if (m & (1 << i)) { return i; } } return 9; }
    function count(m) { var c = 0, i; for (i = 0; i < 4; i++) { if (m & (1 << i)) { c++; } } return c; }
    function spawn(st) {
      var n = st.t < 3 ? 1 : (ri(st, 10) < (st.t < 10 ? 5 : 7) ? 2 : 1), k, br;
      for (k = 0; k < n; k++) { br = ri(st, 3); st.b[br] |= 8; }
    }
    return {
      name: 'Mango Defender', cat: 'shooting', short: 'Slingshot the thieves',
      blurb: 'Monkeys are creeping along the branches to raid your mango tree. Fire your slingshot and save the harvest for 20 turns.',
      lines: ['Pick a branch: high, middle or low. Your stone hits the monkey nearest the mangoes.',
        'After each shot every monkey moves one step closer. A red mark means it grabs a mango next turn.',
        'Keep at least one mango for 20 turns to win.'],
      init: function (sd) { var st = { b: [0, 0, 0], mg: 5, t: 0, sc: 0, lh: 0, lb: 9, st: 0, r: sd }; st.b[1] = 8; st.b[0] = 4; return st; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return st.mg <= 0 || st.t >= TURNS; },
      choices: function (st) {
        var order = [0, 1, 2];
        order.sort(function (x, y) { return low(st.b[x]) - low(st.b[y]) || x - y; });
        return [[String(order[0]), 'Aim ' + BR[order[0]]], [String(order[1]), 'Aim ' + BR[order[1]]], [String(order[2]), 'Aim ' + BR[order[2]]]];
      },
      step: function (st, a) {
        var b = parseInt(a, 10), i, p;
        st.lb = b; st.lh = 0; st.st = 0;
        p = low(st.b[b]);
        if (p < 9) { st.b[b] &= ~(1 << p); st.lh = 1; st.sc += 10 + (3 - p) * 5; }
        for (i = 0; i < 3; i++) { if (st.b[i] & 1) { st.mg = Math.max(0, st.mg - 1); st.st++; } st.b[i] = st.b[i] >> 1; }
        st.t++;
        if (st.t < TURNS) { spawn(st); }
      },
      draw: function (st, pw) {
        var b = '', i, k, y, x, m;
        b += R(0, 44, 80, 6, '#5fd35a') + R(4, 6, 6, 40, '#8a5a2e') + C(9, 8, 9, '#1e8a3c');
        for (k = 0; k < 5; k++) { b += C(5 + (k % 3) * 4, 6 + Math.floor(k / 3) * 4, 2, k < st.mg ? '#f28c1e' : '#0f5a26'); }
        for (i = 0; i < 3; i++) {
          y = 14 + i * 11;
          b += R(10, y, 56, 2.2, '#8a5a2e') + T(70, y + 2.5, ['High', 'Mid', 'Low'][i], 4, '#101a3a', 'start');
          for (k = 0; k < 4; k++) {
            x = 18 + k * 12;
            if (st.b[i] & (1 << k)) {
              b += GH(x - 15, y - 7, 6, 7, '#fff');
              b += C(x, y - 4, 3.2, '#7a4a22') + C(x, y - 3.4, 1.8, '#e8c49a') + C(x - 0.8, y - 4.2, 0.45, '#141414') + C(x + 0.8, y - 4.2, 0.45, '#141414');
              if (k === 0) { b += C(x + 3.5, y - 7, 1.3, '#e03c32'); }
            }
          }
          if (st.lb === i) { b += P('M74 47L' + 66 + ' ' + n1(y + 1) , 'none', ' stroke="#141414" stroke-width="0.4" stroke-dasharray="1 1"'); }
        }
        b += R(73, 44, 1.4, 6, '#5a3a1c') + P('M73.7 44l-2.5-4M73.7 44l2.5-4', 'none', ' stroke="#5a3a1c" stroke-width="1"');
        return svg(80, 50, b, pw, '#8fd8ff');
      },
      ev: function (st) {
        if (!st.t) { return 'Monkeys are coming! Aim and fire.'; }
        return (st.lh ? 'Hit! ' : 'Missed - nobody there. ') + (st.st ? 'A monkey grabbed a mango!' : '');
      },
      status: function (st) { return st.mg + ' mangoes'; },
      info: function (st) { return 'Turn ' + (st.t + 1) + ' of ' + TURNS + ' &middot; Score ' + st.sc; },
      result: function (st) {
        var win = st.mg > 0;
        return { win: win, score: st.sc + st.mg * 30, text: win ? 'Harvest saved with ' + st.mg + ' mango' + (st.mg === 1 ? '' : 'es') + '!' : 'The monkeys took every mango.' };
      }
    };
  }());
  /* ---------- Cowrie Merge: slide-and-merge puzzle (2048 style) ----------
     4x4 grid of exponents (0 empty, 1 = 2, 2 = 4 ...). Only moves that change
     the grid are offered, the one that merges most first. The new cowrie is
     outlined so the player sees where it landed. */
  G.cowrie = (function () {
    var SPEC = [['g', 'a'], ['sc', 'i'], ['nw', 'i'], ['n', 'i'], ['lm', 'i'], ['r', 'i']];
    var DN = { U: 'Slide up', L: 'Slide left', R: 'Slide right', D: 'Slide down' };
    var COL = ['#efe6cf', '#f4dca6', '#ffd23c', '#f28c1e', '#e03c32', '#c2185b', '#9a4fd0', '#1c3e9c', '#22a6a0', '#1e8a3c', '#101a3a', '#141414'];
    function line(g, d, k) {
      var idx = [], i;
      for (i = 0; i < 4; i++) {
        if (d === 'L') { idx.push(k * 4 + i); } else if (d === 'R') { idx.push(k * 4 + 3 - i); }
        else if (d === 'U') { idx.push(i * 4 + k); } else { idx.push((3 - i) * 4 + k); }
      }
      return idx;
    }
    function move(g, d) {
      var out = g.slice(), gain = 0, k, idx, vals, res, i, moved = false;
      for (k = 0; k < 4; k++) {
        idx = line(g, d, k); vals = []; res = [];
        each(idx, function (j) { if (g[j]) { vals.push(g[j]); } });
        for (i = 0; i < vals.length; i++) {
          if (i + 1 < vals.length && vals[i] === vals[i + 1]) { res.push(vals[i] + 1); gain += 1 << (vals[i] + 1); i++; } else { res.push(vals[i]); }
        }
        while (res.length < 4) { res.push(0); }
        each(idx, function (j, n) { if (out[j] !== res[n]) { moved = true; } out[j] = res[n]; });
      }
      return { g: out, gain: gain, moved: moved };
    }
    function addTile(st) {
      var e = [];
      each(st.g, function (v, i) { if (!v) { e.push(i); } });
      if (!e.length) { st.nw = 16; return; }
      st.nw = e[ri(st, e.length)]; st.g[st.nw] = ri(st, 10) < 9 ? 1 : 2;
    }
    function moves(st) { var out = []; each(['U', 'L', 'R', 'D'], function (d) { var m = move(st.g, d); if (m.moved) { out.push([d, m.gain]); } }); return out; }
    function top(st) { var t = 0; each(st.g, function (v) { if (v > t) { t = v; } }); return t; }
    return {
      name: 'Cowrie Merge', cat: 'puzzle', short: 'Merge the shells',
      blurb: 'Slide the cowrie shells. Two of the same number merge into one worth double. How high can you go?',
      lines: ['Pick a direction: every shell slides that way.',
        'Two equal shells that meet merge into one worth double.',
        'The game ends when no slide is possible. Reach 256 to beat the game!'],
      init: function (sd) { var st = { g: [], sc: 0, nw: 16, n: 0, lm: 0, r: sd }, i; for (i = 0; i < 16; i++) { st.g.push(0); } addTile(st); addTile(st); return st; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { return unpack(SPEC, s); },
      over: function (st) { return !moves(st).length; },
      choices: function (st) {
        var m = moves(st);
        m.sort(function (a, b) { return b[1] - a[1]; });
        return m.map(function (x) { return [x[0], DN[x[0]] + (x[1] ? ' (+' + x[1] + ')' : '')]; });
      },
      step: function (st, a) {
        var m = move(st.g, a);
        if (!m.moved) { return; }
        st.g = m.g; st.sc += m.gain; st.lm = m.gain; st.n++;
        addTile(st);
      },
      draw: function (st, pw) {
        var b = '', i, x, y, v;
        for (i = 0; i < 16; i++) {
          x = 2 + (i % 4) * 14.5; y = 2 + Math.floor(i / 4) * 14.5; v = st.g[i];
          b += R(x, y, 13, 13, COL[Math.min(v, 11)], i === st.nw ? ' stroke="#141414" stroke-width="1" stroke-dasharray="1.5 1"' : '');
          if (v) {
            b += '<ellipse cx="' + n1(x + 6.5) + '" cy="' + n1(y + 4.3) + '" rx="2.6" ry="1.8" fill="#fff" stroke="#8a5a2e" stroke-width="0.4"/>';
            b += T(x + 6.5, y + 11.2, String(1 << v), v > 9 ? 4.2 : 5.4, v > 2 ? '#fff' : '#141414');
          }
        }
        return svg(62, 62, b, Math.min(pw, SMALL ? 120 : 180), '#8a5a2e');
      },
      ev: function (st) { return !st.n ? 'Slide to merge equal shells.' : (st.lm ? 'Merged! +' + st.lm : 'Shells moved.'); },
      status: function (st) { return 'Score ' + st.sc; },
      info: function (st) { return 'Top shell ' + (1 << top(st)) + ' &middot; goal 256'; },
      result: function (st) { var t = 1 << top(st); return { win: t >= 256, score: st.sc, text: 'No more slides. Top shell: ' + t + (t >= 256 ? ' - you beat it!' : '.') }; }
    };
  }());
  /* ---------- Lagos Hustle: choose-what-happens-next story ----------
     Each scene: picture, short text, 2-3 choices with a money change (Naira).
     Scenes without choices are endings. */
  G.story = (function () {
    var S = {
      0: ['bus', 'You step off the bus at Oshodi with N5,000 and a dream: your own phone repair business.',
        [['Take a danfo to Computer Village (N300)', 1, -300], ['Walk there and save money', 2, 0]]],
      1: ['market', 'Computer Village is loud and busy. A trader waves a repair kit at you.',
        [['Buy the kit for N3,000', 3, -3000], ['Ask Mr Tunde for apprentice work', 4, 0]]],
      2: ['rain', 'Halfway there, the rain pours down. You run under a bridge where Aisha sells phone chargers.',
        [['Chat with Aisha', 5, 0], ['Keep walking in the rain', 1, 0]]],
      3: ['table', 'You set up a small table. Your first customer has a cracked screen.',
        [['Fix it slowly and carefully', 6, 1500], ['Rush it to serve more people', 7, 1000]]],
      4: ['shop', 'Mr Tunde says yes. After two weeks he pays you N2,000 and gives you old tools.',
        [['Go solo with your new skills', 3, 2000], ['Stay one more month', 12, 4000]]],
      5: ['market', 'Aisha has an idea: she sells chargers, you fix phones, and you share one kiosk.',
        [['Shake hands, partners!', 8, 0], ['Thank her, but go alone', 1, 0]]],
      6: ['sun', 'Word spreads: "the careful fixer". A school asks you to repair 20 phones by Friday.',
        [['Accept and hire a helper', 9, 3000], ['Say no, it is too big', 10, 1000]]],
      7: ['sad', 'The screen cracks again the next day. The customer is very angry.',
        [['Refund and say sorry', 11, -1000], ['Argue with him', 13, 0]]],
      8: ['shop', 'The kiosk is busy. Aisha says a solar panel would let you charge phones all night.',
        [['Buy the solar panel (N2,000)', 9, -2000 + 6000], ['Keep things simple', 10, 2000]]],
      9: ['school', '', null, 'Boss of the Village! Your stall becomes a real shop with your name on the sign.', 15000],
      10: ['table', '', null, 'Small but steady. You pay your rent every month and your customers trust you.', 5000],
      11: ['sun', 'Two days later he comes back with three friends. "This one is honest," he tells them.',
        [['Fix their phones carefully', 6, 2500]]],
      12: ['shop', 'Mr Tunde is impressed. He offers you a corner of his shop to run your own repairs.',
        [['Take the corner', 6, 0], ['Thank him and go solo', 3, 0]]],
      13: ['sad', '', null, 'Bad news travels fast in the market. You pack up and take the bus home. Try again!', 0]
    };
    var SPEC = [['nd', 'i'], ['mo', 'i'], ['n', 'i'], ['r', 'i']];
    function pic(kind) {
      var b = '';
      if (kind === 'bus') { b += R(0, 22, 60, 8, '#4a4f58') + R(10, 10, 34, 12, '#ffd23c') + R(10, 13, 34, 1.5, '#141414') + R(13, 11, 5, 2, '#8fd8ff') + R(21, 11, 5, 2, '#8fd8ff') + R(29, 11, 5, 2, '#8fd8ff') + C(16, 22, 2.5, '#141414') + C(38, 22, 2.5, '#141414') + C(52, 6, 3, '#ffd23c'); }
      else if (kind === 'market') { b += R(0, 22, 60, 8, '#c8a06a') + R(4, 10, 16, 12, '#e03c32') + R(4, 8, 16, 3, '#fff') + R(24, 12, 14, 10, '#1c3e9c') + R(24, 10, 14, 3, '#ffd23c') + R(42, 9, 15, 13, '#1e8a3c') + R(42, 7, 15, 3, '#fff') + R(8, 14, 3, 4, '#141414') + R(28, 15, 3, 4, '#8fd8ff') + R(47, 13, 3, 5, '#ffd23c'); }
      else if (kind === 'rain') { var i; b += R(0, 22, 60, 8, '#4a4f58') + R(0, 6, 60, 4, '#9aa0a8') + R(8, 10, 3, 12, '#9aa0a8') + R(49, 10, 3, 12, '#9aa0a8'); for (i = 0; i < 14; i++) { b += R(3 + i * 4.2, (i * 7) % 18 + 11, 0.6, 3, '#8fd8ff'); } b += C(30, 14, 2.4, '#5a3a1c') + R(28, 16.4, 4, 6, '#f28c1e'); }
      else if (kind === 'table') { b += R(0, 22, 60, 8, '#c8a06a') + R(14, 14, 32, 3, '#8a5a2e') + R(16, 17, 2, 6, '#8a5a2e') + R(42, 17, 2, 6, '#8a5a2e') + R(20, 9, 6, 5, '#141414') + R(21, 10, 4, 3, '#8fd8ff') + R(32, 11, 8, 3, '#e03c32') + C(52, 6, 3, '#ffd23c'); }
      else if (kind === 'shop') { b += R(0, 22, 60, 8, '#c8a06a') + R(8, 6, 44, 16, '#fff8e8') + R(8, 4, 44, 4, '#1c3e9c') + T(30, 7.4, 'REPAIRS', 3, '#ffd23c') + R(14, 11, 10, 7, '#8fd8ff') + R(30, 10, 8, 12, '#8a5a2e') + R(42, 11, 6, 7, '#8fd8ff'); }
      else if (kind === 'school') { b += R(0, 22, 60, 8, '#5fd35a') + R(6, 8, 48, 14, '#f28c1e') + P('M4 8L30 1L56 8Z', '#e03c32') + R(26, 14, 8, 8, '#8a5a2e') + R(10, 11, 6, 4, '#8fd8ff') + R(44, 11, 6, 4, '#8fd8ff') + T(30, 6.6, 'YOUR SHOP', 2.8, '#fff'); }
      else if (kind === 'sun') { b += R(0, 22, 60, 8, '#c8a06a') + C(30, 11, 6, '#ffd23c') + C(14, 18, 2.2, '#5a3a1c') + R(12, 20.2, 4, 4, '#1e8a3c') + C(46, 18, 2.2, '#5a3a1c') + R(44, 20.2, 4, 4, '#1c3e9c'); }
      else { b += R(0, 22, 60, 8, '#4a4f58') + C(30, 12, 6, '#9aa0a8') + C(28, 11, 0.8, '#141414') + C(32, 11, 0.8, '#141414') + P('M27 16q3-2 6 0', 'none', ' stroke="#141414" stroke-width="0.6"'); }
      return b;
    }
    return {
      name: 'Lagos Hustle', cat: 'story', short: 'Your choices',
      blurb: 'You arrive in Lagos with N5,000 and a dream. Every choice changes your story and your money. Can you become Boss of the Village?',
      lines: ['Read the scene, then pick what you do next.',
        'Each choice can make or lose you money.',
        'There are several endings. Find the best one!'],
      init: function (sd) { return { nd: 0, mo: 5000, n: 0, r: sd }; },
      enc: function (st) { return pack(SPEC, st); },
      dec: function (s) { var st = unpack(SPEC, s); if (!S[st.nd]) { throw new Error('bad scene'); } return st; },
      over: function (st) { return !S[st.nd][2]; },
      prompt: function (st) { return S[st.nd][1]; },
      choices: function (st) { var out = []; each(S[st.nd][2] || [], function (c, i) { out.push([String(i), c[0]]); }); return out; },
      step: function (st, a) { var c = S[st.nd][2][parseInt(a, 10)]; if (!c) { return; } st.mo = Math.max(0, st.mo + c[2]); st.nd = c[1]; st.n++; if (!S[st.nd][2]) { st.mo += S[st.nd][4]; } },
      draw: function (st, pw) { return svg(60, 30, pic(S[st.nd][0]), pw, '#8fd8ff'); },
      ev: function (st) { return st.n ? 'Chapter ' + (st.n + 1) : 'Chapter 1: Arrival'; },
      status: function (st) { return 'N' + st.mo; },
      info: function (st) { return 'Money: N' + st.mo; },
      result: function (st) { var s = S[st.nd]; return { win: s[4] > 0, score: Math.round(st.mo / 100), text: s[3] + ' You end with N' + st.mo + '.' }; }
    };
  }());

  return { G: G, ORDER: ORDER, render: render, main: main };
}());
