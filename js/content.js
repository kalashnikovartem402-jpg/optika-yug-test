(function () {
  'use strict';

  var LABEL_COLORS = ['text-sky-300', 'text-pink-300', 'text-emerald-300', 'text-amber-300', 'text-cyan-300', 'text-violet-300'];
  var DEFAULT_THUMB = 'images/AdobeStock_317116275_1_0.png.jpg';
  var RAW_GH_BASE = 'https://raw.githubusercontent.com/kalashnikovartem402-jpg/optika-yug/main/';
  var isGhPages = /\.github\.io$/i.test(location.hostname);

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeAsset(url, fallback) {
    url = String(url || '');
    if (/^https:\/\//i.test(url) || (/^(images|uploads)\/[\w\-./]+$/.test(url) && url.indexOf('..') === -1)) return url;
    return fallback || '';
  }

  function getCachedBlobUrl(path) {
    return new Promise(function (resolve) {
      if (!path || path.indexOf('uploads/') !== 0 || typeof indexedDB === 'undefined') return resolve(null);
      try {
        var req = indexedDB.open('OptikaMediaCache', 1);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        };
        req.onsuccess = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('files')) return resolve(null);
          var getReq = db.transaction('files', 'readonly').objectStore('files').get(path);
          getReq.onsuccess = function () {
            resolve(getReq.result ? URL.createObjectURL(getReq.result) : null);
          };
          getReq.onerror = function () { resolve(null); };
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function resolveMediaUrl(path, fallback) {
    var clean = safeAsset(path, fallback);
    if (!clean) return Promise.resolve('');
    if (clean.indexOf('uploads/') !== 0) return Promise.resolve(clean);
    return getCachedBlobUrl(clean).then(function (blobUrl) {
      if (blobUrl) return blobUrl;
      if (isGhPages) return RAW_GH_BASE + clean;
      return clean;
    });
  }

  function safeLink(url) {
    url = String(url || '');
    return /^(https?:\/\/|tel:|mailto:|#)/i.test(url) ? url : '#';
  }

  function telHref(phone) {
    var digits = String(phone || '').replace(/[^\d+]/g, '');
    if (digits.charAt(0) === '8' && digits.length === 11) digits = '+7' + digits.slice(1);
    return 'tel:' + digits;
  }

  function applyContacts(c) {
    if (!c) return;
    if (window.OptikaContent) window.OptikaContent.contacts = c;
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var key = el.getAttribute('data-bind');
      if (c[key]) el.textContent = c[key];
    });
    document.querySelectorAll('[data-bind-tel]').forEach(function (el) {
      var key = el.getAttribute('data-bind-tel');
      if (c[key]) el.setAttribute('href', telHref(c[key]));
    });
  }

  var OPTOTYPE_OVERRIDES = {
    'мужские': { word: 'МУЖСКАЯ', caption: 'коллекция' },
    'женские': { word: 'ЖЕНСКАЯ', caption: 'коллекция' },
    'контактные линзы': { word: 'ЛИНЗЫ', caption: 'контактные' }
  };

  function optotypeParts(title) {
    var raw = String(title == null ? '' : title).trim();
    var ov = OPTOTYPE_OVERRIDES[raw.toLowerCase()];
    var words = raw.split(/\s+/).filter(Boolean);
    var word = ov ? ov.word : (words[0] || '').toUpperCase();
    var rows = [word.charAt(0), word.slice(1, 3), word.slice(3)].filter(Boolean);
    return { rows: rows, caption: ov ? ov.caption : (words.slice(1).join(' ').toLowerCase() || 'коллекция') };
  }

  function optotypeCard(it, i) {
    var link = safeLink(it.link);
    var external = /^https?:\/\//i.test(link);
    var p = optotypeParts(it.title);
    var num = ('0' + (i + 1)).slice(-2);
    var diam = (50 + i * 2).toFixed(1);
    var vis = ((i + 1) / 10).toFixed(1);
    var cta = String(it.linkText || 'Смотреть в ВК').toUpperCase();
    return '<a href="' + esc(link) + '"' + (external ? ' target="_blank" rel="noopener"' : '') + ' class="optotype-card group flex flex-col aspect-square bg-white p-3 sm:p-4 lg:p-3.5 xl:p-4 text-black">' +
      '<span class="sr-only">' + esc(it.title) + '</span>' +
      '<div class="flex items-center justify-between font-mono text-[9px] sm:text-[11px] lg:text-xs leading-none text-slate-500 pb-1.5" aria-hidden="true">' +
        '<span>№' + num + ' · D=' + diam + '</span><span>V=' + vis + '</span>' +
      '</div>' +
      '<div class="optotype-pyramid flex-1 min-h-0 flex flex-col items-center justify-center text-center font-black text-black" aria-hidden="true">' +
        p.rows.map(function (r, k) { return '<span class="opt-row opt-r' + (k + 1) + (k === 2 && r.length > 5 ? ' opt-r3-long' : '') + '">' + esc(r) + '</span>'; }).join('') +
      '</div>' +
      '<div class="text-center text-[10px] sm:text-xs lg:text-sm tracking-widest text-black pt-1.5 pb-2 sm:pb-2.5 truncate" aria-hidden="true">' + esc(p.caption) + '</div>' +
      '<div class="h-px w-full bg-black" aria-hidden="true"></div>' +
      '<div class="flex items-center justify-between gap-2 pt-2 font-mono text-[9px] sm:text-[11px] lg:text-xs leading-none tracking-wider text-black" aria-hidden="true">' +
        '<span class="truncate">' + esc(cta) + '</span>' +
        '<span class="opt-arrow flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 border border-black flex items-center justify-center"><i data-lucide="arrow-up-right" class="w-3 h-3 sm:w-3.5 sm:h-3.5"></i></span>' +
      '</div>' +
    '</a>';
  }

  function renderCatalog(cat) {
    var grid = document.getElementById('catalog-grid');
    if (!cat || !grid || !Array.isArray(cat.items) || !cat.items.length) return;
    var t = document.getElementById('catalog-title');
    var s = document.getElementById('catalog-subtitle');
    if (t && cat.title) t.textContent = cat.title;
    if (s && cat.subtitle) s.textContent = cat.subtitle;
    grid.innerHTML = cat.items.map(optotypeCard).join('');
  }

  function renderServices(srv) {
    var list = document.getElementById('services-list');
    if (!srv || !list || !Array.isArray(srv.items) || !srv.items.length) return;
    var t = document.getElementById('services-title');
    if (t && srv.title) t.textContent = srv.title;
    list.innerHTML = srv.items.map(function (it) {
      var icon = /^[a-z0-9-]+$/.test(it.icon || '') ? it.icon : 'check';
      return '<div class="group flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:bg-sky-50 hover:border-sky-100 transition-all duration-300 cursor-default">' +
        '<div class="w-11 h-11 rounded-2xl bg-sky-100 group-hover:bg-sky-600 flex items-center justify-center flex-shrink-0 transition-colors duration-300">' +
          '<i data-lucide="' + icon + '" class="w-5 h-5 text-sky-600 group-hover:text-white transition-colors duration-300"></i>' +
        '</div>' +
        '<div>' +
          '<div class="font-700 text-slate-800 text-base lg:text-lg">' + esc(it.title) + '</div>' +
          (it.text ? '<div class="text-sm lg:text-base text-slate-600 mt-0.5">' + esc(it.text) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function applyAll(data) {
    if (!data) return null;
    applyContacts(data.contacts);
    renderCatalog(data.catalog);
    renderServices(data.services);
    if (window.lucide) lucide.createIcons();
    if (typeof window.onOptikaPlaylistUpdate === 'function' && data.playlist) {
      window.onOptikaPlaylistUpdate(data.playlist);
    }
    return data;
  }

  function getLocalImmediateContent() {
    try {
      var liveRaw = localStorage.getItem('optika_live_content_v2');
      if (liveRaw) {
        var parsed = JSON.parse(liveRaw);
        if (parsed && parsed.content && (Date.now() - (parsed.ts || 0) < 10 * 60 * 1000)) {
          return parsed.content;
        }
      }
      var demoRaw = localStorage.getItem('optika_demo_content_v2');
      if (demoRaw) return JSON.parse(demoRaw);
    } catch (e) {}
    return null;
  }

  function fetchLatestContent() {
    var localData = getLocalImmediateContent();
    if (localData) {
      return Promise.resolve(applyAll(localData));
    }
    var url = isGhPages
      ? (RAW_GH_BASE + 'content.json?t=' + Date.now())
      : ('content.json?t=' + Date.now());
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) return fetch('content.json?t=' + Date.now(), { cache: 'no-store' });
        return r;
      })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(applyAll)
      .catch(function () { return null; });
  }

  window.OptikaContent = {
    esc: esc,
    safeAsset: safeAsset,
    resolveMediaUrl: resolveMediaUrl,
    RAW_GH_BASE: RAW_GH_BASE,
    isGhPages: isGhPages,
    DEFAULT_THUMB: DEFAULT_THUMB
  };

  window.optikaContentReady = fetchLatestContent();

  window.addEventListener('storage', function (e) {
    if (e.key === 'optika_live_content_v2' || e.key === 'optika_demo_content_v2') {
      fetchLatestContent();
    }
  });
})();
