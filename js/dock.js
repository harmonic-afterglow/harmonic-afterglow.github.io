/* Remotes page.
   Desktop: a row of remotes that magnifies under the pointer like the macOS dock.
   Phone:   a horizontal strip; the remote nearest the centre is the picked one and the
            largest, and the strip snaps to it when scrolling stops (CSS scroll snap).
   Either way, choosing a remote opens it into a large view. Without JavaScript the page
   keeps its plain list. */
(function () {
  'use strict';

  var stage = document.querySelector('.dock-stage');
  if (!stage) return;

  var desktop = window.matchMedia('(min-width: 701px)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var dock = stage.querySelector('.dock');
  var items = Array.prototype.slice.call(dock.querySelectorAll('.dock-item'));
  var caption = stage.querySelector('.dock-caption');
  var detail = stage.querySelector('.detail');
  var detailImg = detail.querySelector('.detail-photo img');
  var detailInfo = detail.querySelector('.detail-info');
  var back = detail.querySelector('.detail-back');

  var DESK_MAX = 1.45, DESK_RANGE = 190;   // pointer magnification
  var PHONE_MAX = 1.35, PHONE_RANGE = 130; // centre-of-strip magnification
  var START = 'harmony-900';               // the strip opens centred on this one

  var rest = [];        // desktop: item centres with nothing magnified
  var frame = 0;
  var pointerX = null;
  var picked = -1;      // phone: index of the centred remote
  var openedHere = false;
  var upgrades = 0;       // which large-view sharpening is current
  var quietFocus = false; // focus put back by the script shouldn't magnify or scroll


  // photos still on their way fade in when they arrive (their space is already reserved)
  Array.prototype.forEach.call(document.querySelectorAll('.dock-item img'), function (img) {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('is-arriving');
    var done = function () { img.classList.remove('is-arriving'); };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
  document.documentElement.classList.add('has-dock');

  function isOpen() { return stage.classList.contains('is-open'); }

  // smoothstep falloff, so neighbours grow gradually rather than in a cone
  function falloff(d, range, max) {
    var t = Math.max(0, 1 - Math.abs(d) / range);
    return 1 + (max - 1) * t * t * (3 - 2 * t);
  }

  function setScale(it, s) {
    it.style.setProperty('--s', s.toFixed(3));
    it.parentNode.style.zIndex = Math.round(s * 100);
  }

  // ---------- desktop: magnify under the pointer ----------

  function measure() {
    if (!desktop.matches || isOpen()) return;
    // centres in row coordinates (scroll included), so they hold while the row pans
    items.forEach(function (it) { it.style.setProperty('--s', 1); });
    var s = dock.getBoundingClientRect().left - dock.scrollLeft;
    rest = items.map(function (it) {
      var r = it.getBoundingClientRect();
      return r.left - s + r.width / 2;
    });
  }

  function magnify(x) {
    var nearest = -1, best = Infinity;
    items.forEach(function (it, i) {
      var d = x == null ? Infinity : x - rest[i];
      setScale(it, x == null ? 1 : falloff(d, DESK_RANGE, DESK_MAX));
      if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
    });
    items.forEach(function (it, i) {
      it.classList.toggle('is-near', x != null && i === nearest && best < DESK_RANGE);
    });
  }

  dock.addEventListener('pointermove', function (e) {
    if (!desktop.matches || e.pointerType === 'touch') return;
    dock.classList.remove('is-settling');
    lastClientX = e.clientX;
    pointerX = e.clientX - dock.getBoundingClientRect().left + dock.scrollLeft;
    schedule();
  });
  dock.addEventListener('pointerleave', function () {
    if (!desktop.matches) return;
    dock.classList.add('is-settling');
    pointerX = null;
    lastClientX = null;
    schedule();
  });

  // too many remotes for the stage: arrows, and panning near the edges
  var lastClientX = null;
  var pan = window.DockPan && DockPan.attach(stage, dock, {
    active: function () { return desktop.matches && !isOpen(); },
    hidden: isOpen,
    onMove: function () {
      if (!desktop.matches || lastClientX == null) return;
      pointerX = lastClientX - dock.getBoundingClientRect().left + dock.scrollLeft;
      schedule();
    }
  });

  // ---------- phone: the strip ----------

  // pad both ends so the first and last remote can reach the centre
  function padStrip() {
    if (desktop.matches) { dock.style.paddingLeft = dock.style.paddingRight = ''; return; }
    var w = dock.clientWidth;
    var first = items[0].offsetWidth, last = items[items.length - 1].offsetWidth;
    dock.style.paddingLeft = Math.max(0, (w - first) / 2) + 'px';
    dock.style.paddingRight = Math.max(0, (w - last) / 2) + 'px';
  }

  function centre(i, smooth) {
    var it = items[i];
    var li = it.parentNode;
    var left = li.offsetLeft + li.offsetWidth / 2 - dock.clientWidth / 2;
    dock.scrollTo({ left: left, behavior: smooth && !still.matches ? 'smooth' : 'auto' });
  }

  function follow() {
    var box = dock.getBoundingClientRect();
    var mid = box.left + box.width / 2;
    var nearest = 0, best = Infinity;
    items.forEach(function (it, i) {
      var li = it.parentNode.getBoundingClientRect();
      var d = li.left + li.width / 2 - mid;
      setScale(it, falloff(d, PHONE_RANGE, PHONE_MAX));
      if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
    });
    if (nearest !== picked) {
      picked = nearest;
      items.forEach(function (it, i) { it.classList.toggle('is-picked', i === picked); });
      var label = items[picked].querySelector('.dock-label');
      caption.innerHTML = label.innerHTML + '<span class="dock-tap">Tap for details</span>';
    }
  }

  dock.addEventListener('scroll', function () { if (!desktop.matches) schedule(); }, { passive: true });

  // ---------- shared ----------

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      if (isOpen()) return;
      if (desktop.matches) magnify(pointerX); else follow();
    });
  }

  items.forEach(function (it, i) {
    it.addEventListener('focus', function () {
      if (quietFocus) return;
      if (desktop.matches) {
        dock.classList.add('is-settling');
        pointerX = rest[i];
        schedule();
      } else {
        centre(i, true);
      }
    });
    it.addEventListener('blur', function () {
      if (desktop.matches && !dock.contains(document.activeElement)) { pointerX = null; schedule(); }
    });
    it.addEventListener('click', function () {
      openedHere = true;
      location.hash = it.dataset.target;
    });
  });

  // ---------- the large view ----------

  function open(id, animate) {
    var item = items.filter(function (it) { return it.dataset.target === id; })[0];
    var source = document.getElementById(id);
    if (!item || !source) return;

    var img = item.querySelector('img');
    var from = img.getBoundingClientRect();

    // start with the picture the dock already has (no waiting, so the grow can run at once),
    // then swap in the sharper one when it has arrived and decoded - same shape, no jump
    var token = ++upgrades;
    detailImg.removeAttribute('srcset');
    detailImg.src = img.currentSrc || img.src;
    detailImg.setAttribute('width', img.getAttribute('width'));
    detailImg.setAttribute('height', img.getAttribute('height'));
    // the sharper picture is fetched after the grow animation, so decoding it can't cost frames
    var sharpen = function () {
      if (token !== upgrades || !isOpen() || !img.dataset.large || img.dataset.large === img.src) return;
      var hi = new Image();
      if (img.dataset.largeSrcset) hi.srcset = img.dataset.largeSrcset;
      hi.src = img.dataset.large;
      var swap = function () {
        if (token !== upgrades || !isOpen()) return;          // another remote was opened since
        if (hi.srcset) detailImg.srcset = hi.srcset;
        detailImg.src = hi.src;
      };
      (hi.decode ? hi.decode() : Promise.reject()).then(swap, function () { hi.onload = swap; });
    };
    detailImg.alt = source.querySelector('.remote-photo img').alt;
    detailImg.className = item.classList.contains('is-wide') ? 'wide' : '';
    detailInfo.innerHTML = source.querySelector('.remote-info').innerHTML;
    detailInfo.dataset.id = id;

    stage.classList.add('is-open');
    detail.hidden = false;
    if (pan) pan.update();
    document.title = source.querySelector('h2').firstChild.textContent.trim() + ' – Afterglow';
    if (!desktop.matches) stage.scrollIntoView({ block: 'start', behavior: 'auto' });

    if (animate && !still.matches && from.width) {
      var grow = function () {
        var to = detailImg.getBoundingClientRect();
        if (!to.width) return;
        detailImg.animate([
          { transformOrigin: 'top left',
            transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' +
              (from.width / to.width) + ',' + (from.height / to.height) + ')' },
          { transformOrigin: 'top left', transform: 'none' }
        ], { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished.then(sharpen, sharpen);
        detailInfo.animate([
          { opacity: 0, transform: desktop.matches ? 'translateX(16px)' : 'translateY(16px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 360, delay: 120, easing: 'ease-out', fill: 'backwards' });
      };
      grow();   // the size is known from the dock picture's width/height, loaded or not
    } else {
      sharpen();
    }
    back.focus({ preventScroll: true });
  }

  // going back: the large photo flies home into its place in the row, the others rise in
  function close(animate) {
    if (!isOpen()) return;
    var id = detailInfo.dataset.id;
    var index = items.map(function (it) { return it.dataset.target; }).indexOf(id);
    var from = detailImg.getBoundingClientRect();
    var flySrc = detailImg.currentSrc || detailImg.src;

    stage.classList.remove('is-open');
    detail.hidden = true;
    document.title = 'Remotes – Afterglow';
    layout();
    if (!desktop.matches && index >= 0) { centre(index, false); follow(); }

    var motion = animate && !still.matches;
    if (motion && index >= 0 && from.width) {
      var target = items[index].querySelector('img');
      var to = target.getBoundingClientRect();
      if (to.width) {
        // a stand-in on top of the page, so the strip's scroll box and the stage can't clip it
        var fly = document.createElement('img');
        fly.className = 'dock-fly';
        fly.alt = '';
        fly.src = flySrc;
        fly.style.left = to.left + 'px';
        fly.style.top = to.top + 'px';
        fly.style.width = to.width + 'px';
        fly.style.height = to.height + 'px';
        document.body.appendChild(fly);
        target.style.visibility = 'hidden';
        var trip = fly.animate([
          { transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' +
              (from.width / to.width) + ',' + (from.height / to.height) + ')' },
          { transform: 'none' }
        ], { duration: 480, easing: 'cubic-bezier(.3, .7, .2, 1)' });
        var land = function () { target.style.visibility = ''; fly.remove(); };
        trip.onfinish = land;
        trip.oncancel = land;
      }
    }
    if (motion) {
      items.forEach(function (it, i) {
        if (i === index) return;
        var gap = Math.abs(i - index);
        // animate the list item: on phones the button's own transform holds its size
        it.parentNode.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
          { duration: 340, delay: 120 + gap * 60, easing: 'ease-out', fill: 'backwards' });
      });
    }
    if (index >= 0) {
      quietFocus = true;
      items[index].focus({ preventScroll: true });
      quietFocus = false;
    }
  }

  function route(animate) {
    var id = location.hash.slice(1);
    if (id && document.getElementById(id) && stage.querySelector('[data-target="' + id + '"]')) open(id, animate);
    else close(animate);
  }

  back.addEventListener('click', function () {
    if (openedHere) { openedHere = false; history.back(); }
    else { history.replaceState(null, '', location.pathname); close(true); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) back.click();
  });

  // ---------- layout for whichever mode we are in ----------

  function layout() {
    if (pan) pan.update();
    if (isOpen()) return;
    if (desktop.matches) {
      padStrip();
      measure();
      magnify(null);
    } else {
      items.forEach(function (it) { it.classList.remove('is-near'); });
      padStrip();
      follow();
    }
  }

  // until the visitor touches the strip, keep it centred on START (photos arrive late)
  var touched = false;
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (type) {
    dock.addEventListener(type, function () { touched = true; }, { passive: true });
  });
  function settle() {
    layout();
    if (!touched && !desktop.matches && !isOpen()) {
      var i = items.map(function (it) { return it.dataset.target; }).indexOf(START);
      centre(Math.max(0, i), false);
      follow();
    }
  }

  window.addEventListener('hashchange', function () { route(true); });
  window.addEventListener('resize', layout);
  desktop.addEventListener('change', function () { touched = false; settle(); });
  items.forEach(function (it) {
    var img = it.querySelector('img');
    if (!img.complete) img.addEventListener('load', settle);
  });
  window.addEventListener('load', settle);

  settle();
  route(false);
}());
