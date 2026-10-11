/* Shared by the remotes docks (desktop only): when the remotes don't fit, the row scrolls.
   Arrows show which sides have more, clicking one slides the row, and bringing the pointer
   near an edge pans towards it - faster the closer it gets.

   DockPan.attach(stage, dock, { active, onMove, hidden }) - the arrows show on every screen
   whenever there's more to see; `active()` says whether pointer panning applies (not on
   phones: a finger doesn't hover), `hidden()` hides the arrows (e.g. while a remote is open),
   and `onMove()` runs after every pan so the magnification follows the sliding remotes. */
window.DockPan = (function () {
  'use strict';

  var ZONE = 110;        // px from each edge where the pointer pans the row
  var SPEED = 16;        // px per frame at the very edge

  function arrow(side) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dock-arrow dock-arrow-' + side;
    b.setAttribute('aria-label', side === 'left' ? 'Show earlier remotes' : 'Show more remotes');
    b.innerHTML = '<span aria-hidden="true">' + (side === 'left' ? '‹' : '›') + '</span>';
    return b;
  }

  function attach(stage, dock, opts) {
    var active = opts.active || function () { return true; };
    var onMove = opts.onMove || function () {};
    var hiddenNow = opts.hidden || function () { return false; };
    var left = arrow('left'), right = arrow('right');
    stage.appendChild(left);
    stage.appendChild(right);
    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    var clientX = null, frame = 0;

    function max() { return dock.scrollWidth - dock.clientWidth; }
    function update() {
      var on = !hiddenNow() && max() > 2;
      left.hidden = !(on && dock.scrollLeft > 2);
      right.hidden = !(on && dock.scrollLeft < max() - 2);
      // fade the side(s) that have remotes out of view
      dock.classList.toggle('fade-left', !left.hidden);
      dock.classList.toggle('fade-right', !right.hidden);
    }
    function step() {
      frame = 0;
      if (clientX == null || !active()) return;
      var box = stage.getBoundingClientRect();
      var fromLeft = clientX - box.left, fromRight = box.right - clientX;
      var v = 0;
      if (fromLeft < ZONE) v = -SPEED * Math.pow(1 - fromLeft / ZONE, 2);
      else if (fromRight < ZONE) v = SPEED * Math.pow(1 - fromRight / ZONE, 2);
      if (!v) return;
      var before = dock.scrollLeft;
      dock.scrollLeft = Math.max(0, Math.min(max(), before + v));
      if (dock.scrollLeft !== before) { onMove(); frame = requestAnimationFrame(step); }
    }

    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      clientX = e.clientX;
      if (!frame && !still.matches) frame = requestAnimationFrame(step);
    });
    stage.addEventListener('pointerleave', function () { clientX = null; });
    dock.addEventListener('scroll', function () { update(); onMove(); }, { passive: true });
    [[left, -1], [right, 1]].forEach(function (pair) {
      pair[0].addEventListener('click', function () {
        dock.scrollBy({ left: pair[1] * dock.clientWidth * 0.7, behavior: still.matches ? 'auto' : 'smooth' });
      });
    });
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    update();
    return { update: update };
  }

  return { attach: attach };
}());
