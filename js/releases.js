/* Release info from GitHub, so the site follows each release without editing.

   The version, date and sizes written in the HTML are the fallback: if GitHub can't be
   reached (offline, rate limit, a page opened from disk) the page still says something true
   as of the last edit, and the download buttons work regardless, because they use GitHub's
   releases/latest/download/... links.

   A pre-release is offered only when it is newer than the newest stable release. */
(function () {
  'use strict';

  var API = 'https://api.github.com/repos/harmonic-afterglow/afterglow/releases?per_page=20';
  var CACHE = 'afterglow-releases';
  var MAX_AGE = 15 * 60 * 1000;   // the API allows 60 unauthenticated calls an hour per visitor

  function load() {
    try {
      var hit = JSON.parse(sessionStorage.getItem(CACHE) || 'null');
      if (hit && Date.now() - hit.at < MAX_AGE) return Promise.resolve(hit.data);
    } catch (e) { /* storage blocked: just fetch */ }
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* fine */ }
        return data;
      });
  }

  function version(tag) { return tag.replace(/^v/, ''); }
  function day(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function mb(bytes) { return Math.round(bytes / 1e6) + ' MB'; }
  function asset(release, name) {
    return (release.assets || []).filter(function (a) { return a.name === name; })[0];
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  function show(releases) {
    var usable = releases.filter(function (r) { return !r.draft; });
    var stable = usable.filter(function (r) { return !r.prerelease; })[0];
    var pre = usable.filter(function (r) { return r.prerelease; })[0];
    if (!stable) return;

    each('[data-rel="version"]', function (el) { el.textContent = version(stable.tag_name); });
    each('[data-rel="date"]', function (el) { el.textContent = day(stable.published_at); });
    each('[data-rel="notes"]', function (el) { el.href = stable.html_url; });
    // the hand-written highlights describe one release; past it, point at the notes instead
    each('[data-rel-notes]', function (el) {
      if (el.getAttribute('data-rel-notes') !== stable.tag_name) el.hidden = true;
    });
    each('[data-size]', function (el) {
      var sizes = el.getAttribute('data-size').split(' ').map(function (n) {
        var a = asset(stable, n); return a ? Math.round(a.size / 1e6) : null;
      }).filter(function (n) { return n !== null; });
      if (!sizes.length) return;
      var lo = Math.min.apply(null, sizes), hi = Math.max.apply(null, sizes);
      el.textContent = lo === hi ? lo + ' MB' : lo + '–' + hi + ' MB';
    });

    var box = document.querySelector('.prerelease');
    if (!box || !pre || new Date(pre.published_at) <= new Date(stable.published_at)) return;
    box.querySelector('[data-pre="version"]').textContent = 'Version ' + version(pre.tag_name);
    box.querySelector('[data-pre="date"]').textContent = day(pre.published_at);
    box.querySelector('[data-pre="notes"]').href = pre.html_url;
    var any = false;
    each('.prerelease [data-pre-asset]', function (a) {
      var file = asset(pre, a.getAttribute('data-pre-asset'));
      if (file) { a.href = file.browser_download_url; a.title = mb(file.size); any = true; }
      else a.hidden = true;                    // not every test build has every platform
    });
    if (any) box.hidden = false;
  }

  load().then(show).catch(function () { /* keep the written-in values */ });
}());
