(function () {
  'use strict';

  const GH_DEFAULT = { owner: 'kalashnikovartem402-jpg', repo: 'optika-yug', branch: 'main' };
  const GH_MAX_UPLOAD = 25 * 1024 * 1024;
  const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'mov'];
  const ICONS = ['eye', 'zap', 'palette', 'wrench', 'circle-dot', 'glasses', 'sun', 'scan-eye', 'ruler', 'scissors', 'shield-check', 'clock', 'star', 'heart', 'sparkles', 'truck', 'gift', 'baby', 'user-check', 'stethoscope', 'percent', 'check'];

  const S = { backend: null, status: null, content: null, dirty: false, tab: 'videos', previews: {} };

  const $ = (sel, root) => (root || document).querySelector(sel);

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    children.flat(Infinity).forEach((c) => {
      if (c == null || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  const icon = (name, cls) => h('i', { 'data-lucide': name, class: cls || 'w-4 h-4' });
  const refreshIcons = () => window.lucide && window.lucide.createIcons();

  function toast(message, type) {
    const colors = { success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200', error: 'bg-rose-500/15 border-rose-500/40 text-rose-200', info: 'bg-slate-800 border-slate-700 text-slate-200' };
    const el = h('div', { class: 'max-w-sm border backdrop-blur px-4 py-3 rounded-xl text-sm font-semibold shadow-xl ' + (colors[type] || colors.info) }, message);
    $('#toast-wrap').append(el);
    setTimeout(() => el.remove(), type === 'error' ? 7000 : 4500);
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $('#screen-' + name).classList.add('active');
    refreshIcons();
  }

  function formError(form, message) {
    const el = $('.form-error', form);
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function setBusy(btn, busy, text) {
    if (busy) {
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = text || 'Подождите…';
    } else if (btn.dataset.html) {
      btn.innerHTML = btn.dataset.html;
      btn.disabled = false;
      refreshIcons();
    }
  }

  const fileExt = (name) => (String(name).split('.').pop() || '').toLowerCase();
  const randomHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
  const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const mb = (bytes) => Math.round(bytes / 1048576) + ' МБ';

  function fmtDuration(sec) {
    if (!sec || !isFinite(sec)) return '';
    sec = Math.round(sec);
    const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
    const pad = (x) => String(x).padStart(2, '0');
    return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
  }

  function assetUrl(path) {
    if (!path) return '../images/AdobeStock_317116275_1_0.png.jpg';
    if (S.previews[path]) return S.previews[path];
    return /^https?:\/\//i.test(path) ? path : '../' + path;
  }

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  function b64ToUtf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function fileToB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('Не удалось прочитать файл'));
      r.readAsDataURL(file);
    });
  }

  const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  function asset(v) {
    v = text(v, 500);
    if (/^https:\/\/\S+$/i.test(v)) return v;
    if (/^(images|uploads)\/[A-Za-z0-9_\-./]+$/.test(v) && v.indexOf('..') === -1) return v;
    return '';
  }
  const link = (v) => { v = text(v, 500); return /^(https?:\/\/|tel:|mailto:|#)/i.test(v) ? v : ''; };
  const list = (v, max, fn) => (Array.isArray(v) ? v : []).slice(0, max).filter((x) => x && typeof x === 'object').map(fn);

  function normalize(c) {
    c = c && typeof c === 'object' ? c : {};
    const ct = c.contacts || {}, cat = c.catalog || {}, srv = c.services || {}, pl = c.playlist || {};
    return {
      contacts: {
        phoneMain: text(ct.phoneMain, 40), phoneMaster: text(ct.phoneMaster, 40),
        address: text(ct.address, 200), addressNote: text(ct.addressNote, 200),
        hours: text(ct.hours, 200), about: text(ct.about, 600),
        vkLink: link(ct.vkLink) || 'https://vk.me/opticasouth',
        maxLink: link(ct.maxLink) || 'https://max.ru/',
      },
      catalog: {
        title: text(cat.title, 120), subtitle: text(cat.subtitle, 300),
        items: list(cat.items, 24, (it) => ({ title: text(it.title, 80), label: text(it.label, 40), image: asset(it.image), link: link(it.link), linkText: text(it.linkText, 60) })),
      },
      services: {
        title: text(srv.title, 120),
        items: list(srv.items, 30, (it) => ({ icon: /^[a-z0-9-]+$/.test(it.icon || '') ? it.icon : 'check', title: text(it.title, 120), text: text(it.text, 300) })),
      },
      playlist: {
        title: text(pl.title, 120), author: text(pl.author, 120),
        videos: list(pl.videos, 200, (it) => ({
          id: /^[A-Za-z0-9_-]{1,40}$/.test(it.id || '') ? it.id : 'v' + randomHex(4),
          title: text(it.title, 160), subtitle: text(it.subtitle, 160),
          duration: /^\d{1,2}(:\d{2}){1,2}$/.test(it.duration || '') ? it.duration : '',
          thumb: asset(it.thumb), src: asset(it.src),
        })),
      },
    };
  }

  const PhpBackend = {
    name: 'php',
    label: 'Сервер',
    csrf: '',

    async call(action, body) {
      let res, data;
      try {
        res = await fetch('api.php?action=' + action, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf },
          body: JSON.stringify(body || {}),
        });
        data = await res.json();
      } catch (e) {
        throw new Error('Нет связи с сервером');
      }
      if (res.status === 401 && ['save', 'upload', 'stats'].includes(action)) onSessionExpired();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Ошибка ' + res.status);
      if (data.csrf) this.csrf = data.csrf;
      return data;
    },

    setup(password, token) { return this.call('setup', { password, token }); },
    login(password) { return this.call('login', { password }); },
    logout() { return this.call('logout').catch(() => {}); },
    changePassword(current, next) { return this.call('password', { current, new: next }); },

    async load() {
      const res = await fetch('../content.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Не удалось загрузить content.json');
      return res.json();
    },

    async save(content) {
      return (await this.call('save', { content })).content;
    },

    maxUpload(kind) {
      return (S.status && S.status.maxUpload && S.status.maxUpload[kind]) || (kind === 'video' ? 500 : 10) * 1048576;
    },

    upload(file, kind, onProgress) {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('kind', kind);
        fd.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'api.php?action=upload');
        xhr.withCredentials = true;
        xhr.setRequestHeader('X-CSRF-Token', this.csrf);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
        xhr.onerror = () => reject(new Error('Обрыв связи при загрузке'));
        xhr.onload = () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          if (xhr.status === 401) onSessionExpired();
          if (xhr.status === 413) return reject(new Error('Файл слишком большой для настроек хостинга'));
          if (xhr.status !== 200 || !data.ok) return reject(new Error(data.error || 'Ошибка загрузки (' + xhr.status + ')'));
          resolve(data.path);
        };
        xhr.send(fd);
      });
    },
  };

  function detectGitHub() {
    const cfg = Object.assign({}, GH_DEFAULT);
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      cfg.owner = m[1];
      const seg = location.pathname.split('/').filter(Boolean)[0];
      cfg.repo = seg && seg !== 'admin' ? seg : m[1] + '.github.io';
    }
    return cfg;
  }

  function ghError(status, data) {
    const msg = (data && data.message) || '';
    if (status === 401) return 'Токен недействителен или истёк';
    if (status === 403 && /rate limit/i.test(msg)) return 'Превышен лимит запросов GitHub, попробуйте позже';
    if (status === 403) return 'У токена нет права записи (нужно Contents: Read and write)';
    if (status === 404) return 'Репозиторий не найден или у токена нет к нему доступа';
    if (status === 409) return 'Конфликт версий файла, попробуйте ещё раз';
    if (status === 413 || status === 422) return msg || 'GitHub отклонил файл (возможно, он слишком большой)';
    return msg || 'Ошибка GitHub ' + status;
  }

  const GhBackend = {
    name: 'github',
    label: 'GitHub',
    token: '',
    sha: null,
    cfg: detectGitHub(),

    async api(path, opts) {
      opts = opts || {};
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + this.token };
      if (opts.body) headers['Content-Type'] = 'application/json';
      let res;
      try {
        res = await fetch(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}${path}`, Object.assign({}, opts, { headers, cache: 'no-store' }));
      } catch (e) {
        throw new Error('Нет связи с GitHub');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(ghError(res.status, data));
        err.status = res.status;
        throw err;
      }
      return data;
    },

    async login(token) {
      this.token = String(token || '').trim();
      if (!/^(github_pat_|ghp_|gho_)[A-Za-z0-9_]+$/.test(this.token)) throw new Error('Это не похоже на токен GitHub');
      const repo = await this.api('');
      if (!repo.permissions || !repo.permissions.push) throw new Error('У этого аккаунта нет права записи в репозиторий');
      this.cfg.branch = repo.default_branch || this.cfg.branch;
      sessionStorage.setItem('optika_gh_token', this.token);
    },

    async logout() {
      this.token = '';
      sessionStorage.removeItem('optika_gh_token');
    },

    async load() {
      if (!this.token) {
        const local = localStorage.getItem('optika_demo_content_v2');
        if (local) {
          try { return JSON.parse(local); } catch (e) {}
        }
        const res = await fetch('../content.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Не удалось загрузить content.json');
        return res.json();
      }
      const data = await this.api('/contents/content.json?ref=' + encodeURIComponent(this.cfg.branch));
      this.sha = data.sha;
      return JSON.parse(b64ToUtf8(data.content));
    },

    async putFile(path, b64, message, sha) {
      const body = { message, content: b64, branch: this.cfg.branch };
      if (sha) body.sha = sha;
      return this.api('/contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
    },

    async save(content) {
      if (!this.token) {
        localStorage.setItem('optika_demo_content_v2', JSON.stringify(content));
        return content;
      }
      const b64 = utf8ToB64(JSON.stringify(content, null, 2) + '\n');
      let res;
      try {
        res = await this.putFile('content.json', b64, 'Обновление контента из админ-панели', this.sha);
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        const fresh = await this.api('/contents/content.json?ref=' + encodeURIComponent(this.cfg.branch));
        res = await this.putFile('content.json', b64, 'Обновление контента из админ-панели', fresh.sha);
      }
      this.sha = res.content.sha;
      return content;
    },

    maxUpload(kind) {
      return kind === 'video' ? GH_MAX_UPLOAD : 10 * 1048576;
    },

    async upload(file, kind, onProgress) {
      onProgress && onProgress(null);
      if (!this.token) {
        const blobUrl = URL.createObjectURL(file);
        const fakePath = `uploads/${kind}-${today()}-${randomHex(4)}.${fileExt(file.name) || (kind === 'image' ? 'jpg' : 'mp4')}`;
        S.previews[fakePath] = blobUrl;
        return fakePath;
      }
      const name = `${kind}-${today()}-${randomHex(8)}.${fileExt(file.name) || (kind === 'image' ? 'jpg' : 'mp4')}`;
      const b64 = await fileToB64(file);
      try {
        await this.putFile('uploads/' + name, b64, 'Загрузка файла ' + name);
      } catch (e) {
        if (e.status !== 409) throw e;
        await new Promise((r) => setTimeout(r, 1500));
        await this.putFile('uploads/' + name, b64, 'Загрузка файла ' + name);
      }
      return 'uploads/' + name;
    },
  };

  function checkFile(file, kind) {
    const allowed = kind === 'video' ? VIDEO_EXT : IMAGE_EXT;
    if (!allowed.includes(fileExt(file.name))) throw new Error('Недопустимый формат. Разрешены: ' + allowed.join(', '));
    const limit = S.backend.maxUpload(kind);
    if (file.size > limit) {
      throw new Error(`Файл ${mb(file.size)} — больше лимита ${mb(limit)}.` + (S.backend.name === 'github' && kind === 'video' ? ' Сожмите видео или разместите его на хостинге и вставьте ссылку.' : ''));
    }
  }

  function saveMediaCache(path, blob) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('OptikaMediaCache', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        };
        req.onsuccess = (e) => {
          const tx = e.target.result.transaction('files', 'readwrite');
          tx.objectStore('files').put(blob, path);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      } catch (e) { resolve(); }
    });
  }

  async function uploadFile(file, kind, progressEl) {
    checkFile(file, kind);
    if (progressEl) progressEl.classList.remove('hidden');
    const bar = progressEl && progressEl.firstElementChild;
    const path = await S.backend.upload(file, kind, (ratio) => {
      if (!progressEl) return;
      progressEl.classList.toggle('indeterminate', ratio == null);
      if (ratio != null) bar.style.width = Math.round(ratio * 100) + '%';
    });
    S.previews[path] = URL.createObjectURL(file);
    await saveMediaCache(path, file);
    return path;
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = h('input', { type: 'file', accept, class: 'hidden' });
      inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
      document.body.append(inp);
      inp.click();
    });
  }

  function probeVideo(source) {
    return new Promise((resolve) => {
      const url = source instanceof File ? URL.createObjectURL(source) : source;
      const v = document.createElement('video');
      let done = false;
      const finish = (res) => {
        if (done) return;
        done = true;
        if (source instanceof File) URL.revokeObjectURL(url);
        resolve(res);
      };
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () => { v.currentTime = Math.min(1.5, (v.duration || 3) / 3); };
      v.onseeked = () => {
        const out = { duration: fmtDuration(v.duration), thumb: null };
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = Math.round(640 * ((v.videoHeight || 9) / (v.videoWidth || 16)));
          canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => finish(Object.assign(out, { thumb: blob })), 'image/jpeg', 0.82);
        } catch (e) {
          finish(out);
        }
      };
      v.onerror = () => finish({ duration: '', thumb: null });
      setTimeout(() => finish({ duration: fmtDuration(v.duration), thumb: null }), 15000);
      v.src = url;
    });
  }

  function setDirty(dirty) {
    S.dirty = dirty;
    const badge = $('#dirty-badge');
    badge.classList.toggle('hidden', !dirty);
    badge.classList.toggle('inline-flex', dirty);
    $('#publish-btn').disabled = !dirty;
  }
  const markDirty = () => setDirty(true);

  function onSessionExpired() {
    toast('Сессия истекла. Войдите снова — изменения не потеряются.', 'error');
    showScreen('login-php');
  }

  async function enterApp() {
    S.content = normalize(await S.backend.load());
    $('#mode-label').textContent = S.backend.name === 'github' ? `GitHub · ${S.backend.cfg.repo}` : 'Сервер';
    $('#mode-dot').className = 'w-1.5 h-1.5 rounded-full ' + (S.backend.name === 'github' ? 'bg-sky-400' : 'bg-emerald-400');
    $('#tab-stats').style.display = S.backend.name === 'php' ? '' : 'none';
    setDirty(false);
    showScreen('app');
    renderPanel();
  }

  async function publish() {
    const btn = $('#publish-btn');
    if (!S.dirty || btn.disabled) return;
    setBusy(btn, true, 'Публикация…');
    try {
      const normalized = normalize(S.content);
      S.content = normalize(await S.backend.save(normalized));
      try {
        localStorage.removeItem('optika_demo_content_v2');
        localStorage.setItem('optika_live_content_v2', JSON.stringify({ ts: Date.now(), content: S.content }));
      } catch (e) {}
      setBusy(btn, false);
      setDirty(false);
      toast('Опубликовано! Изменения уже применены на сайте.', 'success');
      renderPanel();
    } catch (e) {
      setBusy(btn, false);
      $('#publish-btn').disabled = !S.dirty;
      toast(e.message, 'error');
    }
  }

  function input(obj, key, opts) {
    opts = opts || {};
    const el = opts.multiline
      ? h('textarea', { class: 'field resize-y', rows: opts.rows || 3, maxlength: opts.max, placeholder: opts.placeholder })
      : h('input', { class: 'field', type: opts.type || 'text', maxlength: opts.max, placeholder: opts.placeholder });
    el.value = obj[key] == null ? '' : obj[key];
    el.addEventListener('input', () => { obj[key] = el.value; markDirty(); });
    return el;
  }

  const field = (label, control, cls) => h('div', { class: cls || '' }, h('label', { class: 'label' }, label), control);

  function card(title, subtitle, ...children) {
    return h('section', { class: 'card p-5 sm:p-6 flex flex-col gap-5' },
      h('div', {}, h('h2', { class: 'text-lg font-extrabold text-white' }, title), subtitle ? h('p', { class: 'text-sm text-slate-400 mt-0.5' }, subtitle) : null),
      children);
  }

  function itemControls(items, idx) {
    const move = (to) => () => {
      const [it] = items.splice(idx, 1);
      items.splice(to, 0, it);
      markDirty();
      renderPanel();
    };
    return h('div', { class: 'flex sm:flex-col gap-1 flex-shrink-0' },
      h('button', { class: 'icon-btn', title: 'Выше', disabled: idx === 0, onclick: move(idx - 1) }, icon('chevron-up')),
      h('button', { class: 'icon-btn', title: 'Ниже', disabled: idx === items.length - 1, onclick: move(idx + 1) }, icon('chevron-down')),
      h('button', {
        class: 'icon-btn danger', title: 'Удалить',
        onclick: () => {
          if (!confirm('Удалить этот элемент?')) return;
          items.splice(idx, 1);
          markDirty();
          renderPanel();
        },
      }, icon('trash-2')));
  }

  function progressBar() {
    return h('div', { class: 'progress hidden' }, h('div', {}));
  }

  function imageReplacer(obj, key, aspectCls) {
    const img = h('img', { src: assetUrl(obj[key]), alt: '', class: 'w-full h-full object-cover' });
    const prog = progressBar();
    const btn = h('button', {
      type: 'button',
      class: 'absolute inset-x-1.5 bottom-1.5 btn btn-ghost !py-1 !px-2 text-xs bg-black/70 hover:bg-black/90',
      onclick: async () => {
        const file = await pickFile('image/jpeg,image/png,image/webp,image/gif');
        if (!file) return;
        setBusy(btn, true, 'Загрузка…');
        try {
          obj[key] = await uploadFile(file, 'image', prog);
          img.src = assetUrl(obj[key]);
          markDirty();
          toast('Изображение загружено. Не забудьте опубликовать изменения.', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
        setBusy(btn, false);
        prog.classList.add('hidden');
      },
    }, icon('image-up', 'w-3.5 h-3.5'), 'Заменить');
    return h('div', { class: 'flex flex-col gap-1.5 flex-shrink-0' },
      h('div', { class: 'relative rounded-xl overflow-hidden bg-black border border-slate-800 ' + aspectCls }, img, btn), prog);
  }

  function renderVideoAdder() {
    const draft = { file: null, url: '', title: '', subtitle: S.content.playlist.author || '', duration: '', thumbBlob: null, thumbFile: null };
    const preview = h('img', { class: 'w-full h-full object-cover hidden', alt: '' });
    const previewBox = h('div', { class: 'relative w-full sm:w-56 aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0' }, icon('film', 'w-8 h-8'), preview);
    const fileLabel = h('div', { class: 'text-sm text-slate-300 font-semibold' }, 'Перетащите видео сюда или нажмите, чтобы выбрать');
    const limitNote = h('div', { class: 'text-xs text-slate-500 mt-1' }, `MP4, WebM, MOV · до ${mb(S.backend.maxUpload('video'))}`);
    const titleIn = h('input', { class: 'field', maxlength: 160, placeholder: 'Например: Изготовление очков за 1 день' });
    const subIn = h('input', { class: 'field', maxlength: 160 });
    const durIn = h('input', { class: 'field text-center', maxlength: 8, placeholder: '1:30' });
    const urlIn = h('input', { class: 'field', placeholder: 'https://…/video.mp4' });
    const prog = progressBar();
    const status = h('div', { class: 'text-xs text-slate-400 hidden' });
    subIn.value = draft.subtitle;

    function setPreview(blobOrUrl) {
      if (!blobOrUrl) return;
      preview.src = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
      preview.classList.remove('hidden');
    }

    async function useFile(file) {
      try { checkFile(file, 'video'); } catch (e) { toast(e.message, 'error'); return; }
      draft.file = file;
      draft.url = '';
      urlIn.value = '';
      fileLabel.textContent = `${file.name} · ${mb(file.size)}`;
      if (!titleIn.value.trim()) titleIn.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const info = await probeVideo(file);
      if (info.duration) durIn.value = info.duration;
      if (info.thumb && !draft.thumbFile) { draft.thumbBlob = info.thumb; setPreview(info.thumb); }
    }

    const fileInput = h('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime,.m4v', class: 'hidden', onchange: () => fileInput.files[0] && useFile(fileInput.files[0]) });
    const drop = h('div', { class: 'dropzone p-6 text-center cursor-pointer', onclick: () => fileInput.click() },
      h('div', { class: 'w-12 h-12 mx-auto mb-3 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center' }, icon('upload-cloud', 'w-6 h-6')),
      fileLabel, limitNote, fileInput);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && useFile(e.dataTransfer.files[0]));

    urlIn.addEventListener('change', async () => {
      const url = urlIn.value.trim();
      if (!url) return;
      if (!asset(url)) { toast('Ссылка должна начинаться с https://', 'error'); return; }
      draft.url = url;
      draft.file = null;
      fileLabel.textContent = 'Используется ссылка на видео';
      const info = await probeVideo(url);
      if (info.duration) durIn.value = info.duration;
      if (info.thumb && !draft.thumbFile) { draft.thumbBlob = info.thumb; setPreview(info.thumb); }
    });

    const thumbBtn = h('button', {
      type: 'button', class: 'btn btn-ghost text-xs',
      onclick: async () => {
        const f = await pickFile('image/jpeg,image/png,image/webp');
        if (!f) return;
        try { checkFile(f, 'image'); } catch (e) { toast(e.message, 'error'); return; }
        draft.thumbFile = f;
        setPreview(f);
      },
    }, icon('image', 'w-4 h-4'), 'Своя обложка');

    const addBtn = h('button', {
      type: 'button', class: 'btn btn-primary py-3',
      onclick: async () => {
        const title = titleIn.value.trim();
        if (!draft.file && !draft.url) return toast('Выберите видеофайл или вставьте ссылку', 'error');
        if (!title) return toast('Укажите название видео', 'error');
        setBusy(addBtn, true, 'Загрузка…');
        status.classList.remove('hidden');
        try {
          let src = draft.url;
          if (draft.file) {
            status.textContent = 'Загружаем видео…';
            src = await uploadFile(draft.file, 'video', prog);
          }
          let thumb = '';
          const thumbFile = draft.thumbFile || (draft.thumbBlob ? new File([draft.thumbBlob], 'thumb.jpg', { type: 'image/jpeg' }) : null);
          if (thumbFile) {
            status.textContent = 'Загружаем обложку…';
            thumb = await uploadFile(thumbFile, 'image', prog);
          }
          S.content.playlist.videos.unshift({ id: 'v' + randomHex(4), title, subtitle: subIn.value.trim(), duration: durIn.value.trim(), thumb, src });
          markDirty();
          toast('Видео добавлено. Нажмите «Опубликовать», чтобы оно появилось на сайте.', 'success');
          renderPanel();
        } catch (e) {
          toast(e.message, 'error');
          setBusy(addBtn, false);
          status.classList.add('hidden');
          prog.classList.add('hidden');
        }
      },
    }, icon('plus', 'w-4 h-4'), 'Добавить в плейлист');

    return card('Добавить видео', 'Длительность и обложка определяются автоматически из файла',
      drop,
      h('div', { class: 'flex items-center gap-3 text-xs text-slate-500' }, h('div', { class: 'h-px bg-slate-800 flex-1' }), 'или ссылка на .mp4', h('div', { class: 'h-px bg-slate-800 flex-1' })),
      urlIn,
      h('div', { class: 'flex flex-col sm:flex-row gap-5' },
        h('div', { class: 'flex flex-col gap-2' }, previewBox, thumbBtn),
        h('div', { class: 'flex-1 grid grid-cols-3 gap-4 content-start' },
          field('Название *', titleIn, 'col-span-3'),
          field('Подпись', subIn, 'col-span-2'),
          field('Длительность', durIn))),
      prog, status, addBtn);
  }

  function renderVideoItem(v, idx, items) {
    return h('div', { class: 'flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800' },
      h('div', { class: 'w-full sm:w-48' }, imageReplacer(v, 'thumb', 'aspect-video')),
      h('div', { class: 'flex-1 min-w-0 grid grid-cols-3 gap-3 content-start' },
        field('Название', input(v, 'title', { max: 160 }), 'col-span-3'),
        field('Подпись', input(v, 'subtitle', { max: 160 }), 'col-span-2'),
        field('Длительность', input(v, 'duration', { max: 8 })),
        h('div', { class: 'col-span-3 flex items-center gap-2 text-xs text-slate-500 min-w-0' },
          icon('link', 'w-3.5 h-3.5 flex-shrink-0'),
          h('a', { href: assetUrl(v.src), target: '_blank', rel: 'noopener', class: 'truncate hover:text-sky-400' }, v.src || 'нет источника'))),
      itemControls(items, idx));
  }

  function renderVideos(panel) {
    const pl = S.content.playlist;
    panel.append(
      card('Плейлист', 'Заголовок и подпись над списком видео',
        h('div', { class: 'grid sm:grid-cols-2 gap-4' }, field('Заголовок', input(pl, 'title', { max: 120 })), field('Подпись канала', input(pl, 'author', { max: 120 })))),
      renderVideoAdder(),
      card(`Видео в плейлисте · ${pl.videos.length}`, 'Первое видео в списке открывается в плеере по умолчанию',
        pl.videos.length
          ? pl.videos.map((v, i) => renderVideoItem(v, i, pl.videos))
          : h('div', { class: 'text-center text-slate-500 py-8' }, 'Видео пока нет')));
  }

  function renderCatalog(panel) {
    const cat = S.content.catalog;
    panel.append(
      card('Заголовок блока', 'Первый экран сайта',
        field('Заголовок', input(cat, 'title', { max: 120 })),
        field('Подзаголовок', input(cat, 'subtitle', { max: 300, multiline: true, rows: 2 }))),
      card(`Плитки каталога · ${cat.items.length}`, 'Рекомендуемый размер фото — вертикальное, от 600×800 px',
        cat.items.map((it, i) => h('div', { class: 'flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800' },
          h('div', { class: 'w-32' }, imageReplacer(it, 'image', 'aspect-[3/4]')),
          h('div', { class: 'flex-1 grid sm:grid-cols-2 gap-3 content-start' },
            field('Название', input(it, 'title', { max: 80 })),
            field('Метка (над названием)', input(it, 'label', { max: 40 })),
            field('Ссылка', input(it, 'link', { max: 500, placeholder: 'https://…' })),
            field('Текст ссылки', input(it, 'linkText', { max: 60 }))),
          itemControls(cat.items, i))),
        h('button', {
          class: 'btn btn-ghost self-start',
          onclick: () => {
            cat.items.push({ title: 'Новая плитка', label: 'Оптика', image: '', link: 'https://vk.ru/opticasouth', linkText: 'Смотреть в ВК' });
            markDirty();
            renderPanel();
          },
        }, icon('plus'), 'Добавить плитку')));
  }

  function renderServices(panel) {
    const srv = S.content.services;
    panel.append(
      card('Заголовок блока', null, field('Заголовок', input(srv, 'title', { max: 120 }))),
      card(`Услуги · ${srv.items.length}`, null,
        srv.items.map((it, i) => {
          const select = h('select', {
            class: 'field',
            onchange: (e) => { it.icon = e.target.value; markDirty(); renderPanel(); },
          }, ICONS.concat(ICONS.includes(it.icon) ? [] : [it.icon]).map((name) => h('option', { value: name, selected: name === it.icon }, name)));
          return h('div', { class: 'flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800' },
            h('div', { class: 'flex sm:flex-col items-center gap-3 sm:w-36' },
              h('div', { class: 'w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center flex-shrink-0' }, icon(it.icon, 'w-6 h-6')),
              field('Иконка', select, 'flex-1 w-full')),
            h('div', { class: 'flex-1 flex flex-col gap-3' },
              field('Название', input(it, 'title', { max: 120 })),
              field('Описание', input(it, 'text', { max: 300, multiline: true, rows: 2 }))),
            itemControls(srv.items, i));
        }),
        h('button', {
          class: 'btn btn-ghost self-start',
          onclick: () => { srv.items.push({ icon: 'check', title: 'Новая услуга', text: '' }); markDirty(); renderPanel(); },
        }, icon('plus'), 'Добавить услугу')));
  }

  function renderContacts(panel) {
    const c = S.content.contacts;
    panel.append(card('Контакты', 'Обновляются в шапке, меню, подвале и кнопке «Позвонить»',
      h('div', { class: 'grid sm:grid-cols-2 gap-4' },
        field('Телефон оптики', input(c, 'phoneMain', { max: 40, type: 'tel' })),
        field('Телефон мастера', input(c, 'phoneMaster', { max: 40, type: 'tel' })),
        field('Адрес', input(c, 'address', { max: 200 })),
        field('Уточнение к адресу', input(c, 'addressNote', { max: 200 })),
        field('Ссылка на диалог ВК (для кнопки «Записаться»)', input(c, 'vkLink', { max: 300, placeholder: 'https://vk.me/opticasouth' })),
        field('Ссылка на мессенджер MAX (для кнопки «Записаться»)', input(c, 'maxLink', { max: 300, placeholder: 'https://max.ru/...' })),
        field('График работы', input(c, 'hours', { max: 200 }), 'sm:col-span-2'),
        field('Текст о салоне (в подвале)', input(c, 'about', { max: 600, multiline: true }), 'sm:col-span-2'))));
  }

  function renderSettings(panel) {
    const b = S.backend;
    const st = S.status || {};
    const warnings = [];
    if (b.name === 'php') {
      if (!st.https) warnings.push('Админка открыта без HTTPS — пароль передаётся незашифрованным. Подключите SSL-сертификат на хостинге.');
      if (st.writable && !st.writable.content) warnings.push('Нет прав на запись в content.json — сохранение не сработает.');
      if (st.writable && !st.writable.uploads) warnings.push('Нет прав на запись в папку uploads — загрузка файлов не сработает.');
    }

    panel.append(card('Режим работы', null,
      h('div', { class: 'flex items-start gap-3 text-sm text-slate-300 leading-relaxed' },
        icon(b.name === 'github' ? 'git-branch' : 'server', 'w-5 h-5 mt-0.5 text-sky-400 flex-shrink-0'),
        b.name === 'github'
          ? h('div', {}, 'Изменения сохраняются коммитами в репозиторий ', h('b', {}, `${b.cfg.owner}/${b.cfg.repo}`), ` (ветка ${b.cfg.branch}). После публикации GitHub Pages обновляет сайт примерно за минуту.`)
          : h('div', {}, 'Изменения сохраняются напрямую на сервере и сразу видны на сайте. Перед каждым сохранением делается резервная копия (последние 20).')),
      warnings.map((w) => h('div', { class: 'flex gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3' }, icon('alert-triangle', 'w-4 h-4 mt-0.5 flex-shrink-0'), w))));

    if (b.name === 'php') {
      const cur = h('input', { type: 'password', class: 'field', autocomplete: 'current-password' });
      const n1 = h('input', { type: 'password', class: 'field', autocomplete: 'new-password', minlength: 10 });
      const n2 = h('input', { type: 'password', class: 'field', autocomplete: 'new-password', minlength: 10 });
      const btn = h('button', { type: 'submit', class: 'btn btn-primary self-start' }, icon('key-round'), 'Сменить пароль');
      const form = h('form', {
        class: 'flex flex-col gap-4',
        onsubmit: async (e) => {
          e.preventDefault();
          if (n1.value.length < 10) return toast('Новый пароль должен быть не короче 10 символов', 'error');
          if (n1.value !== n2.value) return toast('Новые пароли не совпадают', 'error');
          setBusy(btn, true, 'Сохранение…');
          try {
            await b.changePassword(cur.value, n1.value);
            form.reset();
            toast('Пароль изменён', 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
          setBusy(btn, false);
        },
      }, h('div', { class: 'grid sm:grid-cols-3 gap-4' }, field('Текущий пароль', cur), field('Новый пароль', n1), field('Повторите новый', n2)), btn);
      panel.append(card('Пароль администратора', 'Минимум 10 символов. Используйте фразу из нескольких слов.', form));
    }

    const importBtn = h('button', {
      class: 'btn btn-ghost',
      onclick: async () => {
        const f = await pickFile('application/json,.json');
        if (!f) return;
        try {
          S.content = normalize(JSON.parse(await f.text()));
          markDirty();
          toast('Резервная копия загружена. Проверьте данные и нажмите «Опубликовать».', 'success');
          renderPanel();
        } catch (e) {
          toast('Не удалось прочитать файл резервной копии', 'error');
        }
      },
    }, icon('upload'), 'Восстановить из файла');

    panel.append(card('Резервная копия', 'Скачайте весь контент сайта одним файлом или восстановите его',
      h('div', { class: 'flex flex-wrap gap-3' },
        h('button', {
          class: 'btn btn-ghost',
          onclick: () => {
            const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(normalize(S.content), null, 2)], { type: 'application/json' })), download: `content-${today()}.json` });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          },
        }, icon('download'), 'Скачать content.json'),
        importBtn)));
  }

  const DEVICE_LABELS = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер' };
  const DEVICE_ICONS = { mobile: 'smartphone', tablet: 'tablet', desktop: 'monitor' };
  const fmtNum = (n) => Number(n || 0).toLocaleString('ru-RU');
  const fmtDateTime = (ts) => new Date(ts * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtAgo = (sec) => (sec < 60 ? sec + ' сек' : sec < 3600 ? Math.floor(sec / 60) + ' мин' : Math.floor(sec / 3600) + ' ч ' + Math.floor((sec % 3600) / 60) + ' мин');
  let statsTimer = null;

  function statTile(label, value, sub, color) {
    return h('div', { class: 'card p-5' },
      h('div', { class: 'label !mb-2' }, label),
      h('div', { class: 'text-3xl font-extrabold tabular-nums ' + (color || 'text-white') }, fmtNum(value)),
      sub ? h('div', { class: 'text-xs text-slate-500 mt-1' }, sub) : null);
  }

  function visitsTable(rows, cols) {
    if (!rows.length) return h('div', { class: 'text-center text-slate-500 py-8' }, 'Пока нет данных');
    return h('div', { class: 'overflow-x-auto -mx-1' },
      h('table', { class: 'w-full text-sm' },
        h('thead', {}, h('tr', { class: 'text-left text-xs uppercase tracking-wider text-slate-500' }, cols.map((c) => h('th', { class: 'px-3 py-2 font-bold whitespace-nowrap' }, c.title)))),
        h('tbody', {}, rows.map((r) => h('tr', { class: 'border-t border-slate-800 text-slate-300' }, cols.map((c) => h('td', { class: 'px-3 py-2 whitespace-nowrap' }, c.cell(r))))))));
  }

  function renderStatsBody(box, st) {
    box.innerHTML = '';
    const total = st.devices.mobile + st.devices.tablet + st.devices.desktop;
    const maxDay = Math.max(1, ...st.days.map((d) => Math.max(d.views, d.uniq)));
    const deviceCell = (r) => h('span', { class: 'inline-flex items-center gap-1.5' }, icon(DEVICE_ICONS[r.device] || 'monitor', 'w-3.5 h-3.5 text-slate-400'), DEVICE_LABELS[r.device] || r.device);

    box.append(
      h('div', { class: 'grid grid-cols-2 lg:grid-cols-4 gap-4' },
        h('div', { class: 'card p-5 border-emerald-500/40' },
          h('div', { class: 'label !mb-2 flex items-center gap-2' }, h('span', { class: 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' }), 'Сейчас на сайте'),
          h('div', { class: 'text-3xl font-extrabold tabular-nums text-emerald-400' }, fmtNum(st.online)),
          h('div', { class: 'text-xs text-slate-500 mt-1' }, 'активны последнюю минуту')),
        statTile('Сегодня', st.today.uniq, `уникальных · ${fmtNum(st.today.views)} просмотров`),
        statTile('За 7 дней', st.week.uniq, `уникальных · ${fmtNum(st.week.views)} просмотров`),
        statTile('За 30 дней', st.month.uniq, `уникальных · ${fmtNum(st.month.views)} просмотров`)),
      h('div', { class: 'grid lg:grid-cols-3 gap-6' },
        card('Посещаемость за 14 дней', 'Синие — уникальные посетители, серые — просмотры',
          h('div', { class: 'flex items-end gap-1.5 h-40' }, st.days.map((d) => h('div', { class: 'flex-1 flex flex-col justify-end items-center gap-1 h-full min-w-0', title: `${d.date}: ${d.uniq} уник., ${d.views} просм.` },
            h('div', { class: 'w-full flex items-end justify-center gap-0.5 flex-1' },
              h('div', { class: 'w-1/2 bg-slate-600 rounded-t', style: `height:${Math.max(2, d.views / maxDay * 100)}%` }),
              h('div', { class: 'w-1/2 bg-sky-500 rounded-t', style: `height:${Math.max(2, d.uniq / maxDay * 100)}%` })),
            h('div', { class: 'text-[10px] text-slate-500' }, d.date.slice(8)))))),
        card('Устройства', 'Уникальные посетители за всё время сбора',
          Object.keys(DEVICE_LABELS).map((k) => {
            const pct = total ? Math.round(st.devices[k] / total * 100) : 0;
            return h('div', {},
              h('div', { class: 'flex justify-between text-sm mb-1' }, h('span', { class: 'inline-flex items-center gap-2 text-slate-300' }, icon(DEVICE_ICONS[k], 'w-4 h-4'), DEVICE_LABELS[k]), h('span', { class: 'text-slate-400 tabular-nums' }, `${fmtNum(st.devices[k])} · ${pct}%`)),
              h('div', { class: 'progress' }, h('div', { style: `width:${pct}%` })));
          }),
          h('div', { class: 'text-xs text-slate-500 pt-2 border-t border-slate-800' }, `Всего уникальных за всё время: ${fmtNum(st.total.uniq)} · просмотров: ${fmtNum(st.total.views)}`))),
      card(`Сейчас на сайте · ${st.online}`, null, visitsTable(st.onlineList, [
        { title: 'IP', cell: (r) => r.ip },
        { title: 'Устройство', cell: deviceCell },
        { title: 'Система', cell: (r) => `${r.os} · ${r.browser}` },
        { title: 'Страница', cell: (r) => r.path },
        { title: 'На сайте', cell: (r) => fmtAgo(Math.max(0, st.now - r.since)) },
      ])),
      card('Последние визиты', `Хранятся ${st.visitsDays} дней, затем удаляются автоматически`, visitsTable(st.visits, [
        { title: 'Время', cell: (r) => fmtDateTime(r.t) },
        { title: 'IP', cell: (r) => r.ip },
        { title: 'Устройство', cell: deviceCell },
        { title: 'Система', cell: (r) => `${r.os} · ${r.browser}` },
        { title: 'Источник', cell: (r) => r.ref || 'прямой заход' },
      ])));
    refreshIcons();
  }

  function renderStats(panel) {
    const box = h('div', { class: 'flex flex-col gap-6' }, h('div', { class: 'text-slate-400 flex items-center gap-2' }, icon('loader-2', 'w-4 h-4 animate-spin'), 'Загрузка статистики…'));
    panel.append(box);
    const load = async () => {
      if (S.tab !== 'stats') return;
      try {
        renderStatsBody(box, (await S.backend.call('stats')).stats);
      } catch (e) {
        box.innerHTML = '';
        box.append(h('div', { class: 'text-rose-300' }, e.message));
      }
    };
    load();
    statsTimer = setInterval(load, 10000);
  }

  const TABS = { videos: renderVideos, catalog: renderCatalog, services: renderServices, contacts: renderContacts, stats: renderStats, settings: renderSettings };

  function renderPanel() {
    const panel = $('#panel');
    clearInterval(statsTimer);
    if (S.tab === 'stats' && S.backend.name !== 'php') S.tab = 'videos';
    panel.innerHTML = '';
    TABS[S.tab](panel);
    document.querySelectorAll('.tab-link').forEach((t) => t.classList.toggle('active', t.dataset.tab === S.tab));
    refreshIcons();
  }

  document.querySelectorAll('.tab-link').forEach((btn) => btn.addEventListener('click', () => {
    S.tab = btn.dataset.tab;
    $('#sidebar').classList.remove('mobile-open');
    renderPanel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));

  $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
  $('#publish-btn').addEventListener('click', publish);

  $('#logout-btn').addEventListener('click', async () => {
    if (S.dirty && !confirm('Есть неопубликованные изменения. Выйти без сохранения?')) return;
    S.dirty = false;
    await S.backend.logout();
    location.reload();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && $('#screen-app').classList.contains('active')) {
      e.preventDefault();
      publish();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, btn = $('button[type=submit]', form);
    const p1 = $('#setup-pass').value, p2 = $('#setup-pass2').value;
    if (p1.length < 10) return formError(form, 'Пароль должен быть не короче 10 символов');
    if (p1 !== p2) return formError(form, 'Пароли не совпадают');
    formError(form, '');
    setBusy(btn, true, 'Сохранение…');
    try {
      await PhpBackend.setup(p1, $('#setup-token').value);
      await enterApp();
    } catch (err) {
      formError(form, err.message);
    }
    setBusy(btn, false);
  });

  $('#login-php-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, btn = $('button[type=submit]', form);
    formError(form, '');
    setBusy(btn, true, 'Проверка…');
    try {
      await PhpBackend.login($('#login-pass').value);
      $('#login-pass').value = '';
      if (S.content) {
        showScreen('app');
        renderPanel();
      } else {
        await enterApp();
      }
    } catch (err) {
      formError(form, err.message);
    }
    setBusy(btn, false);
  });

  $('#login-gh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, btn = $('button[type=submit]', form);
    formError(form, '');
    setBusy(btn, true, 'Проверка…');
    try {
      await GhBackend.login($('#gh-token').value);
      $('#gh-token').value = '';
      await enterApp();
    } catch (err) {
      formError(form, err.message);
    }
    setBusy(btn, false);
  });

  const demoGhBtn = $('#demo-gh-btn');
  if (demoGhBtn) {
    demoGhBtn.addEventListener('click', async () => {
      S.backend = GhBackend;
      GhBackend.token = '';
      await enterApp();
    });
  }

  async function detectPhp() {
    try {
      const res = await fetch('api.php?action=status', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) return null;
      const data = await res.json();
      return data && data.backend === 'php' ? data : null;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    const status = await detectPhp();
    if (status) {
      S.backend = PhpBackend;
      S.status = status;
      PhpBackend.csrf = status.csrf;
      if (!status.configured) return showScreen('setup');
      if (!status.authed) return showScreen('login-php');
      try { return await enterApp(); } catch (e) { toast(e.message, 'error'); return showScreen('login-php'); }
    }

    S.backend = GhBackend;
    $('#gh-repo-label').textContent = `${GhBackend.cfg.owner}/${GhBackend.cfg.repo}`;
    const saved = sessionStorage.getItem('optika_gh_token');
    if (saved) {
      try {
        await GhBackend.login(saved);
        return await enterApp();
      } catch (e) {
        sessionStorage.removeItem('optika_gh_token');
        toast(e.message, 'error');
      }
    }
    showScreen('login-gh');
  }

  init();
})();
