/* CK Wiring — ตัววาดแผนผังที่ใช้ร่วมกันระหว่างโปรแกรมวาด (/admin/wiring) และหน้าดูของลูกค้า (/wiring/view.html)
   ไม่มี dependency · ผูกข้อมูลผ่าน CKW.bind({ doc, sel, k, asset }) */
(function () {
  'use strict';
  const GRID = 10;
  const FONT = "Tahoma, 'Leelawadee UI', Thonburi, 'Sarabun', sans-serif";
  const PAGES = {
    A4L: { w: 1400, h: 990, mm: [297, 210], label: 'A4 แนวนอน', css: 'A4 landscape' },
    A4P: { w: 990, h: 1400, mm: [210, 297], label: 'A4 แนวตั้ง', css: 'A4 portrait' },
    A3L: { w: 1980, h: 1400, mm: [420, 297], label: 'A3 แนวนอน', css: 'A3 landscape' },
    A3P: { w: 1400, h: 1980, mm: [297, 420], label: 'A3 แนวตั้ง', css: 'A3 portrait' },
  };
  const COMP_KINDS = { sw_no: 'สวิตช์ (ปกติเปิด)', sw_nc: 'สวิตช์ (ปกติปิด)', fuse: 'ฟิวส์', breaker: 'เบรกเกอร์', coil: 'คอยล์ / รีเลย์', lamp: 'หลอดไฟ', motor: 'มอเตอร์', res: 'ตัวต้านทาน', cap: 'ตัวเก็บประจุ', ground: 'กราวด์' };
  const snap = v => Math.round(v / GRID) * GRID;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const EMPTY = new Set();
  const B = { doc: () => null, sel: () => EMPTY, k: () => 1, asset: () => null };
  const bind = b => Object.assign(B, b);
  const byId = id => B.doc().items.find(i => i.id === id);
  const pageOf = d => PAGES[(d || B.doc()).page] || PAGES.A4L;

  /* ---------- geometry ---------- */
  const DIRV = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
  const isVert = d => d === 'U' || d === 'D';
  function rotPt(x, y, r) { r = ((r % 4) + 4) % 4; return r === 0 ? [x, y] : r === 1 ? [-y, x] : r === 2 ? [-x, -y] : [y, -x]; }
  function rotDir(d, r) { if (!d) return null; const [x, y] = rotPt(...DIRV[d], r); return x < 0 ? 'L' : x > 0 ? 'R' : y < 0 ? 'U' : 'D'; }
  function compPins(it) { return it.kind === 'ground' ? { a: [0, -20, 'U'] } : { a: [-30, 0, 'L'], b: [30, 0, 'R'] }; }
  function devTerm(it, t) {
    const same = it.terms.filter(x => x.side === t.side); const i = same.indexOf(t), ts = it.ts ?? 30;
    // ขั้วล่าง: เรียงซ้าย→ขวา อยู่กึ่งกลางขอบล่าง
    if (t.side === 'B') return { x: snap(it.x + it.w / 2 - (same.length - 1) * ts / 2) + i * ts, y: it.y + it.h, dir: 'D' };
    return { x: t.side === 'L' ? it.x : it.x + it.w, y: it.y + (it.tt ?? 60) + i * ts, dir: t.side === 'L' ? 'L' : 'R' };
  }
  function pinPos(ref) {
    if (!ref) return null;
    if (ref.id == null) return { x: ref.x, y: ref.y, dir: null };
    const it = byId(ref.id); if (!it) return null;
    if (it.type === 'dev') { const t = it.terms.find(t => t.id === ref.pin); return t ? devTerm(it, t) : null; }
    if (it.type === 'comp') {
      const p = compPins(it)[ref.pin]; if (!p) return null;
      const [x, y] = rotPt(p[0], p[1], it.rot || 0);
      return { x: it.x + x, y: it.y + y, dir: rotDir(p[2], it.rot || 0) };
    }
    if (it.type === 'junc') return { x: it.x, y: it.y, dir: null };
    return null;
  }
  const endPos = r => pinPos(r) || { x: r.x || 0, y: r.y || 0, dir: null };
  function simplify(P) {
    const out = [];
    for (const p of P) { const l = out[out.length - 1]; if (l && l.x === p.x && l.y === p.y) continue; out.push({ x: p.x, y: p.y }); }
    for (let i = out.length - 2; i >= 1; i--) { const a = out[i - 1], b = out[i], c = out[i + 1]; if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(i, 1); }
    if (out.length === 1) out.push({ ...out[0] });
    return out;
  }
  function autoRoute(A, B2) {
    if (A.x === B2.x || A.y === B2.y) return [A, B2];
    const a = A.dir ? (isVert(A.dir) ? 'v' : 'h') : null, b = B2.dir ? (isVert(B2.dir) ? 'v' : 'h') : null;
    if (a === 'h' && b === 'h') { const mx = snap((A.x + B2.x) / 2); return [A, { x: mx, y: A.y }, { x: mx, y: B2.y }, B2]; }
    if (a === 'v' && b === 'v') { const my = snap((A.y + B2.y) / 2); return [A, { x: A.x, y: my }, { x: B2.x, y: my }, B2]; }
    const first = a || (b === 'h' ? 'v' : 'h');
    return first === 'h' ? [A, { x: B2.x, y: A.y }, B2] : [A, { x: A.x, y: B2.y }, B2];
  }
  function route(w) {
    const A = endPos(w.a), Bp = endPos(w.b), V = w.pts || [];
    if (!V.length) return simplify(autoRoute(A, Bp));
    const chain = [A, ...V, Bp], out = [{ x: A.x, y: A.y }];
    for (let i = 0; i < chain.length - 1; i++) {
      const P = chain[i], Q = chain[i + 1];
      if (P.x !== Q.x && P.y !== Q.y) {
        let vFirst = false;
        if (i === chain.length - 2 && Bp.dir && !isVert(Bp.dir)) vFirst = true;
        else if (i === 0 && A.dir && isVert(A.dir)) vFirst = true;
        out.push(vFirst ? { x: P.x, y: Q.y } : { x: Q.x, y: P.y });
      }
      out.push({ x: Q.x, y: Q.y });
    }
    return simplify(out);
  }
  function bbox(it) {
    if (it.type === 'junc') return { x: it.x - 6, y: it.y - 6, w: 12, h: 12 };
    if (it.type === 'comp') return (it.rot || 0) % 2 ? { x: it.x - 16, y: it.y - 30, w: 32, h: 60 } : { x: it.x - 30, y: it.y - 16, w: 60, h: 32 };
    return { x: it.x, y: it.y, w: it.w, h: it.h };
  }

  /* ---------- drawing (S = โหมดแก้ไข: ใส่ data-h ไว้ให้คลิก) ---------- */
  const estW = (s, size) => String(s).length * size * 0.6;
  const hAttr = (S, it) => S ? ` data-h="item" data-id="${it.id}"` : '';
  function lines(x, y, arr, o) {
    return arr.map((ln, i) => {
      let b = o.bold, t = ln; const m = /^\s*\*\*(.*)\*\*\s*$/.exec(ln); if (m) { b = true; t = m[1]; }
      return `<text x="${x}" y="${(y + i * o.lh).toFixed(1)}" font-size="${o.size}" fill="${o.color}" text-anchor="${o.anchor}"${b ? ' font-weight="bold"' : ''}>${esc(t)}</text>`;
    }).join('');
  }
  const asset = id => (id ? B.asset(id) : null);
  function drawDev(it, S) {
    const { x, y, w, h } = it, fs = it.fs || 16;
    let s = `<g${hAttr(S, it)}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${it.fill || '#fff'}" stroke="#444" stroke-width="1"/>`;
    s += `<text x="${x + w / 2}" y="${y + fs + 12}" font-size="${fs}" font-weight="bold" text-anchor="middle" fill="#111">${esc(it.title)}</text>`;
    let cy = y + fs + 12;
    if (it.sub) { const L = it.sub.split('\n'); s += lines(x + w / 2, cy + 20, L, { size: 13, lh: 18, color: '#222', anchor: 'middle' }); cy += 8 + L.length * 18; }
    const Lt = it.terms.filter(t => t.side === 'L'), Rt = it.terms.filter(t => t.side === 'R');
    const lw = a => a.length ? Math.max(...a.map(t => estW(t.label, 12))) + 24 : 12;
    const src = asset(it.img);
    if (src) {
      const ix0 = x + lw(Lt), ix1 = x + w - lw(Rt), iy0 = cy + 14, iy1 = y + h - (it.terms.some(t => t.side === 'B') ? 32 : 12);
      if (ix1 - ix0 > 10 && iy1 - iy0 > 10) s += `<image href="${esc(src)}" x="${ix0}" y="${iy0}" width="${ix1 - ix0}" height="${iy1 - iy0}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    for (const t of it.terms) {
      const p = devTerm(it, t);
      s += t.side === 'B'
        ? `<text x="${p.x}" y="${y + h - 9}" font-size="11" fill="#222" text-anchor="middle">${esc(t.label)}</text>`
        : t.side === 'L'
        ? `<text x="${x + 10}" y="${p.y + 4}" font-size="12" fill="#222">${esc(t.label)}</text>`
        : `<text x="${x + w - 10}" y="${p.y + 4}" font-size="12" fill="#222" text-anchor="end">${esc(t.label)}</text>`;
      if (S) s += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#c4c8cf"/>`;
    }
    return s + '</g>';
  }
  function drawText(it, S) {
    const { x, y, w, h } = it, fill = it.fill || 'none', stroke = it.stroke || 'none';
    let s = `<g${hAttr(S, it)}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${it.r || 0}" fill="${fill === 'none' ? '#fff' : fill}" fill-opacity="${fill === 'none' ? 0 : 1}" stroke="${stroke}" stroke-width="${it.sw || 1}"/>`;
    const H = it.head ? it.head.split('\n') : [], Bd = it.body ? it.body.split('\n') : [];
    const hs = it.hs || 24, bs = it.bs || 13, lh1 = hs * 1.3, lh2 = bs * 1.5;
    const total = H.length * lh1 + Bd.length * lh2;
    const al = it.align || 'center', anchor = al === 'left' ? 'start' : al === 'right' ? 'end' : 'middle', tx = al === 'left' ? x + 12 : al === 'right' ? x + w - 12 : x + w / 2;
    let ty = y + (h - total) / 2;
    if (H.length) { s += lines(tx, ty + hs * 0.95, H, { size: hs, lh: lh1, color: it.hc || '#e53935', anchor, bold: true }); ty += H.length * lh1; }
    if (Bd.length) s += lines(tx, ty + bs * 1.05, Bd, { size: bs, lh: lh2, color: it.color || '#111', anchor, bold: !!it.bold });
    return s + '</g>';
  }
  function drawImg(it, S) {
    const src = asset(it.img);
    let s = `<g${hAttr(S, it)}>`;
    if (S) s += `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="#fff" fill-opacity="0" stroke="${src ? 'none' : '#bbb'}" stroke-dasharray="4 3"/>`;
    if (src) s += `<image href="${esc(src)}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="xMidYMid meet"/>`;
    return s + '</g>';
  }
  function drawTitle(it, S) {
    const { x, y, w, h } = it;
    let s = `<g${hAttr(S, it)}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#444" stroke-width="1"/>`;
    s += `<text x="${x + 30}" y="${y + h - 62}" font-size="22" font-weight="bold" fill="#111">${esc(it.company)}</text>`;
    s += `<text x="${x + 30}" y="${y + h - 28}" font-size="19" fill="#111">${esc(it.address)}</text>`;
    const src = asset(it.logo), lh = Math.max(20, h - 75);
    if (src) s += `<image href="${esc(src)}" x="${x + w - 175}" y="${y + 12}" width="150" height="${lh}" preserveAspectRatio="xMidYMid meet"/>`;
    else if (S) s += `<rect x="${x + w - 175}" y="${y + 12}" width="150" height="${lh}" fill="none" stroke="#ccc" stroke-dasharray="4 3"/><text x="${x + w - 100}" y="${y + 12 + lh / 2 + 4}" font-size="11" fill="#aaa" text-anchor="middle">โลโก้</text>`;
    s += lines(x + w - 100, y + h - 46, (it.drawn || '').split('\n'), { size: 10, lh: 13, color: '#222', anchor: 'middle' });
    return s + '</g>';
  }
  function compShape(kind) {
    const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>`;
    switch (kind) {
      case 'sw_no': return `<path d="M-30 0H-14.5M14.5 0H30M-10 -1.5L13 -14"/>` + c(-12, 0, 2.6) + c(12, 0, 2.6);
      case 'sw_nc': return `<path d="M-30 0H-14.5M14.5 0H30M-10 1L17 6M12 -9V3"/>` + c(-12, 0, 2.6) + c(12, 0, 2.6);
      case 'fuse': return `<path d="M-30 0H30"/><rect x="-15" y="-6" width="30" height="12"/>`;
      case 'breaker': return `<path d="M-30 0H-14M14 0H30M-11 -3Q0 -20 11 -3"/>` + c(-12, 0, 2.4) + c(12, 0, 2.4);
      case 'coil': return `<path d="M-30 0H-13M13 0H30"/><rect x="-13" y="-9" width="26" height="18" fill="#fff"/>`;
      case 'lamp': return `<path d="M-30 0H-11M11 0H30M-7.5 -7.5L7.5 7.5M-7.5 7.5L7.5 -7.5"/><circle r="11"/>`;
      case 'motor': return `<path d="M-30 0H-14M14 0H30"/><circle r="14" fill="#fff"/><text y="5" font-size="14" text-anchor="middle" stroke="none" fill="currentColor" font-weight="bold">M</text>`;
      case 'res': return `<path d="M-30 0H-18L-15 -6L-9 6L-3 -6L3 6L9 -6L15 6L18 0H30"/>`;
      case 'cap': return `<path d="M-30 0H-4M4 0H30M-4 -11V11M4 -11V11"/>`;
      case 'ground': return `<path d="M0 -20V0M-13 0H13M-8 5H8M-3.5 10H3.5"/>`;
    }
    return '';
  }
  function drawComp(it, S) {
    const col = it.color || '#111', r = (it.rot || 0) * 90;
    let s = `<g${hAttr(S, it)}><g transform="translate(${it.x},${it.y}) rotate(${r})" stroke="${col}" color="${col}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    if (S) s += `<rect x="-30" y="-16" width="60" height="32" fill="#fff" fill-opacity="0" stroke="none"/>`;
    s += compShape(it.kind) + '</g>';
    if (it.label) {
      const odd = (it.rot || 0) % 2;
      s += odd ? `<text x="${it.x + 20}" y="${it.y + 4}" font-size="12" fill="#222">${esc(it.label)}</text>`
        : `<text x="${it.x}" y="${it.kind === 'ground' ? it.y + 26 : it.y - 20}" font-size="12" fill="#222" text-anchor="middle">${esc(it.label)}</text>`;
    }
    return s + '</g>';
  }
  function drawJunc(it, S) {
    return `<g${hAttr(S, it)}>${S ? `<circle cx="${it.x}" cy="${it.y}" r="8" fill="#fff" fill-opacity="0"/>` : ''}<circle cx="${it.x}" cy="${it.y}" r="4.2" fill="${it.color || '#111'}"/></g>`;
  }
  const pathD = P => 'M' + P.map(p => p.x + ' ' + p.y).join('L');
  function drawWire(w, S, P) {
    const d = pathD(P); let s = '';
    if (S && B.sel().has(w.id)) s += `<path d="${d}" fill="none" stroke="#2563eb" stroke-opacity=".28" stroke-width="9" stroke-linejoin="round"/>`;
    s += `<path d="${d}" fill="none" stroke="${w.color}" stroke-width="${w.width || 2}"${w.dash ? ' stroke-dasharray="7 5"' : ''} stroke-linejoin="round"/>`;
    for (const e of ['a', 'b']) {
      const r = w[e]; if (r.id == null) continue;
      const it = byId(r.id); if (!it || it.type === 'junc') continue;
      const p = pinPos(r); if (p) s += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${w.color}"/>`;
    }
    if (S) s += `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="${12 / B.k()}" data-h="wire" data-id="${w.id}"/>`;
    return s;
  }
  const DRAW = { dev: drawDev, text: drawText, img: drawImg, title: drawTitle, comp: drawComp, junc: drawJunc };
  function drawContent(S) {
    const d = B.doc(); let s = '';
    for (const it of d.items) if (it.type !== 'comp' && it.type !== 'junc' && DRAW[it.type]) s += DRAW[it.type](it, S);
    for (const w of d.wires) s += drawWire(w, S, route(w));
    for (const it of d.items) if (it.type === 'comp' || it.type === 'junc') s += DRAW[it.type](it, S);
    return s;
  }
  function exportSVG() {
    const pg = pageOf();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${pg.w}" height="${pg.h}" viewBox="0 0 ${pg.w} ${pg.h}" font-family="${FONT}"><rect width="${pg.w}" height="${pg.h}" fill="#fff"/>${drawContent(false)}</svg>`;
  }
  // รายการรูปที่แผนผังใช้ (รูปสินค้า / รูปภาพ / โลโก้)
  const assetIds = d => [...new Set(d.items.flatMap(i => [i.img, i.logo]).filter(Boolean))];

  window.CKW = {
    GRID, FONT, PAGES, COMP_KINDS, snap, clamp, esc, bind, pageOf,
    isVert, rotPt, rotDir, compPins, devTerm, pinPos, endPos, simplify, autoRoute, route, bbox,
    compShape, pathD, drawContent, exportSVG, assetIds,
  };
})();
