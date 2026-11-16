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

  // shared by both docks: slide the row so the resting spot x stays under the pointer
  var anchor = function (items, rest, restW, dock, x) {
    // Where the row's resting spot x is drawn now: between the centres of the two remotes
    // either side of it, in proportion, so it moves smoothly as the pointer crosses from
    // one remote to the next (pinning to the nearest remote jumped at every hand-over).
    var shift = parseFloat(dock.style.getPropertyValue('--shift')) || 0;
    var origin = dock.getBoundingClientRect().left - dock.scrollLeft;
    var C = [], W = [];
    items.forEach(function (it) {
      var r = it.getBoundingClientRect();
      C.push(r.left - shift - origin + r.width / 2);
      W.push(r.width);
    });
    var n = items.length, pos;
    if (x <= rest[0]) pos = C[0] - (rest[0] - x) * W[0] / restW[0];
    else if (x >= rest[n - 1]) pos = C[n - 1] + (x - rest[n - 1]) * W[n - 1] / restW[n - 1];
    else {
      var k = 0;
      while (k < n - 2 && rest[k + 1] <= x) k++;
      var t = (x - rest[k]) / (rest[k + 1] - rest[k]);
      pos = C[k] + t * (C[k + 1] - C[k]);
    }
    dock.style.setProperty('--shift', (x - pos).toFixed(1) + 'px');
  };

  // the remote drawn under the pointer: of the photos that hold it, the biggest (it is on
  // top). Above a short remote that is the tall one behind it; with no height to go by
  // (keyboard), or over the empty sky above the row, the column decides
  var under = function (items, dock, x, cy) {
    var cx = dock.getBoundingClientRect().left - dock.scrollLeft + x;
    function best(useY) {
      var pick = -1, top = -1;
      items.forEach(function (it, i) {
        var r = (it.querySelector('img') || it).getBoundingClientRect();
        // the stacking the page itself uses: the row's z-index, a later remote on a tie
        var z = parseInt(it.parentNode.style.zIndex, 10) || 0;
        if (cx >= r.left && cx < r.right && (!useY || (cy >= r.top && cy < r.bottom)) && z >= top) { top = z; pick = i; }
      });
      return pick;
    }
    var pick = cy == null ? -1 : best(true);
    return pick >= 0 ? pick : best(false);
  };

  return { attach: attach, anchor: anchor, under: under };
}());
