/* vplay Games lite: step-based games for Opera Mini on basic phones.
   ES5 on purpose. Opera Mini runs this script on Opera's servers each time a
   page loads. Game state travels in the link (?s=...), so there is no backend
   and no browser storage. Needs art.js (palette and sprites) loaded first. */
var V = (function () {
  var G = {};
  var ORDER = ['chop', 'harm', 'road', 'coco', 'mamba', 'pen', 'oware', 'cowrie'];
  var CATS = [
    { id: 'arcade', name: 'Arcade', col: '#e03c32', note: 'Quick action' },
    { id: 'sports', name: 'Sports', col: '#1e8a3c', note: 'Football' },
    { id: 'board', name: 'Board', col: '#8a5a2e', note: 'Classic African' },
    { id: 'puzzle', name: 'Puzzle', col: '#9a4fd0', note: 'Think ahead' }
  ];
  var PAL = ART.PAL, SPR = ART.SPR, SPC = {}, SVGN = 0;
  var Q = {};

  /* ---------- small helpers ---------- */
  function each(a, f) { for (var i = 0; i < a.length; i++) { f(a[i], i); } }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function b36(n) { return n.toString(36); }
  function p36(s) { var n = parseInt(s, 36); return isNaN(n) ? 0 : n; }
  function num(s) { var n = parseInt(s, 10); return isNaN(n) ? 0 : n; }
  function rnd(st) { st.r = (st.r * 16807) % 2147483647; return st.r; }
  function ri(st, n) { return rnd(st) % n; }
  function newSeed() { return (new Date().getTime() % 2147483646) + 1; }
  function catOf(id) { for (var i = 0; i < CATS.length; i++) { if (CATS[i].id === G[id].cat) { return CATS[i]; } } return CATS[0]; }
  function bitsEnc(bits) {
    var out = '', i, j, v, s;
    for (i = 0; i < bits.length; i += 20) {
      v = 0;
      for (j = 0; j < 20; j++) { v = v * 2 + (bits[i + j] ? 1 : 0); }
      s = b36(v);
      while (s.length < 4) { s = '0' + s; }
      out += s;
    }
    return out;
  }
  function bitsDec(str, n) {
    var bits = [], i, j, v, chunk, out = [];
    for (i = 0; i < str.length; i += 4) {
      v = p36(str.substr(i, 4));
      chunk = [];
      for (j = 0; j < 20; j++) { chunk.unshift(v % 2); v = Math.floor(v / 2); }
      for (j = 0; j < 20; j++) { bits.push(chunk[j]); }
    }
    for (i = 0; i < n; i++) { out.push(bits[i] === 1 ? 1 : 0); }
    return out;
  }
  function pts(str, size) {
    var out = [], i, j, g;
    if (!str) { return out; }
    for (i = 0; i + size <= str.length; i += size) {
      g = [];
      for (j = 0; j < size; j++) { g.push(p36(str.charAt(i + j))); }
      out.push(g);
    }
    return out;
  }
  function ptsEnc(list) {
    var s = '';
    each(list, function (g) { each(g, function (v) { s += b36(v); }); });
    return s;
  }

  /* ---------- sprites ---------- */
  function rot90(m) {
    var out = [], x, y, row;
    for (x = 0; x < m[0].length; x++) { row = ''; for (y = m.length - 1; y >= 0; y--) { row += m[y].charAt(x); } out.push(row); }
    return out;
  }
  function flipH(m) { var out = [], i; for (i = 0; i < m.length; i++) { out.push(m[i].split('').reverse().join('')); } return out; }
  function sprite(name, fx, ro, sw) {
    var key = name + '|' + (fx ? 1 : 0) + '|' + (ro || 0) + '|' + (sw || ''), m, i, map = {}, runs = [], y, x, c, st, cnt = {}, dom = '', best = 0, col;
    if (SPC[key]) { return SPC[key]; }
    m = SPR[name].slice();
    for (i = 0; i < (ro || 0); i++) { m = rot90(m); }
    if (fx) { m = flipH(m); }
    if (sw) { each(sw.split(','), function (p) { map[p.charAt(0)] = p.substr(2); }); }
    for (y = 0; y < m.length; y++) {
      x = 0;
      while (x < m[y].length) {
        c = m[y].charAt(x);
        if (c === '.') { x++; continue; }
        st = x;
        while (x < m[y].length && m[y].charAt(x) === c) { x++; }
        col = map[c] !== undefined ? map[c] : c;
        col = PAL[col] || col;
        runs.push([st, y, x - st, col]);
        if (c !== 'k') { cnt[col] = (cnt[col] || 0) + (x - st); if (cnt[col] > best) { best = cnt[col]; dom = col; } }
      }
    }
    SPC[key] = { w: m[0].length, h: m.length, runs: runs, dom: dom || PAL.k };
    return SPC[key];
  }

  /* ---------- scenes and the three picture modes ---------- */
  function scene(w, h, cw, ch, bg) { return { w: w, h: h, cw: cw, ch: ch, bg: bg, it: [] }; }
  function R(sc, x, y, w, h, f) { sc.it.push({ t: 'r', x: x, y: y, w: w, h: h, f: f }); }
  function C(sc, x, y, r, f) { sc.it.push({ t: 'c', x: x, y: y, r: r, f: f }); }
  function P(sc, p, f) { sc.it.push({ t: 'p', p: p, f: f }); }
  function T(sc, x, y, s, f, z) { sc.it.push({ t: 'x', x: x, y: y, s: String(s), f: f, z: z || 9 }); }
  function S(sc, x, y, n, o) { o = o || {}; sc.it.push({ t: 's', x: x, y: y, n: n, fx: o.fx, ro: o.ro, sw: o.sw, k: o.k || 1 }); }
  function zoom() { return Q.z === '2' ? 2 : 1; }
  function n1(v) { return Math.round(v * 10) / 10; }

  function toSvg(sc, z) {
    var W = sc.w * sc.cw, H = sc.h * sc.ch, m = Math.min(sc.cw, sc.ch), pre = 'v' + (SVGN++) + 's', defs = {}, dn = 0, body = '', ds = '', pf = '', pd = '';
    function flush() { if (pd) { body += '<path fill="' + pf + '" d="' + pd + '"/>'; pd = ''; pf = ''; } }
    each(sc.it, function (o) {
      var q, key, id, sp, byCol, order, k;
      if (o.t === 'r') {
        /* consecutive rectangles of one colour become a single path */
        if (pf !== o.f) { flush(); pf = o.f; }
        pd += 'M' + n1(o.x * sc.cw) + ' ' + n1(o.y * sc.ch) + 'h' + n1(o.w * sc.cw) + 'v' + n1(o.h * sc.ch) + 'h' + n1(-o.w * sc.cw) + 'z';
        return;
      }
      flush();
      if (o.t === 'c') {
        body += '<circle cx="' + n1(o.x * sc.cw) + '" cy="' + n1(o.y * sc.ch) + '" r="' + n1(o.r * m) + '" fill="' + o.f + '"/>';
      } else if (o.t === 'p') {
        q = [];
        each(o.p, function (pt) { q.push(n1(pt[0] * sc.cw) + ',' + n1(pt[1] * sc.ch)); });
        body += '<polygon points="' + q.join(' ') + '" fill="' + o.f + '"/>';
      } else if (o.t === 'x') {
        body += '<text x="' + n1(o.x * sc.cw) + '" y="' + n1(o.y * sc.ch + o.z * 0.35) + '" font-size="' + o.z +
          '" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="' + o.f + '">' + esc(o.s) + '</text>';
      } else if (o.t === 's') {
        key = o.n + '|' + (o.fx ? 1 : 0) + '|' + (o.ro || 0) + '|' + (o.sw || '') + '|' + o.k;
        id = defs[key];
        if (!id) {
          id = pre + (dn++); defs[key] = id; sp = sprite(o.n, o.fx, o.ro, o.sw); k = o.k;
          byCol = {}; order = [];
          each(sp.runs, function (r) {
            if (!byCol[r[3]]) { byCol[r[3]] = ''; order.push(r[3]); }
            byCol[r[3]] += 'M' + r[0] * k + ' ' + r[1] * k + 'h' + r[2] * k + 'v' + k + 'h-' + r[2] * k + 'z';
          });
          ds += '<g id="' + id + '" shape-rendering="crispEdges">';
          each(order, function (c) { ds += '<path fill="' + c + '" d="' + byCol[c] + '"/>'; });
          ds += '</g>';
        }
        body += '<use xlink:href="#' + id + '" x="' + n1(o.x * sc.cw) + '" y="' + n1(o.y * sc.ch) + '"/>';
      }
    });
    flush();
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + n1(W * z) + '" height="' + n1(H * z) +
      '" viewBox="0 0 ' + W + ' ' + H + '">' + (ds ? '<defs>' + ds + '</defs>' : '') + '<rect width="' + W + '" height="' + H + '" fill="' + sc.bg + '"/>' + body + '</svg>';
  }

  function toTable(sc, z) {
    var grid = [], x, y, row, cell, h, m = Math.min(sc.cw, sc.ch);
    for (y = 0; y < sc.h; y++) { row = []; for (x = 0; x < sc.w; x++) { row.push({ f: sc.bg, d: '', s: '' }); } grid.push(row); }
    function setF(gx, gy, f) { if (grid[gy] && grid[gy][gx]) { grid[gy][gx].f = f; grid[gy][gx].d = ''; } }
    each(sc.it, function (o) {
      var minx, maxx, miny, maxy, cx, cy, sp, x2, y2;
      if (o.t === 'x') {
        y = Math.floor(o.y); x = Math.floor(o.x);
        if (grid[y] && grid[y][x]) { grid[y][x].s = o.s; grid[y][x].tc = o.f; }
        return;
      }
      if (o.t === 's') {
        sp = sprite(o.n, o.fx, o.ro, o.sw);
        x2 = o.x + sp.w * o.k / sc.cw; y2 = o.y + sp.h * o.k / sc.ch;
        for (y = Math.floor(o.y + 0.01); y < y2 - 0.01; y++) { for (x = Math.floor(o.x + 0.01); x < x2 - 0.01; x++) { setF(x, y, sp.dom); } }
        return;
      }
      for (y = 0; y < sc.h; y++) {
        for (x = 0; x < sc.w; x++) {
          cx = x + 0.5; cy = y + 0.5;
          if (o.t === 'r') {
            if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) { setF(x, y, o.f); }
          } else if (o.t === 'c') {
            if (Math.floor(o.x) === x && Math.floor(o.y) === y) {
              if (o.r < 0.3) { grid[y][x].d = o.f; } else { setF(x, y, o.f); }
            } else {
              var dx = (cx - o.x) * sc.cw, dy = (cy - o.y) * sc.ch;
              if (dx * dx + dy * dy <= o.r * m * o.r * m) { setF(x, y, o.f); }
            }
          } else if (o.t === 'p') {
            minx = 99; maxx = -99; miny = 99; maxy = -99;
            each(o.p, function (pt) {
              if (pt[0] < minx) { minx = pt[0]; } if (pt[0] > maxx) { maxx = pt[0]; }
              if (pt[1] < miny) { miny = pt[1]; } if (pt[1] > maxy) { maxy = pt[1]; }
            });
            if (cx >= minx && cx <= maxx && cy >= miny && cy <= maxy) { setF(x, y, o.f); }
          }
        }
      }
    });
    h = '<table cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 auto">';
    for (y = 0; y < sc.h; y++) {
      h += '<tr>';
      for (x = 0; x < sc.w; x++) {
        cell = grid[y][x];
        h += '<td width="' + Math.round(sc.cw * z) + '" height="' + Math.round(sc.ch * z) + '" bgcolor="' + cell.f + '" align="center" style="padding:0;font-size:8px;color:' + (cell.tc || '#ffffff') + '">';
        if (cell.s) { h += esc(cell.s); }
        else if (cell.d) { h += '<div style="width:' + (3 * z) + 'px;height:' + (3 * z) + 'px;background:' + cell.d + ';margin:0 auto"></div>'; }
        h += '</td>';
      }
      h += '</tr>';
    }
    return h + '</table>';
  }

  function pic(sc, z, cls) {
    var mode = Q.r || 'svg', out;
    if (z === undefined) { z = zoom(); }
    if (mode === 'tbl') { out = toTable(sc, z); }
    else {
      out = toSvg(sc, z);
      if (mode === 'img') {
        out = '<img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out) + '" width="' + n1(sc.w * sc.cw * z) + '" height="' + n1(sc.h * sc.ch * z) + '" alt="">';
      }
    }
    return cls ? '<span class="' + cls + '">' + out + '</span>' : out;
  }

  /* ---------- links, cookies ---------- */
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
    if (o.r === undefined && Q.r) { o.r = Q.r; }
    if (o.z === undefined && Q.z) { o.z = Q.z; }
    for (k in o) {
      if (o.hasOwnProperty(k) && o[k] !== undefined && o[k] !== null && o[k] !== '') { parts.push(k + '=' + encodeURIComponent(o[k])); }
    }
    return parts.length ? '?' + parts.join('&') : './';
  }
  function lnk(href, label, cls) { return '<a href="' + esc(href) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</a>'; }
  function getC(k) {
    try { var m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
  }
  function setC(k, v) { try { document.cookie = k + '=' + encodeURIComponent(v) + '; max-age=31536000; path=/'; } catch (e) { } }

  /* ---------- shared drawing for "how to play" pictures ---------- */
  function helpArrows(sc, hero, sw, lab, act) {
    var hw = SPR[hero][0].length * 2 / 10, hh = SPR[hero].length * 2 / 10, hx = 6 - hw / 2, hy = 2.5 - hh / 2;
    S(sc, hx, hy, hero, { k: 2, sw: sw });
    if (lab.U) { S(sc, 5.65, hy - 0.95, 'arrow'); T(sc, 7.5, hy - 0.6, lab.U, '#1c3e9c', 8); }
    if (lab.D) { S(sc, 5.65, hy + hh + 0.25, 'arrow', { ro: 2 }); T(sc, 7.5, hy + hh + 0.6, lab.D, '#1c3e9c', 8); }
    if (lab.L) { S(sc, hx - 0.85, 2.15, 'arrow', { ro: 3 }); T(sc, hx - 1.75, 2.5, lab.L, '#1c3e9c', 8); }
    if (lab.R) { S(sc, hx + hw + 0.15, 2.15, 'arrow', { ro: 1 }); T(sc, hx + hw + 1.75, 2.5, lab.R, '#1c3e9c', 8); }
    if (act) { R(sc, 0.2, 3.8, 3.2, 1.05, '#ffd23c'); T(sc, 1.8, 4.32, act, '#101a3a', 8); }
  }

  /* =====================================================================
     GAMES. Each game: init enc dec step draw pad top ev info lives score,
     plus icon(scene 24x24) and help(scene 120x50) and text fields.
     ===================================================================== */
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var DIRS = { U: 0, R: 1, D: 2, L: 3 };
  var PAD4 = [[['U', 'Up']], [['L', 'Left'], ['W', 'Wait', 'a'], ['R', 'Right']], [['D', 'Down']]];

  /* ---------- Chop Chop: maze chase ---------- */
  G.chop = (function () {
    var MAZE = ['############', '#o....#...o#', '#.##.##.##.#', '#..........#', '#.##.  .##.#',
      '#..........#', '#.##.##.##.#', '#o...#....o#', '############'];
    var W = 12, H = 9, START = [6, 7], PEN = [[5, 4], [6, 4], [5, 4]], FOOD = [];
    (function () {
      var x, y, c;
      for (y = 0; y < H; y++) { for (x = 0; x < W; x++) { c = MAZE[y].charAt(x); if (c === '.' || c === 'o') { FOOD.push([x, y, c === 'o' ? 1 : 0]); } } }
    }());
    function wall(x, y) { return x < 0 || y < 0 || x >= W || y >= H || MAZE[y].charAt(x) === '#'; }
    function eatAt(st, x, y) {
      for (var i = 0; i < FOOD.length; i++) {
        if (st.f[i] && FOOD[i][0] === x && FOOD[i][1] === y) {
          st.f[i] = 0;
          if (FOOD[i][2]) { st.fr = 8; st.sc += 5; st.m = 1; } else { st.sc += 1; }
        }
      }
    }
    function reset(st, fresh) {
      var k;
      st.px = START[0]; st.py = START[1]; st.pd = 3; st.fr = 0; st.g = [];
      for (k = 0; k < Math.min(1 + st.lv, 3); k++) { st.g.push([PEN[k][0], PEN[k][1], 0]); }
      if (fresh) { st.f = []; for (k = 0; k < FOOD.length; k++) { st.f.push(FOOD[k][0] === START[0] && FOOD[k][1] === START[1] ? 0 : 1); } }
    }
    function moveGoat(st, k) {
      var g = st.g[k], opts = [], d, best = -1, bestV, v, keep = [], chase;
      for (d = 0; d < 4; d++) { if (!wall(g[0] + DX[d], g[1] + DY[d])) { opts.push(d); } }
      if (opts.length > 1) { each(opts, function (o) { if ((o + 2) % 4 !== g[2]) { keep.push(o); } }); if (keep.length) { opts = keep; } }
      chase = st.fr > 0 ? -1 : (k === 0 ? 1 : (k === 1 ? 0 : (ri(st, 2) ? 1 : 0)));
      if (chase === 0) { best = opts[ri(st, opts.length)]; } else {
        each(opts, function (o) {
          v = Math.abs(g[0] + DX[o] - st.px) + Math.abs(g[1] + DY[o] - st.py);
          v = chase === 1 ? -v : v;
          if (best < 0 || v > bestV) { best = o; bestV = v; }
        });
      }
      g[0] += DX[best]; g[1] += DY[best]; g[2] = best;
    }
    function collide(st, old, ox, oy) {
      var k, g, same, swap;
      for (k = 0; k < st.g.length; k++) {
        g = st.g[k];
        same = g[0] === st.px && g[1] === st.py;
        swap = old && old[k][0] === st.px && old[k][1] === st.py && g[0] === ox && g[1] === oy;
        if (same || swap) {
          if (st.fr > 0) { st.sc += 20; st.m = 2; g[0] = PEN[k][0]; g[1] = PEN[k][1]; g[2] = 0; }
          else { st.lives--; st.m = 3; if (st.lives <= 0) { st.o = 1; st.m = 5; } else { reset(st, false); } return true; }
        }
      }
      return false;
    }
    return {
      name: 'Chop Chop', cat: 'arcade', mins: '3 min', short: 'Eat groundnuts, dodge the goats',
      blurb: 'Eat every groundnut in the market maze before the hungry goats catch you.',
      lines: [['Up, Down, Left, Right', 'move one square'], ['Wait', 'stay still while the goats move'], ['Red pepper', 'goats turn blue: catch them for 20']],
      tip: 'Goats move each time you do, so plan two steps ahead.',
      init: function (sd) { var st = { lives: 3, sc: 0, lv: 1, r: sd, o: 0, m: 0 }; reset(st, true); return st; },
      enc: function (st) {
        return [b36(st.px) + b36(st.py) + st.pd, ptsEnc(st.g), b36(st.fr), st.lives, b36(st.sc), b36(st.lv), b36(st.r), st.o, st.m, bitsEnc(st.f)].join('.');
      },
      dec: function (s) {
        var a = s.split('.');
        return {
          px: p36(a[0].charAt(0)), py: p36(a[0].charAt(1)), pd: num(a[0].charAt(2)), g: pts(a[1], 3), fr: p36(a[2]), lives: num(a[3]),
          sc: p36(a[4]), lv: p36(a[5]), r: p36(a[6]), o: num(a[7]), m: num(a[8]), f: bitsDec(a[9], FOOD.length)
        };
      },
      step: function (st, a) {
        var ox = st.px, oy = st.py, d = DIRS[a], old = [], k, left = 0;
        st.m = 0;
        if (d !== undefined) { st.pd = d; if (!wall(st.px + DX[d], st.py + DY[d])) { st.px += DX[d]; st.py += DY[d]; } }
        eatAt(st, st.px, st.py);
        if (collide(st, null)) { return; }
        for (k = 0; k < st.g.length; k++) { old.push([st.g[k][0], st.g[k][1]]); moveGoat(st, k); }
        if (collide(st, old, ox, oy)) { return; }
        if (st.fr > 0) { st.fr--; }
        for (k = 0; k < st.f.length; k++) { left += st.f[k]; }
        if (!left) { st.lv++; st.sc += 50; reset(st, true); st.m = 4; }
      },
      draw: function (st) {
        var sc = scene(W, H, 10, 10, '#101a3a'), x, y, i;
        for (y = 0; y < H; y++) {
          for (x = 0; x < W; x++) {
            if (MAZE[y].charAt(x) === '#') { R(sc, x, y, 1, 1, '#22a6a0'); }
          }
        }
        for (y = 0; y < H; y++) { for (x = 0; x < W; x++) { if (MAZE[y].charAt(x) === '#') { R(sc, x + 0.15, y + 0.15, 0.85, 0.85, '#126a66'); } } }
        for (i = 0; i < FOOD.length; i++) { if (st.f[i]) { S(sc, FOOD[i][0], FOOD[i][1], FOOD[i][2] ? 'chop_pep' : 'chop_nut'); } }
        each(st.g, function (g) { S(sc, g[0], g[1], 'chop_goat', { sw: st.fr > 0 ? 'w=c' : '' }); });
        S(sc, st.px, st.py, 'chop_hero', { fx: st.pd === 3 });
        return sc;
      },
      icon: function (sc) { R(sc, 0, 0, 1, 0.17, '#22a6a0'); R(sc, 0, 0.83, 1, 0.17, '#22a6a0'); S(sc, 0.08, 0.08, 'chop_hero', { k: 2 }); },
      help: function (sc) { helpArrows(sc, 'chop_hero', '', { U: 'Up', D: 'Down', L: 'Left', R: 'Right' }, 'Wait'); S(sc, 10.2, 0.4, 'chop_goat'); S(sc, 10.2, 3.6, 'chop_pep'); },
      pad: function () { return PAD4; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Pepper! Chase the goats', 'Goat caught! +20', 'Caught by a goat!', 'Market cleared! +50', 'No lives left'][st.m]; },
      info: function (st) { return 'Level ' + st.lv + (st.fr ? ' &middot; Goats scared for ' + st.fr : ''); },
      lives: function (st) { return [st.lives, 3]; },
      score: function (st) { return st.sc; }
    };
  }());

  /* ---------- Harmattan Skies: step shooter ---------- */
  G.harm = (function () {
    var W = 8, STARS = [[0.5, 1.2], [2.3, 4.6], [4.7, 2.1], [6.6, 5.4], [7.4, 0.6], [3.4, 6.8], [1.2, 7.3], [5.8, 7.9], [6.1, 3.3], [1.7, 2.8]];
    var ROWC = ['m', 'b', 'y'];
    function fleet(st, rows) {
      st.fl = [];
      for (var i = 0; i < 18; i++) { st.fl.push(Math.floor(i / 6) < rows ? 1 : 0); }
      st.fx = 1; st.fy = 0; st.fd = 0; st.b = [];
    }
    function range(st) {
      var mn = 9, mx = -1, lo = -1, i;
      for (i = 0; i < 18; i++) {
        if (st.fl[i]) { if (i % 6 < mn) { mn = i % 6; } if (i % 6 > mx) { mx = i % 6; } if (Math.floor(i / 6) > lo) { lo = Math.floor(i / 6); } }
      }
      return [mn, mx, lo];
    }
    function hitPlayer(st) { st.lives--; st.b = []; st.m = 3; if (st.lives <= 0) { st.o = 1; st.m = 5; } }
    return {
      name: 'Harmattan Skies', cat: 'arcade', mins: '3 min', short: 'Blast the alien drones',
      blurb: 'Defend the savanna. Clear each wave of alien drones before they land.',
      lines: [['Left, Right', 'move one column'], ['Fire', 'hit the lowest drone above you'], ['Bombs', 'move out from under them']],
      tip: 'Top-row drones score 30, so clear a column from the bottom up.',
      init: function (sd) { var st = { px: 3, lives: 3, sc: 0, wv: 1, t: 0, r: sd, o: 0, m: 0 }; fleet(st, 2); return st; },
      enc: function (st) {
        return [bitsEnc(st.fl), b36(st.fx + 6) + b36(st.fy) + st.fd + b36(st.px), ptsEnc(st.b), st.lives, b36(st.sc), b36(st.wv), b36(st.t % 36), b36(st.r), st.o, st.m].join('.');
      },
      dec: function (s) {
        var a = s.split('.');
        return {
          fl: bitsDec(a[0], 18), fx: p36(a[1].charAt(0)) - 6, fy: p36(a[1].charAt(1)), fd: num(a[1].charAt(2)), px: p36(a[1].charAt(3)),
          b: pts(a[2], 2), lives: num(a[3]), sc: p36(a[4]), wv: p36(a[5]), t: p36(a[6]), r: p36(a[7]), o: num(a[8]), m: num(a[9])
        };
      },
      step: function (st, a) {
        var c, rr, hit, nb = [], rg, nx, alive = [], i;
        st.m = 0;
        if (a === 'L' && st.px > 0) { st.px--; }
        else if (a === 'R' && st.px < W - 1) { st.px++; }
        else if (a === 'F') {
          c = st.px - st.fx; hit = false;
          if (c >= 0 && c < 6) { for (rr = 2; rr >= 0; rr--) { if (st.fl[rr * 6 + c]) { st.fl[rr * 6 + c] = 0; st.sc += (3 - rr) * 10; hit = true; break; } } }
          st.m = hit ? 1 : 2;
        }
        each(st.b, function (b) { b[1]++; if (b[1] <= 8) { nb.push(b); } });
        st.b = nb;
        for (i = 0; i < st.b.length; i++) { if (st.b[i][1] === 8 && st.b[i][0] === st.px) { hitPlayer(st); return; } }
        nb = [];
        each(st.b, function (b) { if (b[1] < 8) { nb.push(b); } });
        st.b = nb;
        rg = range(st);
        if (rg[2] < 0) { st.wv++; st.sc += 50; fleet(st, 3); st.m = 4; return; }
        if (st.t % (st.wv >= 3 ? 1 : 2) === 0) {
          nx = st.fx + (st.fd ? -1 : 1);
          if (nx + rg[0] < 0 || nx + rg[1] > W - 1) { st.fy++; st.fd = 1 - st.fd; } else { st.fx = nx; }
        }
        st.t++;
        if (st.fy + rg[2] >= 7) { st.o = 1; st.m = 6; return; }
        if (st.b.length < 3 && ri(st, 100) < 20 + 8 * st.wv) {
          for (i = 0; i < 6; i++) { if (st.fl[i] || st.fl[6 + i] || st.fl[12 + i]) { alive.push(i); } }
          c = alive[ri(st, alive.length)];
          for (rr = 2; rr >= 0; rr--) { if (st.fl[rr * 6 + c]) { break; } }
          st.b.push([st.fx + c, st.fy + rr + 1]);
        }
      },
      draw: function (st) {
        var sc = scene(W, 9, 15, 10, '#101a3a'), i;
        each(STARS, function (s, k) { R(sc, s[0], s[1], 0.07, 0.1, k % 3 ? '#9aa0a8' : '#ffffff'); });
        R(sc, 0, 8.75, 8, 0.25, '#d9b77a');
        for (i = 0; i < 18; i++) { if (st.fl[i]) { S(sc, st.fx + i % 6, st.fy + Math.floor(i / 6), 'harm_drone', { sw: 'X=' + ROWC[Math.floor(i / 6)] }); } }
        each(st.b, function (b) { S(sc, b[0], b[1], 'harm_bomb'); });
        S(sc, st.px, 8, 'harm_ship');
        return sc;
      },
      icon: function (sc) { S(sc, 0.04, 0.05, 'harm_drone', { sw: 'X=m' }); S(sc, 0.18, 0.55, 'harm_ship'); },
      help: function (sc) {
        S(sc, 2.5, 0.1, 'harm_drone', { sw: 'X=m' }); S(sc, 4.0, 0.1, 'harm_drone', { sw: 'X=b' }); S(sc, 5.5, 0.1, 'harm_drone', { sw: 'X=y' });
        S(sc, 4.0, 1.4, 'harm_bomb'); S(sc, 4.0, 3.0, 'harm_ship');
        S(sc, 3.0, 3.15, 'arrow', { ro: 3 }); T(sc, 1.6, 3.5, 'Left', '#1c3e9c', 8);
        S(sc, 5.7, 3.15, 'arrow', { ro: 1 }); T(sc, 7.6, 3.5, 'Right', '#1c3e9c', 8);
        R(sc, 8.8, 1.2, 3, 1.1, '#ffd23c'); T(sc, 10.3, 1.75, 'Fire', '#101a3a', 8);
      },
      pad: function () { return [[['L', 'Left'], ['F', 'Fire', 'a'], ['R', 'Right']]]; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Hit!', 'Missed', 'Hit by a bomb!', 'Wave cleared! +50', 'No lives left', 'The drones landed'][st.m]; },
      info: function (st) { return 'Wave ' + st.wv; },
      lives: function (st) { return [st.lives, 3]; },
      score: function (st) { return st.sc; }
    };
  }());

  /* ---------- Road Crossa: road crossing ---------- */
  G.road = (function () {
    var W = 8, LANES = [1, 2, 3, 5, 6, 7], LCOL = ['y', 'r', 'b', 'o', 'y', 'r'];
    var T1 = ['11000000', '11100000', '10010000', '11000100'];
    var T2 = ['11011000', '11100110', '11001100', '10101000', '11100100'];
    var T3 = ['11101100', '11011010', '11110110', '11101010'];
    function laneIdx(y) { for (var i = 0; i < LANES.length; i++) { if (LANES[i] === y) { return i; } } return -1; }
    function gen(st) {
      var set = st.lv >= 4 ? T3 : (st.lv >= 2 ? T2 : T1), i, t, rot;
      st.k = [];
      for (i = 0; i < 6; i++) { t = set[ri(st, set.length)]; rot = ri(st, 8); st.k.push(parseInt(t.substr(rot) + t.substr(0, rot), 2)); }
    }
    function occ(st, x, y) {
      var li = laneIdx(y), dir, idx;
      if (li < 0) { return false; }
      dir = li % 2 ? -1 : 1;
      idx = (((x - dir * st.t) % 8) + 8) % 8;
      return ((st.k[li] >> idx) & 1) === 1;
    }
    function splat(st) { st.lives--; st.px = 3; st.py = 8; st.m = 2; if (st.lives <= 0) { st.o = 1; st.m = 4; } }
    return {
      name: 'Road Crossa', cat: 'arcade', mins: '2 min', short: 'Help the chicken cross',
      blurb: 'Rush hour! Get the chicken across six lanes of buses and cars, five times.',
      lines: [['Up', 'step forward'], ['Down, Left, Right', 'step back or sideways'], ['Wait', 'let the traffic pass']],
      tip: 'Each lane moves one way. Watch a lane before you step in.',
      init: function (sd) { var st = { px: 3, py: 8, t: 0, cr: 0, lives: 3, sc: 0, lv: 1, r: sd, o: 0, m: 0 }; gen(st); return st; },
      enc: function (st) {
        var ks = '', i, h;
        for (i = 0; i < 6; i++) { h = st.k[i].toString(16); ks += h.length < 2 ? '0' + h : h; }
        return [b36(st.px) + b36(st.py) + st.t + st.cr, ks, st.lives, b36(st.sc), b36(st.lv), b36(st.r), st.o, st.m].join('.');
      },
      dec: function (s) {
        var a = s.split('.'), k = [], i;
        for (i = 0; i < 6; i++) { k.push(parseInt(a[1].substr(i * 2, 2), 16) || 0); }
        return {
          px: p36(a[0].charAt(0)), py: p36(a[0].charAt(1)), t: num(a[0].charAt(2)), cr: num(a[0].charAt(3)), k: k,
          lives: num(a[2]), sc: p36(a[3]), lv: p36(a[4]), r: p36(a[5]), o: num(a[6]), m: num(a[7])
        };
      },
      step: function (st, a) {
        st.m = 0;
        if (a === 'U' && st.py > 0) { st.py--; }
        else if (a === 'D' && st.py < 8) { st.py++; }
        else if (a === 'L' && st.px > 0) { st.px--; }
        else if (a === 'R' && st.px < W - 1) { st.px++; }
        if (occ(st, st.px, st.py)) { splat(st); return; }
        st.t = (st.t + 1) % 8;
        if (occ(st, st.px, st.py)) { splat(st); return; }
        if (st.py === 0) {
          st.cr++; st.sc += 10 * st.lv; st.px = 3; st.py = 8;
          if (st.cr >= 5) { st.lv++; st.cr = 0; st.sc += 50; gen(st); st.m = 3; } else { st.m = 1; }
        }
      },
      draw: function (st) {
        var sc = scene(W, 9, 15, 10, '#1e8a3c'), i, x, y;
        for (x = 0; x < 16; x++) { R(sc, x * 0.5, 0, 0.5, 0.5, x % 2 ? '#141414' : '#ffffff'); R(sc, x * 0.5, 0.5, 0.5, 0.5, x % 2 ? '#ffffff' : '#141414'); }
        R(sc, 0, 4, 8, 1, '#5fd35a');
        each([[0.6, 4.4], [3.2, 4.6], [6.3, 4.3]], function (f) { R(sc, f[0], f[1], 0.12, 0.2, '#ffd23c'); });
        for (i = 0; i < 6; i++) {
          y = LANES[i];
          R(sc, 0, y, 8, 1, '#4a4f58');
          for (x = 0; x < 8; x++) {
            if (occ(st, x, y)) { S(sc, x, y, 'road_car', { fx: i % 2 === 1, sw: 'X=' + LCOL[i] }); }
            else if (x % 2 === 0) { R(sc, x + 0.3, y + 0.92, 0.4, 0.08, '#9aa0a8'); }
          }
        }
        S(sc, st.px, st.py, 'road_chick');
        return sc;
      },
      icon: function (sc) { R(sc, 0, 0, 1, 0.55, '#4a4f58'); R(sc, 0, 0.55, 1, 0.45, '#1e8a3c'); S(sc, 0.0, 0.08, 'road_car', { sw: 'X=y' }); S(sc, 0.2, 0.55, 'road_chick'); },
      help: function (sc) {
        R(sc, 0, 0, 12, 1.3, '#4a4f58'); S(sc, 8.5, 0.15, 'road_car', { sw: 'X=r' }); S(sc, 0.4, 0.15, 'road_car', { sw: 'X=b' });
        helpArrows(sc, 'road_chick', '', { U: 'Up', D: 'Down', L: 'Left', R: 'Right' }, 'Wait');
      },
      pad: function () { return PAD4; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Safe! Go again', 'Splat!', 'Level up! +50', 'No lives left'][st.m]; },
      info: function (st) { return 'Crossed ' + st.cr + ' of 5 &middot; Level ' + st.lv; },
      lives: function (st) { return [st.lives, 3]; },
      score: function (st) { return st.sc; }
    };
  }());

  /* ---------- Coconut Climb: ladder climber ---------- */
  G.coco = (function () {
    var W = 12, FLOORS = [8, 6, 4, 2], LAD = [[9, 6], [2, 4], [8, 2]], GOAL = [3, 2], SPAWN = [2, 2];
    function isFloor(y) { return y === 8 || y === 6 || y === 4 || y === 2; }
    function ladder(x, top) { for (var i = 0; i < LAD.length; i++) { if (LAD[i][0] === x && LAD[i][1] === top) { return true; } } return false; }
    function hitAt(st, x, y) { for (var i = 0; i < st.c.length; i++) { if (st.c[i][0] === x && st.c[i][1] === y) { return true; } } return false; }
    function home(st) { st.px = 0; st.py = 8; st.fd = 1; st.c = []; st.t = 0; }
    function ouch(st) { st.lives--; st.m = 2; home(st); if (st.lives <= 0) { st.o = 1; st.m = 4; } }
    return {
      name: 'Coconut Climb', cat: 'arcade', mins: '3 min', short: 'Climb up, jump the coconuts',
      blurb: 'The hornbill stole your football! Climb the palm-wood scaffold and win it back.',
      lines: [['Left, Right', 'walk'], ['Up, Down', 'climb a ladder'], ['Jump', 'leap two squares over a coconut']],
      tip: 'Ladders are safe: coconuts only roll along the planks.',
      init: function (sd) { var st = { lives: 3, sc: 0, lv: 1, r: sd, o: 0, m: 0 }; home(st); return st; },
      enc: function (st) {
        var cs = '';
        each(st.c, function (c) { cs += b36(c[0]) + b36(c[1]) + (c[2] > 0 ? 1 : 0); });
        return [b36(st.px) + b36(st.py) + (st.fd > 0 ? 1 : 0), cs, st.lives, b36(st.sc), b36(st.lv), b36(st.t), b36(st.r), st.o, st.m].join('.');
      },
      dec: function (s) {
        var a = s.split('.'), c = pts(a[1], 3);
        each(c, function (q) { q[2] = q[2] ? 1 : -1; });
        return {
          px: p36(a[0].charAt(0)), py: p36(a[0].charAt(1)), fd: a[0].charAt(2) === '1' ? 1 : -1, c: c,
          lives: num(a[2]), sc: p36(a[3]), lv: p36(a[4]), t: p36(a[5]), r: p36(a[6]), o: num(a[7]), m: num(a[8])
        };
      },
      step: function (st, a) {
        var ox = st.px, oy = st.py, nx, old = [], keep = [], i, every;
        st.m = 0;
        if ((a === 'L' || a === 'R') && isFloor(st.py)) {
          st.fd = a === 'L' ? -1 : 1; nx = st.px + st.fd;
          if (nx >= 0 && nx < W) { st.px = nx; }
        } else if (a === 'U') {
          if (isFloor(st.py) && ladder(st.px, st.py - 2)) { st.py--; } else if (!isFloor(st.py)) { st.py--; }
        } else if (a === 'D') {
          if (isFloor(st.py) && st.py < 8 && ladder(st.px, st.py)) { st.py++; } else if (!isFloor(st.py)) { st.py++; }
        } else if (a === 'J' && isFloor(st.py)) {
          nx = st.px + 2 * st.fd;
          if (nx >= 0 && nx < W) { if (hitAt(st, st.px + st.fd, st.py)) { st.sc += 5; st.m = 1; } st.px = nx; }
        }
        if (hitAt(st, st.px, st.py)) { ouch(st); return; }
        if (st.px === GOAL[0] && st.py === GOAL[1]) { st.sc += 50 * st.lv; st.lv++; st.m = 3; home(st); return; }
        each(st.c, function (c) {
          old.push([c[0], c[1]]);
          nx = c[0] + c[2];
          if (nx < 0 || nx >= W) { c[1] += 2; c[2] = -c[2]; } else { c[0] = nx; }
        });
        for (i = 0; i < st.c.length; i++) { if (st.c[i][1] <= 8) { keep.push(st.c[i]); } else { old.splice(keep.length, 1); } }
        st.c = keep;
        st.t = (st.t + 1) % 36;
        every = Math.max(2, 5 - st.lv);
        if (st.t % every === 0 && st.c.length < 5) { st.c.push([SPAWN[0], SPAWN[1], 1]); old.push([-1, -1]); }
        for (i = 0; i < st.c.length; i++) {
          if ((st.c[i][0] === st.px && st.c[i][1] === st.py) || (old[i][0] === st.px && old[i][1] === st.py && st.c[i][0] === ox && st.c[i][1] === oy)) { ouch(st); return; }
        }
      },
      draw: function (st) {
        var sc = scene(W, 9, 10, 10, '#8fd8ff'), y;
        C(sc, 11.2, 0.8, 0.55, '#ffd23c');
        R(sc, 5.2, 0.5, 1.6, 0.35, '#ffffff'); R(sc, 5.5, 0.3, 0.9, 0.3, '#ffffff');
        R(sc, 8.0, 1.1, 1.3, 0.3, '#ffffff');
        each(FLOORS, function (f) { R(sc, 0, f + 0.8, 12, 0.2, '#8a5a2e'); R(sc, 0, f + 0.95, 12, 0.05, '#55361a'); });
        each(LAD, function (l) {
          R(sc, l[0] + 0.15, l[1] + 0.8, 0.12, 2.1, '#55361a'); R(sc, l[0] + 0.73, l[1] + 0.8, 0.12, 2.1, '#55361a');
          for (y = l[1] + 1.1; y < l[1] + 2.8; y += 0.45) { R(sc, l[0] + 0.15, y, 0.7, 0.1, '#55361a'); }
        });
        S(sc, 0, 1.2, 'coco_bird');
        S(sc, GOAL[0], GOAL[1], 'coco_ball');
        each(st.c, function (c) { S(sc, c[0], c[1], 'coco_nut'); });
        S(sc, st.px, st.py, 'coco_hero', { fx: st.fd < 0 });
        return sc;
      },
      icon: function (sc) { R(sc, 0, 0.8, 1, 0.2, '#8a5a2e'); S(sc, 0.08, 0.0, 'coco_nut', { k: 2 }); },
      help: function (sc) {
        R(sc, 0, 4.85, 12, 0.15, '#8a5a2e'); S(sc, 10.3, 3.0, 'coco_nut');
        helpArrows(sc, 'coco_hero', '', { U: 'Up', D: 'Down', L: 'Left', R: 'Right' }, 'Jump');
      },
      pad: function () { return [[['U', 'Up']], [['L', 'Left'], ['J', 'Jump', 'a'], ['R', 'Right']], [['D', 'Down']]]; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Nice jump! +5', 'Bonk! A coconut got you', 'Football back! Next level', 'No lives left'][st.m]; },
      info: function (st) { return 'Level ' + st.lv; },
      lives: function (st) { return [st.lives, 3]; },
      score: function (st) { return st.sc; }
    };
  }());

  /* ---------- Mamba Munch: snake ---------- */
  G.mamba = (function () {
    var W = 12, H = 9, TUFTS = [[1.2, 1.4], [8.4, 2.2], [3.6, 6.3], [10.2, 7.1], [6.5, 4.6], [2.1, 3.8]];
    function onBody(st, x, y, upto) { for (var i = 0; i < upto; i++) { if (st.b[i][0] === x && st.b[i][1] === y) { return true; } } return false; }
    function egg(st) {
      var free = [], x, y;
      for (y = 0; y < H; y++) { for (x = 0; x < W; x++) { if (!onBody(st, x, y, st.b.length)) { free.push([x, y]); } } }
      if (!free.length) { st.e = [35, 35]; st.o = 1; st.m = 4; return; }
      st.e = free[ri(st, free.length)];
    }
    return {
      name: 'Mamba Munch', cat: 'arcade', mins: '3 min', short: 'Grow the snake, eat the eggs',
      blurb: 'Steer the hungry mamba to every egg. It only moves when you press, so think ahead.',
      lines: [['Up, Down, Left, Right', 'turn and move one square'], ['Go', 'keep going straight'], ['Walls and tail', 'touch them and it is over']],
      tip: 'Before you eat an egg, make sure there is a way out.',
      init: function (sd) { var st = { b: [[5, 4], [4, 4], [3, 4]], d: 1, sc: 0, r: sd, o: 0, m: 0 }; egg(st); return st; },
      enc: function (st) {
        var s = b36(st.b[0][0]) + b36(st.b[0][1]), i, k;
        for (i = 1; i < st.b.length; i++) {
          for (k = 0; k < 4; k++) { if (st.b[i - 1][0] + DX[k] === st.b[i][0] && st.b[i - 1][1] + DY[k] === st.b[i][1]) { s += k; break; } }
        }
        return [s, st.d, b36(st.e[0]) + b36(st.e[1]), b36(st.sc), b36(st.r), st.o, st.m].join('.');
      },
      dec: function (s) {
        var a = s.split('.'), b = [[p36(a[0].charAt(0)), p36(a[0].charAt(1))]], i, k, prev;
        for (i = 2; i < a[0].length; i++) { k = num(a[0].charAt(i)); prev = b[b.length - 1]; b.push([prev[0] + DX[k], prev[1] + DY[k]]); }
        return { b: b, d: num(a[1]), e: [p36(a[2].charAt(0)), p36(a[2].charAt(1))], sc: p36(a[3]), r: p36(a[4]), o: num(a[5]), m: num(a[6]) };
      },
      step: function (st, a) {
        var nd = st.d, h, nx, ny, grow;
        st.m = 0;
        if (DIRS[a] !== undefined) { nd = DIRS[a]; }
        if ((nd + 2) % 4 === st.d) { nd = st.d; }
        st.d = nd;
        h = st.b[0]; nx = h[0] + DX[nd]; ny = h[1] + DY[nd];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) { st.o = 1; st.m = 2; return; }
        grow = st.e[0] === nx && st.e[1] === ny;
        if (onBody(st, nx, ny, grow ? st.b.length : st.b.length - 1)) { st.o = 1; st.m = 3; return; }
        st.b.unshift([nx, ny]);
        if (grow) { st.sc++; st.m = 1; egg(st); } else { st.b.pop(); }
      },
      draw: function (st) {
        var sc = scene(W, H, 10, 10, '#f4dca6'), i, h = st.b[0], o = {};
        each(TUFTS, function (t) { R(sc, t[0], t[1], 0.1, 0.25, '#c99a12'); R(sc, t[0] + 0.2, t[1] + 0.05, 0.1, 0.2, '#c99a12'); });
        R(sc, 0, 0, 12, 0.08, '#55361a'); R(sc, 0, 8.92, 12, 0.08, '#55361a'); R(sc, 0, 0, 0.08, 9, '#55361a'); R(sc, 11.92, 0, 0.08, 9, '#55361a');
        if (st.e[0] < W) { S(sc, st.e[0], st.e[1], 'mam_egg'); }
        for (i = st.b.length - 1; i > 0; i--) { S(sc, st.b[i][0], st.b[i][1], 'mam_body'); }
        if (st.d === 3) { o.fx = true; } else if (st.d === 0) { o.ro = 3; } else if (st.d === 2) { o.ro = 1; }
        S(sc, h[0], h[1], 'mam_head', o);
        return sc;
      },
      icon: function (sc) { S(sc, 0.08, 0.08, 'mam_head', { k: 2 }); },
      help: function (sc) { helpArrows(sc, 'mam_head', '', { U: 'Up', D: 'Down', L: 'Left', R: 'Right' }, 'Go'); S(sc, 10.4, 0.3, 'mam_egg'); },
      pad: function () { return [[['U', 'Up']], [['L', 'Left'], ['S', 'Go', 'a'], ['R', 'Right']], [['D', 'Down']]]; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Yum! +1', 'Ouch, the wall!', 'You bit your tail!', 'You filled the field!'][st.m]; },
      info: function (st) { return 'Length ' + st.b.length; },
      lives: function () { return null; },
      score: function (st) { return st.sc; }
    };
  }());

  /* ---------- Penalty King: shoot-out ---------- */
  G.pen = (function () {
    var ZX = 1.3, ZY = 1.3, ZW = 9.4 / 3, ZH = 4.7 / 3;
    var CROWD = ['#e03c32', '#ffd23c', '#3a8ef0', '#ffffff', '#5fd35a', '#ff7fb0'];
    function zoneCentre(z) { var c = (z - 1) % 3, r = Math.floor((z - 1) / 3); return [ZX + c * ZW + ZW / 2, ZY + r * ZH + ZH / 2]; }
    function checkEnd(st) {
      var yk = Math.ceil(st.k / 2), ck = Math.floor(st.k / 2);
      if (st.k < 10) { if (st.ys > st.cs + (5 - ck) || st.cs > st.ys + (5 - yk)) { st.o = 1; } }
      else if (st.k % 2 === 0 && st.ys !== st.cs) { st.o = 1; }
    }
    return {
      name: 'Penalty King', cat: 'sports', mins: '2 min', short: 'Win the penalty shoot-out',
      blurb: 'Five kicks each to decide the cup. Score your penalties, then save theirs.',
      lines: [['1 to 9', 'pick where to shoot'], ['Left, Mid, Right', 'pick where to dive'], ['Top row', 'hard to save, but can fly over']],
      tip: 'The keeper guards one column. Mix up your shots.',
      init: function (sd) { return { k: 0, ys: 0, cs: 0, ls: 0, lk: 1, lw: 0, r: sd, o: 0 }; },
      enc: function (st) { return [b36(st.k), b36(st.ys) + '-' + b36(st.cs), st.ls + '' + st.lk + st.lw, b36(st.r), st.o].join('.'); },
      dec: function (s) {
        var a = s.split('.'), g = a[1].split('-');
        return { k: p36(a[0]), ys: p36(g[0]), cs: p36(g[1]), ls: num(a[2].charAt(0)), lk: num(a[2].charAt(1)), lw: num(a[2].charAt(2)), r: p36(a[3]), o: num(a[4]) };
      },
      step: function (st, a) {
        var z, col, row, miss, d;
        if (st.k % 2 === 0) {
          z = num(a); if (z < 1 || z > 9) { return; }
          col = (z - 1) % 3; row = Math.floor((z - 1) / 3); d = ri(st, 3);
          miss = row === 0 && ri(st, 100) < 25;
          st.lw = miss ? 3 : (d === col ? 2 : 1);
          if (st.lw === 1) { st.ys++; }
        } else {
          if (a.charAt(0) !== 'k') { return; }
          d = num(a.charAt(1)); z = 1 + ri(st, 9); col = (z - 1) % 3; row = Math.floor((z - 1) / 3);
          miss = row === 0 && ri(st, 100) < 25;
          st.lw = miss ? 6 : (d === col ? 5 : 4);
          if (st.lw === 4) { st.cs++; }
        }
        st.ls = z; st.lk = d; st.k++;
        checkEnd(st);
      },
      draw: function (st) {
        var sc = scene(12, 8, 10, 10, '#8fd8ff'), x, y, i, kx, b, you = st.lw >= 4;
        R(sc, 0, 0, 12, 0.85, '#5a2a8a');
        for (i = 0; i < 24; i++) { C(sc, 0.25 + i * 0.5, 0.35 + (i % 2) * 0.2, 0.17, CROWD[i % 6]); }
        R(sc, 0, 6, 12, 2, '#1e8a3c'); R(sc, 0, 7, 12, 1, '#2fa04a');
        for (x = 1.3; x < 10.7; x += 1.2) { R(sc, x, 1.3, 0.05, 4.7, '#d6e6f2'); }
        for (y = 1.3; y < 6; y += 1) { R(sc, 1.3, y, 9.4, 0.05, '#d6e6f2'); }
        R(sc, 1, 1, 0.3, 5, '#ffffff'); R(sc, 10.7, 1, 0.3, 5, '#ffffff'); R(sc, 1, 1, 10, 0.3, '#ffffff');
        if (st.k % 2 === 0 && !st.o) { for (i = 1; i <= 9; i++) { b = zoneCentre(i); T(sc, b[0], b[1], i, '#1c3e9c', 10); } }
        kx = ZX + st.lk * ZW + ZW / 2;
        S(sc, kx - 0.7, 4.4, 'pen_keeper', { sw: 'X=' + (you ? 'r' : 'y') });
        if (st.ls) {
          b = zoneCentre(st.ls);
          if (st.lw === 3 || st.lw === 6) { b = [b[0], 0.55]; } else if (st.lw === 2 || st.lw === 5) { b = [kx + 0.9, 4.9]; }
          S(sc, b[0] - 0.35, b[1] - 0.35, 'pen_ball');
        } else { S(sc, 5.65, 6.9, 'pen_ball'); }
        return sc;
      },
      icon: function (sc) { R(sc, 0.12, 0.15, 0.08, 0.6, '#ffffff'); R(sc, 0.8, 0.15, 0.08, 0.6, '#ffffff'); R(sc, 0.12, 0.15, 0.76, 0.08, '#ffffff'); S(sc, 0.35, 0.55, 'pen_ball'); },
      help: function (sc) {
        var i, c, r;
        R(sc, 0.5, 0.3, 4.6, 0.2, '#9aa0a8'); R(sc, 0.5, 0.3, 0.2, 4.4, '#9aa0a8'); R(sc, 4.9, 0.3, 0.2, 4.4, '#9aa0a8');
        for (i = 0; i < 9; i++) { c = i % 3; r = Math.floor(i / 3); T(sc, 1.4 + c * 1.4, 1.2 + r * 1.3, i + 1, '#1c3e9c', 9); }
        S(sc, 6.4, 1.6, 'pen_ball');
        R(sc, 7.4, 0.5, 4.4, 1.1, '#ffd23c'); T(sc, 9.6, 1.05, 'Shoot: 1-9', '#101a3a', 8);
        R(sc, 7.4, 2.8, 4.4, 1.1, '#3a8ef0'); T(sc, 9.6, 3.35, 'Save: dive', '#ffffff', 8);
      },
      pad: function (st) {
        if (st.k % 2 === 0) { return [[['1', '1'], ['2', '2'], ['3', '3']], [['4', '4'], ['5', '5'], ['6', '6']], [['7', '7'], ['8', '8'], ['9', '9']]]; }
        return [[['k0', 'Left'], ['k1', 'Mid', 'a'], ['k2', 'Right']]];
      },
      top: function (st) { return 'You ' + st.ys + ' - ' + st.cs + ' CPU'; },
      ev: function (st) { return ['', 'GOAL!', 'Saved by the keeper', 'Over the bar!', 'They scored', 'You saved it!', 'They missed!'][st.lw]; },
      info: function (st) {
        if (st.o) { return st.ys > st.cs ? 'You win the shoot-out!' : 'The computer wins the shoot-out'; }
        return st.k % 2 === 0 ? 'Your shot: pick a zone' : 'Your save: pick a dive';
      },
      lives: function () { return null; },
      score: function (st) { return st.ys; }
    };
  }());

  /* ---------- Oware: mancala against the computer ---------- */
  G.oware = (function () {
    var AL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM';
    function own(s, i) { return s === 0 ? i < 6 : i >= 6; }
    function sideSum(p, s) { var t = 0, i; for (i = s * 6; i < s * 6 + 6; i++) { t += p[i]; } return t; }
    function sow(p, i) { var n = p[i], j = i; p[i] = 0; while (n > 0) { j = (j + 1) % 12; if (j !== i) { p[j]++; n--; } } return j; }
    function play(p, i, s) {
      var q = p.slice(), j = sow(q, i), tmp = q.slice(), cap = 0, k = j, x;
      while (own(1 - s, k) && (tmp[k] === 2 || tmp[k] === 3)) { cap += tmp[k]; tmp[k] = 0; k = (k + 11) % 12; }
      if (cap > 0 && sideSum(tmp, 1 - s) === 0) { cap = 0; tmp = q; }
      for (x = 0; x < 12; x++) { p[x] = tmp[x]; }
      return cap;
    }
    function legal(p, s) {
      var res = [], empty = sideSum(p, 1 - s) === 0, i, q;
      for (i = s * 6; i < s * 6 + 6; i++) {
        if (!p[i]) { continue; }
        if (empty) { q = p.slice(); sow(q, i); if (sideSum(q, 1 - s) === 0) { continue; } }
        res.push(i);
      }
      return res;
    }
    function finish(st) { st.o = 1; st.m = st.ys > st.cs ? 1 : (st.ys < st.cs ? 2 : 3); }
    function ended(st, side) {
      if (st.ys > 24 || st.cs > 24 || (st.ys === 24 && st.cs === 24)) { finish(st); return true; }
      if (!legal(st.p, side).length || st.n > 200) {
        st.ys += sideSum(st.p, 0); st.cs += sideSum(st.p, 1);
        for (var i = 0; i < 12; i++) { st.p[i] = 0; }
        finish(st); return true;
      }
      return false;
    }
    function cpuMove(st) {
      var best = -1, bestV = -999;
      each(legal(st.p, 1), function (mv) {
        var q = st.p.slice(), c = play(q, mv, 1), reply = 0, v;
        each(legal(q, 0), function (r) { var w = play(q.slice(), r, 0); if (w > reply) { reply = w; } });
        v = c * 10 - reply * 9 + ri(st, 3);
        if (v > bestV) { bestV = v; best = mv; }
      });
      return best;
    }
    return {
      name: 'Oware', cat: 'board', mins: '6 min', short: 'Ghana\'s classic seed game',
      blurb: 'The sowing game played across West Africa. Capture 25 of the 48 seeds to win.',
      lines: [['1 to 6', 'pick one of your pits (bottom row)'], ['Sowing', 'seeds go one per pit, anticlockwise'], ['Capture', 'end on 2 or 3 seeds in the top row']],
      tip: 'A pit with 12 or more seeds goes all the way round the board.',
      init: function (sd) { return { p: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], ys: 0, cs: 0, lp: 12, lc: 12, c1: 0, c2: 0, n: 0, r: sd, o: 0, m: 0 }; },
      enc: function (st) {
        var s = '', i;
        for (i = 0; i < 12; i++) { s += AL.charAt(st.p[i]); }
        return [s, b36(st.ys) + '-' + b36(st.cs), b36(st.lp) + b36(st.lc), b36(st.c1) + '-' + b36(st.c2), b36(st.n), b36(st.r), st.o, st.m].join('.');
      },
      dec: function (s) {
        var a = s.split('.'), p = [], i, y = a[1].split('-'), c = a[3].split('-');
        for (i = 0; i < 12; i++) { p.push(Math.max(0, AL.indexOf(a[0].charAt(i)))); }
        return { p: p, ys: p36(y[0]), cs: p36(y[1]), lp: p36(a[2].charAt(0)), lc: p36(a[2].charAt(1)), c1: p36(c[0]), c2: p36(c[1] || '0'), n: p36(a[4]), r: p36(a[5]), o: num(a[6]), m: num(a[7]) };
      },
      step: function (st, a) {
        var i = num(a), ok = false, mv;
        each(legal(st.p, 0), function (l) { if (l === i) { ok = true; } });
        if (!ok) { return; }
        st.c1 = play(st.p, i, 0); st.ys += st.c1; st.lp = i; st.n++; st.lc = 12; st.c2 = 0;
        if (ended(st, 1)) { return; }
        mv = cpuMove(st);
        st.c2 = play(st.p, mv, 1); st.cs += st.c2; st.lc = mv; st.n++;
        ended(st, 0);
      },
      draw: function (st) {
        var sc = scene(6, 4, 20, 20, '#55361a'), c, idx, row;
        R(sc, 0.05, 0.55, 5.9, 2.9, '#8a5a2e');
        R(sc, 0.05, 1.98, 5.9, 0.04, '#55361a');
        each([0.8, 1.3, 2.6, 3.1], function (y) { R(sc, 0.1, y, 5.8, 0.02, '#a06a38'); });
        T(sc, 3, 0.27, 'Computer ' + st.cs, '#f4dca6', 9);
        T(sc, 3, 3.73, 'You ' + st.ys, '#ffd23c', 9);
        for (row = 0; row < 2; row++) {
          for (c = 0; c < 6; c++) {
            idx = row === 0 ? 11 - c : c;
            if ((row === 0 && idx === st.lc) || (row === 1 && idx === st.lp)) { C(sc, c + 0.5, row + 1.5, 0.49, '#ffd23c'); }
            C(sc, c + 0.5, row + 1.53, 0.43, '#3a220e');
            C(sc, c + 0.5, row + 1.5, 0.41, '#55361a');
            T(sc, c + 0.5, row + 1.5, st.p[idx], row ? '#ffd23c' : '#f4dca6', 10);
          }
        }
        return sc;
      },
      icon: function (sc) { C(sc, 0.3, 0.33, 0.17, '#55361a'); C(sc, 0.7, 0.33, 0.17, '#55361a'); C(sc, 0.3, 0.7, 0.17, '#55361a'); C(sc, 0.7, 0.7, 0.17, '#55361a'); C(sc, 0.3, 0.7, 0.05, '#ffd23c'); C(sc, 0.7, 0.33, 0.05, '#ffd23c'); },
      help: function (sc) {
        var c;
        R(sc, 0.2, 0.3, 7.4, 4.2, '#8a5a2e');
        for (c = 0; c < 6; c++) { C(sc, 0.9 + c * 1.2, 1.4, 0.45, '#55361a'); C(sc, 0.9 + c * 1.2, 3.4, 0.45, '#55361a'); T(sc, 0.9 + c * 1.2, 3.4, c + 1, '#ffd23c', 8); }
        S(sc, 7.75, 2.0, 'arrow');
        R(sc, 8.6, 0.6, 3.2, 1.1, '#ffd23c'); T(sc, 10.2, 1.15, 'CPU', '#101a3a', 8);
        R(sc, 8.6, 2.9, 3.2, 1.1, '#3a8ef0'); T(sc, 10.2, 3.45, 'You 1-6', '#ffffff', 8);
      },
      pad: function (st) {
        var row = [], ok = {}, i;
        each(legal(st.p, 0), function (l) { ok[l] = true; });
        for (i = 0; i < 6; i++) { row.push([String(i), String(i + 1), ok[i] ? '' : false]); }
        return [row];
      },
      top: function (st) { return 'You ' + st.ys + ' - ' + st.cs + ' CPU'; },
      ev: function (st) {
        if (st.o) { return ['', 'You win!', 'The computer wins', 'A draw'][st.m]; }
        if (st.lp === 12) { return ''; }
        return 'You +' + st.c1 + ' &middot; CPU +' + st.c2;
      },
      info: function (st) { return st.o ? 'Game finished' : 'Your turn: pick a pit 1 to 6'; },
      lives: function () { return null; },
      score: function (st) { return st.ys; }
    };
  }());

  /* ---------- Cowrie Merge: merge puzzle ---------- */
  G.cowrie = (function () {
    var COL = ['#c9a87a', '#fbf1dc', '#f6deb4', '#f28c18', '#e86a24', '#e03c32', '#c22a2a', '#ffd23c', '#e2b21e', '#1e8a3c', '#22a6a0', '#1c3e9c', '#9a4fd0'];
    var SHD = ['#b8966a', '#d9c9a8', '#d6bd8e', '#b85c08', '#a84a14', '#9c1c1c', '#8a1a1a', '#c99a12', '#a88210', '#0f5228', '#126a66', '#101a3a', '#5a2a8a'];
    function lines(dir) {
      var L = [], i, j, line;
      for (i = 0; i < 4; i++) {
        line = [];
        for (j = 0; j < 4; j++) {
          if (dir === 'L') { line.push(i * 4 + j); } else if (dir === 'R') { line.push(i * 4 + 3 - j); }
          else if (dir === 'U') { line.push(j * 4 + i); } else { line.push((3 - j) * 4 + i); }
        }
        L.push(line);
      }
      return L;
    }
    function slide(st, dir, apply) {
      var moved = false, gain = 0, g = st.g.slice();
      each(lines(dir), function (line) {
        var vals = [], out = [], i;
        each(line, function (ix) { if (g[ix]) { vals.push(g[ix]); } });
        for (i = 0; i < vals.length; i++) {
          if (i + 1 < vals.length && vals[i] === vals[i + 1]) { out.push(vals[i] + 1); gain += Math.pow(2, vals[i] + 1); i++; } else { out.push(vals[i]); }
        }
        while (out.length < 4) { out.push(0); }
        each(line, function (ix, k) { if (g[ix] !== out[k]) { moved = true; } g[ix] = out[k]; });
      });
      if (apply && moved) { st.g = g; st.sc += gain; }
      return moved;
    }
    function spawn(st) {
      var free = [], i;
      for (i = 0; i < 16; i++) { if (!st.g[i]) { free.push(i); } }
      if (free.length) { st.g[free[ri(st, free.length)]] = ri(st, 10) === 0 ? 2 : 1; }
    }
    function canMove(st) { return slide(st, 'L') || slide(st, 'R') || slide(st, 'U') || slide(st, 'D'); }
    function tile(sc, x, y, e, w, h) {
      var v = Math.pow(2, e);
      R(sc, x, y, w, h, COL[Math.min(e, 12)]);
      R(sc, x, y + h * 0.82, w, h * 0.18, SHD[Math.min(e, 12)]);
      if (e) { T(sc, x + w / 2, y + h * 0.45, v, e < 3 ? '#55361a' : '#ffffff', v >= 1000 ? 8 : 10); }
    }
    return {
      name: 'Cowrie Merge', cat: 'puzzle', mins: '5 min', short: 'Slide and merge the cowries',
      blurb: 'Slide the cowrie shells. Two of the same number merge into one worth double.',
      lines: [['Up, Down, Left, Right', 'slide every cowrie'], ['Merge', '2 + 2 make 4, 4 + 4 make 8'], ['Target', 'reach 128 to level up']],
      tip: 'Keep your biggest cowrie in one corner.',
      init: function (sd) { var st = { g: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sc: 0, tg: 7, r: sd, o: 0, m: 0 }; spawn(st); spawn(st); return st; },
      enc: function (st) { var s = '', i; for (i = 0; i < 16; i++) { s += b36(st.g[i]); } return [s, b36(st.sc), b36(st.tg), b36(st.r), st.o, st.m].join('.'); },
      dec: function (s) {
        var a = s.split('.'), g = [], i;
        for (i = 0; i < 16; i++) { g.push(p36(a[0].charAt(i))); }
        return { g: g, sc: p36(a[1]), tg: p36(a[2]), r: p36(a[3]), o: num(a[4]), m: num(a[5]) };
      },
      step: function (st, a) {
        var mx = 0, i;
        st.m = 0;
        if (!slide(st, a, true)) { st.m = 2; return; }
        spawn(st);
        for (i = 0; i < 16; i++) { if (st.g[i] > mx) { mx = st.g[i]; } }
        if (mx >= st.tg) { st.m = 1; st.tg++; }
        if (!canMove(st)) { st.o = 1; st.m = 3; }
      },
      draw: function (st) {
        var sc = scene(4, 4, 30, 22, '#a88a5c'), i;
        for (i = 0; i < 16; i++) { tile(sc, i % 4 + 0.05, Math.floor(i / 4) + 0.07, st.g[i], 0.9, 0.86); }
        return sc;
      },
      icon: function (sc) { S(sc, 0.08, 0.08, 'cowrie', { k: 2 }); },
      help: function (sc) {
        var sc2 = sc;
        tile(sc2, 0.5, 1.2, 1, 2.6, 2.4); T(sc2, 3.65, 2.3, '+', '#55361a', 12);
        tile(sc2, 4.3, 1.2, 1, 2.6, 2.4); S(sc2, 7.2, 2.0, 'arrow', { ro: 1 });
        tile(sc2, 8.6, 1.2, 2, 2.6, 2.4);
      },
      pad: function () { return [[['U', 'Up']], [['L', 'Left'], ['R', 'Right']], [['D', 'Down']]]; },
      top: function (st) { return 'Score ' + st.sc; },
      ev: function (st) { return ['', 'Target reached!', 'That way is blocked', 'No moves left'][st.m]; },
      info: function (st) { return 'Target ' + Math.pow(2, st.tg); },
      lives: function () { return null; },
      score: function (st) { return st.sc; }
    };
  }());

  /* =====================================================================
     PAGES
     ===================================================================== */
  function kente() {
    var cols = ['#e03c32', '#ffd23c', '#1e8a3c', '#101a3a'], h = '<table class="ks" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>', i;
    for (i = 0; i < 12; i++) { h += '<td height="3" bgcolor="' + cols[i % 4] + '"></td>'; }
    return h + '</tr></table>';
  }
  function topBar(left, right) { return '<div class="hd">' + (right ? '<span class="r">' + right + '</span>' : '') + left + '</div>' + kente(); }
  function logo() { return '<span class="lg">v</span>play <span class="lw">Games</span>'; }
  var IBG = { chop: '#101a3a', harm: '#101a3a', road: '#1e8a3c', coco: '#8fd8ff', mamba: '#f4dca6', pen: '#1e8a3c', oware: '#8a5a2e', cowrie: '#f4dca6' };
  function icon(id) { var sc = scene(1, 1, 24, 24, IBG[id] || catOf(id).col); G[id].icon(sc); return pic(sc, 1, 'ic'); }
  function hearts(l) {
    var sc = scene(l[1], 1, 8, 7, '#101a3a'), i;
    for (i = 0; i < l[1]; i++) { S(sc, i + 0.06, 0.07, 'heart', { sw: i < l[0] ? '' : 'r=G,w=G' }); }
    return pic(sc, 1);
  }
  function adSlot() { return '<div class="ad">Advertisement</div>'; }
  function catBand(c, count) { return '<div class="cat" style="background:' + c.col + '"><span class="r cn">' + count + '</span>' + c.name + '</div>'; }
  function gameRow(id) {
    var c = catOf(id), g = G[id];
    return '<div class="gr" style="border-left-color:' + c.col + '">' + icon(id) + lnk(url({ p: 'i', g: id }), g.name) + '<br><span class="d">' + g.short + '</span></div>';
  }
  function others(id, n) {
    var out = [], i = 0, start = 0, k;
    for (k = 0; k < ORDER.length; k++) { if (ORDER[k] === id) { start = k; } }
    while (out.length < n && i < ORDER.length) { i++; out.push(ORDER[(start + i) % ORDER.length]); }
    return out;
  }
  function footer() {
    var r = Q.r || 'svg', z = zoom(), h = '<div class="ft">Pictures: ';
    each([['svg', 'SVG'], ['img', 'Image'], ['tbl', 'Table']], function (m) {
      h += (r === m[0] ? '<span class="on">' + m[1] + '</span>' : lnk(url({ p: Q.p, g: Q.g, s: Q.s, r: m[0] }), m[1])) + ' ';
    });
    h += '<br>Screen: ' + (z === 2 ? lnk(url({ p: Q.p, g: Q.g, s: Q.s, z: '1' }), 'Small') + ' <span class="on">Big</span>' :
      '<span class="on">Small</span> ' + lnk(url({ p: Q.p, g: Q.g, s: Q.s, z: '2' }), 'Big'));
    return h + '<br>' + lnk('test.html', 'Phone test page') + '</div>';
  }

  function pageHome() {
    var h = topBar(logo(), 'Free'), cont = getC('vc'), parts, pick, g, i, n, sc;
    if (cont) {
      parts = cont.split('|');
      if (G[parts[0]] && parts[1]) { h += '<div class="cont">' + lnk(url({ p: 'p', g: parts[0], s: parts[1] }), 'Continue ' + G[parts[0]].name + ' &rsaquo;') + '</div>'; }
    }
    pick = ORDER[Math.floor(new Date().getTime() / 86400000) % ORDER.length];
    g = G[pick];
    sc = g.draw(g.init(4242));
    h += '<div class="tp">Today\'s pick</div><div class="pk">' + pic(sc, 0.5 * zoom(), 'th') + '<b>' + g.name + '</b><br><span class="d">' + g.short + '</span><br>' +
      lnk(url({ p: 'i', g: pick }), 'Play now', 'bp') + '</div>';
    each(CATS, function (c) {
      n = 0;
      for (i = 0; i < ORDER.length; i++) { if (G[ORDER[i]].cat === c.id) { n++; } }
      h += catBand(c, n + (n === 1 ? ' game' : ' games'));
      for (i = 0; i < ORDER.length; i++) { if (G[ORDER[i]].cat === c.id) { h += gameRow(ORDER[i]); } }
    });
    return h + adSlot() + footer();
  }

  function pageIntro(id) {
    var g = G[id], c = catOf(id), best = getC('b' + id), h, hs = scene(12, 5, 10, 10, '#ffffff');
    h = topBar(lnk(url({}), '&lsaquo; All games'), best ? 'Best ' + esc(best) : '');
    h += '<div class="fr">' + pic(g.draw(g.init(4242))) + '</div>';
    h += '<div class="ti"><b>' + g.name + '</b><br><span class="tag" style="background:' + c.col + '">' + c.name + '</span> <span class="tag tg">' + g.mins +
      '</span> <span class="tag t2">2G ok</span></div>';
    h += '<div class="p">' + g.blurb + '</div>';
    h += lnk(url({ p: 'p', g: id, s: g.enc(g.init(newSeed())) }), 'Play', 'btn');
    h += '<div class="sec">How to play</div>';
    g.help(hs);
    h += '<div class="hp">' + pic(hs) + '</div>';
    each(g.lines, function (l) { h += '<div class="hl"><b>' + l[0] + '</b>: ' + l[1] + '</div>'; });
    h += '<div class="tip">Tip: ' + g.tip + '</div>';
    return h + adSlot() + '<div class="ft">' + lnk(url({}), '&lsaquo; All games') + '</div>';
  }

  function pagePlay(id) {
    var g = G[id], st, cur, h, rows, ev, lv;
    try { st = g.dec(Q.s); cur = g.enc(st); if (cur !== Q.s) { st = g.dec(cur); } } catch (e) { st = g.init(newSeed()); cur = g.enc(st); }
    if (st.o) { return pageOver(id, st); }
    setC('vc', id + '|' + cur);
    lv = g.lives(st);
    /* No links above the controls: after each reload the first link the
       phone highlights should be a game control. */
    ev = g.ev(st);
    /* An event message takes over the header line, so the picture and the
       controls never move down the screen. */
    h = '<div class="hd hs' + (ev ? ' hev' : '') + '">' + (lv ? '<span class="r">' + hearts(lv) + '</span>' : '') + (ev || g.top(st)) + '</div>';
    h += '<div class="fr">' + pic(g.draw(st)) + '</div>';
    rows = g.pad(st);
    h += '<div class="pad">';
    each(rows, function (row) {
      h += '<div>';
      each(row, function (c) {
        if (c[2] === false) { h += '<span class="dis">' + c[1] + '</span> '; return; }
        var nx = g.dec(cur);
        g.step(nx, c[0]);
        h += lnk(url({ p: 'p', g: id, s: g.enc(nx) }), c[1], c[2] === 'a' ? 'b ba' : 'b') + ' ';
      });
      h += '</div>';
    });
    h += '</div><div class="inf">' + (ev ? g.top(st) + ' &middot; ' : '') + g.info(st) + '</div>';
    h += '<div class="ft"><b>' + g.name + '</b> &middot; ' + lnk(url({ p: 'i', g: id }), 'Help') + ' &middot; ' + lnk(url({}), 'All games') + '</div>';
    return h;
  }

  function pageOver(id, st) {
    var g = G[id], score = g.score(st), best = num(getC('b' + id)), nb = score > best, h, ev = g.ev(st);
    if (nb) { setC('b' + id, score); best = score; }
    setC('vc', '');
    h = topBar('Game over');
    h += '<div class="sb"><span class="d">' + g.name + ' score</span><br><span class="big">' + score + '</span><br>' +
      (nb && score > 0 ? '<span class="nb">New best!</span>' : 'Best ' + best) + '</div>';
    if (ev) { h += '<div class="ev">' + ev + '</div>'; }
    h += lnk(url({ p: 'p', g: id, s: g.enc(g.init(newSeed())) }), 'Play again', 'btn');
    h += '<div class="sec">Try next</div>';
    each(others(id, 2), function (o) { h += gameRow(o); });
    h += '<div class="gr">' + lnk(url({}), 'All games &rsaquo;') + '</div>';
    h += '<div class="fr">' + pic(g.draw(st), 0.5 * zoom()) + '</div>';
    return h + adSlot();
  }

  function render(search) {
    SVGN = 0;
    Q = parseQ(search);
    if (Q.g && !G[Q.g]) { Q.g = ''; }
    if (Q.p === 'p' && Q.g) { return pagePlay(Q.g); }
    if (Q.p === 'i' && Q.g) { return pageIntro(Q.g); }
    return pageHome();
  }

  function main() {
    var html;
    try { html = render(location.search); } catch (e) { html = topBar(logo()) + '<div class="p">Something went wrong. ' + lnk('./', 'Start again') + '</div>'; }
    try { if (window.operamini && window.operamini.page) { window.operamini.page.maxAge = Q.p ? 60 : 0; } } catch (e2) { }
    document.write(html);
  }

  return { G: G, ORDER: ORDER, CATS: CATS, main: main, render: render, toSvg: toSvg, setQ: function (s) { Q = parseQ(s); } };
}());
