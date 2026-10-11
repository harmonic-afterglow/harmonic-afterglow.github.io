/* Home page remotes: magnify under the pointer like the macOS dock. Each remote is a plain
   link to its details on the Remotes page, so this script only adds the magnification. */
(function () {
  'use strict';

  var MAX = 1.4, RANGE = 150;
  var wide = window.matchMedia('(min-width: 701px)');

  // photos still on their way fade in when they arrive (their space is already reserved)
  Array.prototype.forEach.call(document.querySelectorAll('.mini-item img'), function (img) {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('is-arriving');
    var done = function () { img.classList.remove('is-arriving'); };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.mini-dock'), function (dock) {
    var items = Array.prototype.slice.call(dock.querySelectorAll('.mini-item'));
    var rest = [], frame = 0, x = null;

    function measure() {
      items.forEach(function (it) { it.style.setProperty('--s', 1); });
      var left = dock.getBoundingClientRect().left - dock.scrollLeft;
      rest = items.map(function (it) { var r = it.getBoundingClientRect(); return r.left - left + r.width / 2; });
    }
    function scale(d) {
      var t = Math.max(0, 1 - Math.abs(d) / RANGE);
      return 1 + (MAX - 1) * t * t * (3 - 2 * t);
    }
    function paint() {
      frame = 0;
      var near = -1, best = Infinity;
      items.forEach(function (it, i) {
        var d = x == null ? Infinity : x - rest[i];
        var s = x == null ? 1 : scale(d);
        it.style.setProperty('--s', s.toFixed(3));
        it.parentNode.style.zIndex = Math.round(s * 100);
        if (Math.abs(d) < best) { best = Math.abs(d); near = i; }
      });
      items.forEach(function (it, i) { it.classList.toggle('is-near', x != null && i === near && best < RANGE); });
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(paint); }

    dock.addEventListener('pointermove', function (e) {
      if (!wide.matches || e.pointerType === 'touch') return;
      dock.classList.remove('is-settling');
      cx = e.clientX;
      x = e.clientX - dock.getBoundingClientRect().left + dock.scrollLeft;
      schedule();
    });
    dock.addEventListener('pointerleave', function () {
      dock.classList.add('is-settling');
      x = null;
      cx = null;
      schedule();
    });
    var cx = null;
    var pan = window.DockPan && DockPan.attach(dock.parentNode, dock, {
      active: function () { return wide.matches; },
      onMove: function () {
        if (cx == null) return;
        x = cx - dock.getBoundingClientRect().left + dock.scrollLeft;
        schedule();
      }
    });
    function settle() { if (pan) pan.update(); if (wide.matches) measure(); else items.forEach(function (it) { it.style.removeProperty('--s'); }); }
    window.addEventListener('resize', settle);
    window.addEventListener('load', settle);
    wide.addEventListener('change', settle);
    settle();
  });
}());
