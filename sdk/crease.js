/* Crease browser SDK. Call init only after obtaining any required consent. */
(function (root) {
  'use strict';
  var options, queue = [], timer, currentUrl, currentPath, enabled = false, routeHandler, leaveHandler, visibilityHandler;
  var vitals = {}, vitalsSent = false, observerList = [];
  var visitorKey = 'crease_visitor', sessionKey = 'crease_session';
  var sessionIdleMs = 30 * 60 * 1000, sessionMaxMs = 24 * 60 * 60 * 1000;
  function id() { return root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : null; }
  function read(key) { try { return root.localStorage.getItem(key); } catch (_) { return null; } }
  function write(key, value) { try { root.localStorage.setItem(key, value); } catch (_) {} }
  function remove(key) { try { root.localStorage.removeItem(key); } catch (_) {} }
  function visitorId() {
    var value = read(visitorKey);
    if (!value) { value = id(); if (value) write(visitorKey, value); }
    return value;
  }
  function session() {
    var now = Date.now(), state;
    try { state = JSON.parse(read(sessionKey) || 'null'); } catch (_) { state = null; }
    if (!state || !state.id || now - state.lastActivity >= sessionIdleMs || now - state.startedAt >= sessionMaxMs) {
      state = { id: id(), startedAt: now, lastActivity: now, entryPage: safePath(), exitPage: safePath(), pageviews: 0 };
    }
    state.lastActivity = now;
    write(sessionKey, JSON.stringify(state));
    return state;
  }
  function safePath() { return root.location.pathname; }
  function routeKey() { return root.location.pathname + root.location.search; }
  function observe(type, update) {
    try {
      var observer = new root.PerformanceObserver(function (list) { update(list.getEntries()); });
      observer.observe({ type: type, buffered: true });
      observerList.push(observer);
    } catch (_) {}
  }
  function observeVitals() {
    if (!root.PerformanceObserver) return;
    observe('largest-contentful-paint', function (entries) { var last = entries[entries.length - 1]; if (last) vitals.lcp = Math.round(last.startTime); });
    observe('layout-shift', function (entries) { entries.forEach(function (entry) { vitals.clsSeen = true; if (!entry.hadRecentInput) vitals.cls = Math.round(((vitals.cls || 0) + entry.value) * 10000) / 10000; }); });
    observe('event', function (entries) { var list = vitals.interactions || []; entries.forEach(function (entry) { if (entry.duration) list.push(entry.duration); }); vitals.interactions = list.slice(-50).sort(function (a, b) { return a - b; }); });
  }
  function resetVitals() { vitals = {}; vitalsSent = false; }
  function flushVitals(path) {
    if (!enabled || vitalsSent) return;
    var properties = {}, interactions = vitals.interactions || [];
    if (vitals.lcp) properties.lcp_ms = vitals.lcp;
    if (vitals.clsSeen) properties.cls = vitals.cls || 0;
    if (interactions.length) properties.inp_ms = Math.round(interactions[Math.floor((interactions.length - 1) * 0.98)]);
    if (!properties.lcp_ms && !properties.cls && !properties.inp_ms) return;
    vitalsSent = true;
    capture('web_vitals', properties, null, path);
  }
  function leaving() { flushVitals(currentPath); flush(); }
  function hidden() { if (root.document && root.document.visibilityState === 'hidden') leaving(); }
  function schedule() { if (!timer) timer = root.setTimeout(flush, 2000); }
  function flush() {
    if (timer) root.clearTimeout(timer); timer = null;
    if (!enabled || !queue.length) return;
    var batch = queue.slice(0, 20); queue = queue.slice(batch.length);
    root.fetch(options.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crease-Key': options.writeKey }, body: JSON.stringify({ projectId: options.projectId, events: batch }), keepalive: true, credentials: 'omit' })
      .then(function (response) { if (!response.ok && (response.status === 429 || response.status >= 500)) throw new Error('Temporary ingestion failure'); })
      .catch(function () { if (enabled) { queue = batch.concat(queue).slice(0, 100); if (!timer) timer = root.setTimeout(flush, 10000); } });
    if (queue.length) schedule();
  }
  function capture(name, properties, pageReferrer, pathOverride) {
    if (!enabled || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    var eventId = id(); if (!eventId) return;
    var clean = {};
    if (properties && typeof properties === 'object') Object.keys(properties).slice(0, 20).forEach(function (key) {
      var value = properties[key];
      if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && !/password|token|secret|email/i.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && isFinite(value)))) clean[key] = value;
    });
    var referrer = pageReferrer || null;
    if (typeof pageReferrer === 'undefined') { try { if (root.document.referrer) referrer = new URL(root.document.referrer).hostname; } catch (_) {} }
    var activeSession = session();
    if (name === 'pageview') { activeSession.pageviews += 1; activeSession.exitPage = safePath(); write(sessionKey, JSON.stringify(activeSession)); }
    queue.push({ id: eventId, name: name, timestamp: new Date().toISOString(), path: pathOverride || safePath(), visitorId: visitorId(), sessionId: activeSession.id, referrer: referrer, properties: clean, schemaVersion: 1 });
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else schedule();
  }
  function pageview() {
    var next = routeKey();
    if (next === currentUrl) return;
    flushVitals(currentPath || safePath());
    resetVitals();
    var previous = currentUrl, referrer;
    currentUrl = next;
    currentPath = safePath();
    if (previous) { try { referrer = new URL(previous, root.location.origin).hostname; } catch (_) {} }
    capture('pageview', undefined, referrer);
  }
  function patchHistory(method) {
    var original = root.history[method];
    if (typeof original !== 'function' || original.__creasePatched) return;
    function wrapped() { var result = original.apply(this, arguments); root.dispatchEvent(new Event('crease:navigation')); return result; }
    wrapped.__creasePatched = true; wrapped.__creaseOriginal = original; root.history[method] = wrapped;
  }
  function init(config) {
    if (enabled || !config || !config.projectId || !config.endpoint) return;
    if (typeof config.writeKey !== 'string' || !/^crease_[A-Za-z0-9_-]{16,}$/.test(config.writeKey)) return;
    var endpoint; try { endpoint = new URL(config.endpoint, root.location.href); } catch (_) { return; }
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost') return;
    options = { projectId: String(config.projectId), endpoint: endpoint.href, writeKey: config.writeKey };
    enabled = true; currentUrl = null; resetVitals(); observeVitals();
    patchHistory('pushState'); patchHistory('replaceState');
    routeHandler = pageview; leaveHandler = leaving; visibilityHandler = hidden;
    root.addEventListener('popstate', routeHandler);
    root.addEventListener('crease:navigation', routeHandler);
    root.addEventListener('pagehide', leaveHandler);
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', visibilityHandler);
    pageview();
  }
  function reset() { remove(visitorKey); remove(sessionKey); resetVitals(); if (enabled) { currentUrl = null; currentPath = null; pageview(); } }
  function optOut() {
    enabled = false; queue = []; currentUrl = null;
    if (timer) root.clearTimeout(timer); timer = null;
    if (routeHandler) { root.removeEventListener('popstate', routeHandler); root.removeEventListener('crease:navigation', routeHandler); }
    if (leaveHandler) root.removeEventListener('pagehide', leaveHandler);
    if (visibilityHandler && root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', visibilityHandler);
    observerList.forEach(function (observer) { try { observer.disconnect(); } catch (_) {} }); observerList = [];
    resetVitals(); remove(visitorKey); remove(sessionKey);
  }
  root.crease = { init: init, capture: capture, pageview: pageview, flush: flush, optOut: optOut, reset: reset, identify: function () { return visitorId(); } };
})(window);
