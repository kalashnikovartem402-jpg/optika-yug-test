(function () {
  var started = false;
  function addScript(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
  function initAnalytics() {
    if (started) return;
    started = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    window.ym(97127332, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
    addScript('https://mc.yandex.ru/metrika/tag.js');
  }
  var events = ['scroll', 'mousemove', 'touchstart', 'click', 'keydown'];
  function onInteract() {
    initAnalytics();
    events.forEach(function (e) { window.removeEventListener(e, onInteract, { passive: true }); });
  }
  events.forEach(function (e) { window.addEventListener(e, onInteract, { passive: true, once: true }); });
  if ('requestIdleCallback' in window) { requestIdleCallback(function () { setTimeout(initAnalytics, 3500); }); } else { setTimeout(initAnalytics, 4000); }
})();

(function () {
  var badge, counter, first = true, timer;
  function ping() {
    if (document.hidden) return;
    var payload = JSON.stringify({ path: location.pathname, ref: document.referrer, first: first });
    first = false;
    fetch('/track.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, credentials: 'same-origin', keepalive: true })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !d.online || !badge) return;
        counter.textContent = d.online;
        badge.hidden = false;
      })
      .catch(function () {});
  }
  document.addEventListener('DOMContentLoaded', function () {
    badge = document.getElementById('online-badge');
    counter = document.getElementById('online-count');
    ping();
    timer = setInterval(ping, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  });
})();

document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  if (window.lucide) lucide.createIcons();
  var headerInner = document.getElementById('header-inner');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 20) {
      headerInner.classList.add('header-scrolled');
    } else {
      headerInner.classList.remove('header-scrolled');
    }
  }, { passive: true });
  var burgerBtn = document.getElementById('burger-btn');
  var mobileMenu = document.getElementById('mobile-menu');
  burgerBtn.addEventListener('click', function () {
    var isOpen = mobileMenu.classList.contains('open');
    if (isOpen) {
      mobileMenu.classList.remove('open');
      mobileMenu.classList.add('hidden');
      burgerBtn.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    } else {
      mobileMenu.classList.remove('hidden');
      requestAnimationFrame(function () {
        mobileMenu.classList.add('open');
      });
      burgerBtn.classList.add('open');
      burgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  });
  document.querySelectorAll('.mobile-nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
      mobileMenu.classList.add('hidden');
      burgerBtn.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabPanels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.tab;
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var targetPanel = document.querySelector('.tab-panel[data-panel="' + target + '"]');
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
  var callbackModal = document.getElementById('callback-modal');
  var thankyouModal = document.getElementById('thankyou-modal');
  var bookingPhoneInput = document.getElementById('callback-phone');
  var bookingNameInput = document.getElementById('callback-name');
  var bookingErrorEl = document.getElementById('booking-error');
  var bookingCopiedEl = document.getElementById('booking-copied-notice');

  function formatRussianPhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits[0] === '8' || digits[0] === '7') {
      digits = '7' + digits.slice(1);
    } else if (digits[0] === '9') {
      digits = '7' + digits;
    } else {
      digits = '7' + digits;
    }
    digits = digits.slice(0, 11);
    var out = '+7';
    if (digits.length > 1) out += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) out += ') ' + digits.slice(4, 7);
    if (digits.length >= 7) out += '-' + digits.slice(7, 9);
    if (digits.length >= 9) out += '-' + digits.slice(9, 11);
    return out;
  }

  function isValidRussianPhone(val) {
    var digits = String(val || '').replace(/\D/g, '');
    return digits.length === 11 && (digits[0] === '7' || digits[0] === '8') && digits[1] !== '0';
  }

  if (bookingPhoneInput) {
    bookingPhoneInput.addEventListener('input', function () {
      var formatted = formatRussianPhone(bookingPhoneInput.value);
      bookingPhoneInput.value = formatted;
      bookingPhoneInput.classList.remove('border-rose-400', 'bg-rose-50/40');
      if (isValidRussianPhone(formatted)) {
        bookingPhoneInput.classList.add('border-emerald-400');
      } else {
        bookingPhoneInput.classList.remove('border-emerald-400');
      }
      if (bookingErrorEl) bookingErrorEl.classList.add('hidden');
    });
    bookingPhoneInput.addEventListener('focus', function () {
      if (!bookingPhoneInput.value) bookingPhoneInput.value = '+7 (';
    });
    bookingPhoneInput.addEventListener('blur', function () {
      if (bookingPhoneInput.value === '+7 (' || bookingPhoneInput.value === '+7') {
        bookingPhoneInput.value = '';
      }
    });
  }

  if (bookingNameInput) {
    bookingNameInput.addEventListener('input', function () {
      bookingNameInput.classList.remove('border-rose-400', 'bg-rose-50/40');
      if (bookingErrorEl) bookingErrorEl.classList.add('hidden');
    });
  }

  function copyTextCompat(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  window.openCallbackModal = function () {
    if (bookingErrorEl) bookingErrorEl.classList.add('hidden');
    if (bookingCopiedEl) bookingCopiedEl.classList.add('hidden');
    callbackModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      var nameInput = document.getElementById('callback-name');
      if (nameInput) nameInput.focus();
    }, 200);
  };
  window.closeCallbackModal = function () {
    callbackModal.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.closeThankYouModal = function () {
    thankyouModal.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.submitBookingMessenger = function (channel) {
    var nameEl = document.getElementById('callback-name');
    var phoneEl = document.getElementById('callback-phone');
    var msgEl = document.getElementById('callback-message');
    var name = nameEl ? nameEl.value.trim() : '';
    var phone = phoneEl ? phoneEl.value.trim() : '';
    var msg = msgEl ? msgEl.value.trim() : '';

    if (name.length < 2) {
      if (bookingErrorEl) {
        bookingErrorEl.textContent = 'Пожалуйста, укажите ваше имя (минимум 2 буквы)';
        bookingErrorEl.classList.remove('hidden');
      }
      if (nameEl) {
        nameEl.classList.add('border-rose-400', 'bg-rose-50/40');
        nameEl.focus();
      }
      return;
    }

    if (!isValidRussianPhone(phone)) {
      if (bookingErrorEl) {
        bookingErrorEl.textContent = 'Введите полный номер телефона из 11 цифр: +7 (999) 000-00-00';
        bookingErrorEl.classList.remove('hidden');
      }
      if (phoneEl) {
        phoneEl.classList.add('border-rose-400', 'bg-rose-50/40');
        phoneEl.focus();
      }
      return;
    }

    var consentEl = document.getElementById('callback-consent');
    if (!consentEl || !consentEl.checked) {
      if (bookingErrorEl) {
        bookingErrorEl.textContent = 'Для отправки заявки необходимо согласие на обработку персональных данных';
        bookingErrorEl.classList.remove('hidden');
      }
      if (consentEl) consentEl.focus();
      return;
    }

    if (bookingErrorEl) bookingErrorEl.classList.add('hidden');

    var text = 'Здравствуйте! Хочу записаться в «Оптику Юг».\n' +
      'Имя: ' + name + '\n' +
      'Телефон: ' + phone +
      (msg ? '\nВопрос/услуга: ' + msg : '');

    copyTextCompat(text);
    if (bookingCopiedEl) bookingCopiedEl.classList.remove('hidden');

    var payload = { name: name, phone: phone, message: (msg ? msg + ' ' : '') + '[' + channel.toUpperCase() + ']' };
    var sendOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    };
    fetch('./send.php', sendOpts).then(function (res) {
      if (res.status === 404) return fetch('./api/send', sendOpts);
    }).catch(function () {});

    var contacts = (window.OptikaContent && window.OptikaContent.contacts) || {};
    var baseTargetUrl = channel === 'max'
      ? (contacts.maxLink || 'https://max.ru/')
      : (contacts.vkLink || 'https://vk.me/opticasouth');

    var sep = baseTargetUrl.indexOf('?') === -1 ? '?' : '&';
    var targetUrl = baseTargetUrl + sep + 'text=' + encodeURIComponent(text);

    window.open(targetUrl, '_blank', 'noopener');
  };
  callbackModal.addEventListener('click', function (e) {
    if (e.target === callbackModal) closeCallbackModal();
  });
  thankyouModal.addEventListener('click', function (e) {
    if (e.target === thankyouModal) closeThankYouModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeCallbackModal();
      closeThankYouModal();
      if (mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        mobileMenu.classList.add('hidden');
        burgerBtn.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });
  function handleFormSubmit(form, submitBtn, extraAction) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var originalText = submitBtn.textContent.trim();
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
      submitBtn.textContent = 'Отправка...';
      var formData = new FormData(form);
      var payload = {};
      formData.forEach(function (val, key) { payload[key] = val; });
      function attemptSend(endpoint, isJson) {
        var opts = { method: 'POST' };
        if (isJson) {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = JSON.stringify(payload);
        } else {
          opts.body = formData;
        }
        return fetch(endpoint, opts);
      }
      attemptSend('./api/send', true)
        .then(function (res) {
          if (res.status === 404) return attemptSend('./send.php', false);
          return res;
        })
        .then(function (res) {
          return res.json().catch(function () { return { status: 'ok' }; });
        })
        .catch(function () { return { status: 'ok' }; })
        .finally(function () {
          form.reset();
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-loading');
          submitBtn.textContent = originalText;
          if (extraAction) extraAction();
          thankyouModal.classList.add('open');
          document.body.style.overflow = 'hidden';
          var circle = thankyouModal.querySelector('.checkmark-circle');
          var path = thankyouModal.querySelector('.checkmark-path');
          if (circle && path) {
            circle.style.animation = 'none';
            path.style.animation = 'none';
            requestAnimationFrame(function () {
              circle.style.animation = '';
              path.style.animation = '';
            });
          }
        });
    }, true);
  }
  var callbackForm = document.getElementById('callback-form');
  var callbackSubmitBtn = document.getElementById('callback-form-submit');
  if (callbackForm && callbackSubmitBtn) {
    handleFormSubmit(callbackForm, callbackSubmitBtn, function () {
      closeCallbackModal();
    });
  }
  var mainForm = document.getElementById('contact-form-main');
  var mainSubmitBtn = document.getElementById('main-form-submit');
  if (mainForm && mainSubmitBtn) {
    handleFormSubmit(mainForm, mainSubmitBtn, null);
  }

  var videoEl = document.getElementById('main-video-el');
  var overlayEl = document.getElementById('video-overlay-controls');
  var bottomBarEl = document.getElementById('vid-bottom-bar');
  var topTitleEl = document.getElementById('vid-top-title');
  var spinnerEl = document.getElementById('vid-spinner');
  var seekToastEl = document.getElementById('vid-seek-toast');
  var playBtn = document.getElementById('vid-play-btn');
  var playIcon = document.getElementById('vid-play-icon');
  var pauseIcon = document.getElementById('vid-pause-icon');
  var prevBtn = document.getElementById('vid-prev-btn');
  var nextBtn = document.getElementById('vid-next-btn');
  var muteBtn = document.getElementById('vid-mute-btn');
  var volOnIcon = document.getElementById('vol-on-icon');
  var volOffIcon = document.getElementById('vol-off-icon');
  var volRange = document.getElementById('vid-volume-range');
  var speedBtn = document.getElementById('vid-speed-btn');
  var pipBtn = document.getElementById('vid-pip-btn');
  var fsBtn = document.getElementById('vid-fs-btn');
  var curTimeEl = document.getElementById('vid-current-time');
  var totTimeEl = document.getElementById('vid-total-time');
  var progWrap = document.getElementById('vid-progress-wrap');
  var progBar = document.getElementById('vid-progress-bar');
  var progThumb = document.getElementById('vid-progress-thumb');
  var bufferBar = document.getElementById('vid-buffer-bar');
  var hoverTimeEl = document.getElementById('vid-hover-time');
  var plTitleEl = document.getElementById('pl-header-title');
  var plAuthorEl = document.getElementById('pl-header-author');
  var plCounterEl = document.getElementById('pl-counter');
  var plItemsEl = document.getElementById('pl-items-container');
  var plLoopBtn = document.getElementById('pl-loop-btn');
  var plShuffleBtn = document.getElementById('pl-shuffle-btn');
  var playerBox = document.getElementById('custom-player-box');

  if (videoEl && plItemsEl) {
    var playlist = [];
    var currentIndex = 0;
    var isLoop = true;
    var isShuffle = false;
    var isDragging = false;
    var wasPlayingBeforeDrag = false;
    var hideControlsTimer = null;
    var speeds = [0.75, 1, 1.25, 1.5, 2];
    var speedIdx = 1;

    function fmtTime(sec) {
      if (!sec || isNaN(sec) || sec < 0) return '0:00';
      var m = Math.floor(sec / 60);
      var s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    var esc = window.OptikaContent.esc;
    var safeAsset = window.OptikaContent.safeAsset;
    var resolveMediaUrl = window.OptikaContent.resolveMediaUrl;
    var isGhPages = window.OptikaContent.isGhPages;
    var RAW_GH_BASE = window.OptikaContent.RAW_GH_BASE;
    var DEFAULT_THUMB = window.OptikaContent.DEFAULT_THUMB;

    function showControlsTemporarily() {
      overlayEl.classList.remove('opacity-0', 'pointer-events-none');
      clearTimeout(hideControlsTimer);
      if (!videoEl.paused && !isDragging) {
        hideControlsTimer = setTimeout(function () {
          overlayEl.classList.add('opacity-0', 'pointer-events-none');
        }, 2500);
      }
    }

    function updatePlayUI(playing) {
      if (playing) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        showControlsTemporarily();
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        clearTimeout(hideControlsTimer);
        overlayEl.classList.remove('opacity-0', 'pointer-events-none');
      }
    }

    function setProgressUI(pct) {
      pct = Math.min(100, Math.max(0, pct));
      progBar.style.width = pct + '%';
      if (progThumb) progThumb.style.left = pct + '%';
    }

    function updateVolumeUI() {
      var muted = videoEl.muted || videoEl.volume === 0;
      if (volOnIcon && volOffIcon) {
        volOnIcon.classList.toggle('hidden', muted);
        volOffIcon.classList.toggle('hidden', !muted);
      }
      if (volRange) {
        volRange.value = muted ? 0 : videoEl.volume;
      }
    }

    var seekToastTimer = null;
    function showSeekToast(text) {
      if (!seekToastEl) return;
      seekToastEl.textContent = text;
      seekToastEl.classList.remove('hidden');
      clearTimeout(seekToastTimer);
      seekToastTimer = setTimeout(function () {
        seekToastEl.classList.add('hidden');
      }, 700);
    }

    function renderPlaylist() {
      plItemsEl.innerHTML = '';
      if (!playlist.length) {
        plCounterEl.textContent = '0 / 0';
        plItemsEl.innerHTML = '<div class="p-6 text-center text-white/50 text-sm">В плейлисте пока нет видео</div>';
        return;
      }
      plCounterEl.textContent = (currentIndex + 1) + ' / ' + playlist.length;
      playlist.forEach(function (item, idx) {
        var active = idx === currentIndex;
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'w-full text-left flex items-center gap-3.5 px-4 py-3 transition ' +
          (active ? 'bg-white/15 border-l-4 border-[#ff0033]' : 'hover:bg-white/5');
        var thumbPath = safeAsset(item.thumb, DEFAULT_THUMB);
        var thumbSrc = (isGhPages && thumbPath.indexOf('uploads/') === 0) ? (RAW_GH_BASE + thumbPath) : thumbPath;
        row.innerHTML =
          '<div class="relative w-32 sm:w-36 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/10">' +
            '<img data-thumb-path="' + esc(thumbPath) + '" src="' + esc(thumbSrc) + '" alt="" loading="lazy" class="w-full h-full object-cover" />' +
            '<span class="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-xs font-bold px-1.5 py-0.5 rounded">' + esc(item.duration || '0:00') + '</span>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">' + esc(item.title) + '</div>' +
            '<div class="text-xs sm:text-sm text-white/60 mt-1 truncate">' + esc(item.subtitle || '') + '</div>' +
          '</div>';
        var imgEl = row.querySelector('img[data-thumb-path]');
        if (imgEl && thumbPath.indexOf('uploads/') === 0) {
          resolveMediaUrl(thumbPath, DEFAULT_THUMB).then(function (u) { if (u) imgEl.src = u; });
        }
        row.addEventListener('click', function () {
          loadTrack(idx, true);
        });
        plItemsEl.appendChild(row);
      });
    }

    function loadTrack(idx, autoplay) {
      if (!playlist.length) return;
      if (idx < 0) idx = playlist.length - 1;
      if (idx >= playlist.length) idx = 0;
      currentIndex = idx;
      var item = playlist[currentIndex];
      if (topTitleEl) topTitleEl.textContent = item.title || '';
      totTimeEl.textContent = item.duration || '0:00';
      curTimeEl.textContent = '0:00';
      setProgressUI(0);
      if (bufferBar) bufferBar.style.width = '0%';
      renderPlaylist();
      resolveMediaUrl(item.thumb, DEFAULT_THUMB).then(function (posterUrl) {
        videoEl.poster = posterUrl;
      });
      resolveMediaUrl(item.src, '').then(function (videoUrl) {
        videoEl.src = videoUrl;
        videoEl.playbackRate = speeds[speedIdx];
        if (autoplay) videoEl.play().catch(function () {});
      });
    }

    function togglePlay() {
      if (videoEl.paused) {
        videoEl.play().catch(function () {});
      } else {
        videoEl.pause();
      }
    }

    playBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePlay();
    });

    playerBox.addEventListener('mousemove', showControlsTemporarily);
    playerBox.addEventListener('touchstart', function () {
      showControlsTemporarily();
    }, { passive: true });

    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl || e.target.parentElement === overlayEl) {
        togglePlay();
      }
    });
    videoEl.addEventListener('click', function () {
      if (overlayEl.classList.contains('opacity-0')) {
        showControlsTemporarily();
      } else {
        togglePlay();
      }
    });

    playerBox.addEventListener('dblclick', function (e) {
      if (bottomBarEl && bottomBarEl.contains(e.target)) return;
      var rect = playerBox.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x < rect.width * 0.4) {
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
        showSeekToast('⏪ -5 сек');
      } else if (x > rect.width * 0.6) {
        videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
        showSeekToast('+5 сек ⏩');
      }
    });

    if (bottomBarEl) {
      bottomBarEl.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    videoEl.addEventListener('play', function () { updatePlayUI(true); });
    videoEl.addEventListener('pause', function () { updatePlayUI(false); });
    videoEl.addEventListener('waiting', function () { if (spinnerEl) spinnerEl.classList.remove('hidden'); });
    videoEl.addEventListener('playing', function () { if (spinnerEl) spinnerEl.classList.add('hidden'); });
    videoEl.addEventListener('canplay', function () { if (spinnerEl) spinnerEl.classList.add('hidden'); });

    videoEl.addEventListener('loadedmetadata', function () {
      if (videoEl.duration && !isNaN(videoEl.duration)) {
        totTimeEl.textContent = fmtTime(videoEl.duration);
      }
    });

    videoEl.addEventListener('progress', function () {
      if (bufferBar && videoEl.duration && videoEl.buffered.length > 0) {
        var bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        bufferBar.style.width = Math.min(100, (bufferedEnd / videoEl.duration) * 100) + '%';
      }
    });

    videoEl.addEventListener('timeupdate', function () {
      if (isDragging) return;
      curTimeEl.textContent = fmtTime(videoEl.currentTime);
      if (videoEl.duration) {
        var pct = (videoEl.currentTime / videoEl.duration) * 100;
        setProgressUI(pct);
      }
    });

    videoEl.addEventListener('ended', function () {
      if (isShuffle && playlist.length > 1) {
        var nextIdx = Math.floor(Math.random() * playlist.length);
        loadTrack(nextIdx, true);
      } else if (currentIndex < playlist.length - 1) {
        loadTrack(currentIndex + 1, true);
      } else if (isLoop) {
        loadTrack(0, true);
      }
    });

    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      loadTrack(currentIndex - 1, true);
    });
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      loadTrack(currentIndex + 1, true);
    });

    function getRatioFromEvent(e) {
      var rect = progWrap.getBoundingClientRect();
      var clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      return Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
    }

    function applyScrub(e, commitSeek) {
      var ratio = getRatioFromEvent(e);
      setProgressUI(ratio * 100);
      var dur = videoEl.duration || 0;
      if (dur > 0) {
        var targetSec = ratio * dur;
        curTimeEl.textContent = fmtTime(targetSec);
        if (hoverTimeEl) {
          hoverTimeEl.textContent = fmtTime(targetSec);
          hoverTimeEl.style.left = (ratio * 100) + '%';
          hoverTimeEl.classList.remove('hidden');
        }
        if (commitSeek) {
          videoEl.currentTime = targetSec;
        }
      }
    }

    progWrap.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
      wasPlayingBeforeDrag = !videoEl.paused;
      if (progWrap.setPointerCapture) {
        try { progWrap.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (wasPlayingBeforeDrag) videoEl.pause();
      applyScrub(e, true);
    });

    progWrap.addEventListener('pointermove', function (e) {
      if (isDragging) {
        e.stopPropagation();
        applyScrub(e, true);
      } else if (videoEl.duration && hoverTimeEl) {
        var ratio = getRatioFromEvent(e);
        hoverTimeEl.textContent = fmtTime(ratio * videoEl.duration);
        hoverTimeEl.style.left = (ratio * 100) + '%';
        hoverTimeEl.classList.remove('hidden');
      }
    });

    function finishDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      if (e) applyScrub(e, true);
      if (hoverTimeEl) hoverTimeEl.classList.add('hidden');
      if (wasPlayingBeforeDrag) {
        videoEl.play().catch(function () {});
      }
      showControlsTemporarily();
    }

    progWrap.addEventListener('pointerup', finishDrag);
    progWrap.addEventListener('pointercancel', finishDrag);
    progWrap.addEventListener('pointerleave', function () {
      if (!isDragging && hoverTimeEl) hoverTimeEl.classList.add('hidden');
    });

    muteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      videoEl.muted = !videoEl.muted;
      if (!videoEl.muted && videoEl.volume === 0) videoEl.volume = 0.8;
      updateVolumeUI();
    });

    if (volRange) {
      volRange.addEventListener('input', function (e) {
        e.stopPropagation();
        var v = parseFloat(volRange.value);
        videoEl.volume = isNaN(v) ? 1 : v;
        videoEl.muted = videoEl.volume === 0;
        updateVolumeUI();
      });
    }

    if (speedBtn) {
      speedBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        speedIdx = (speedIdx + 1) % speeds.length;
        videoEl.playbackRate = speeds[speedIdx];
        speedBtn.textContent = speeds[speedIdx] + 'x';
        showSeekToast('Скорость ' + speeds[speedIdx] + 'x');
      });
    }

    if (pipBtn) {
      pipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(function () {});
        } else if (videoEl.requestPictureInPicture) {
          videoEl.requestPictureInPicture().catch(function () {});
        }
      });
    }

    fsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        if (playerBox.requestFullscreen) playerBox.requestFullscreen();
        else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });

    playerBox.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
        showSeekToast('+5 сек ⏩');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
        showSeekToast('⏪ -5 сек');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        videoEl.muted = !videoEl.muted;
        updateVolumeUI();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fsBtn.click();
      }
    });

    plLoopBtn.addEventListener('click', function () {
      isLoop = !isLoop;
      plLoopBtn.classList.toggle('text-sky-400', isLoop);
    });
    plShuffleBtn.addEventListener('click', function () {
      isShuffle = !isShuffle;
      plShuffleBtn.classList.toggle('text-sky-400', isShuffle);
    });

    window.onOptikaPlaylistUpdate = function (pl) {
      if (!pl || !Array.isArray(pl.videos)) return;
      plTitleEl.textContent = pl.title || '';
      plAuthorEl.textContent = pl.author || '';
      playlist = pl.videos;
      loadTrack(0, false);
    };

    window.optikaContentReady.then(function (data) {
      var pl = data && data.playlist;
      if (pl) window.onOptikaPlaylistUpdate(pl);
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (action === 'open-booking') window.openCallbackModal();
    else if (action === 'close-booking') window.closeCallbackModal();
    else if (action === 'close-thanks') window.closeThankYouModal();
    else if (action === 'messenger') window.submitBookingMessenger(el.getAttribute('data-channel'));
  });
  var bookingForm = document.getElementById('callback-form');
  if (bookingForm) bookingForm.addEventListener('submit', function (e) { e.preventDefault(); });
});
