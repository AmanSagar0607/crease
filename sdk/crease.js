/* Crease browser SDK. Call init only after obtaining any required consent. */
(function (root) {
  'use strict';
  var options, queue = [], timer, currentPath, enabled = false;
  var visitorKey = 'crease_visitor', sessionKey = 'crease_session';
  function id() {
    if (!root.crypto || !root.crypto.randomUUID) return null;
    return root.crypto.randomUUID();
  }
  function stored(storageName, key) {
    try {
      var storage = root[storageName];
      var value = storage.getItem(key);
      if (!value) { value = id(); if (value) storage.setItem(key, value); }
      return value;
    } catch (_) { return null; }
  }
  function safePath() { return root.location.pathname; }
  function schedule() {
    if (!timer) timer = root.setTimeout(flush, 2000);
  }
  function flush() {
    if (timer) root.clearTimeout(timer);
    timer = null;
    if (!enabled || !queue.length) return;
    var batch = queue.slice(0, 20);
    queue = queue.slice(batch.length);
    root.fetch(options.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Crease-Key': options.writeKey },
      body: JSON.stringify({ projectId: options.projectId, events: batch }),
      keepalive: true, credentials: 'omit'
    }).then(function (response) {
      if (!response.ok && (response.status === 429 || response.status >= 500)) throw new Error('Temporary ingestion failure');
    }).catch(function () {
      if (!enabled) return;
      queue = batch.concat(queue).slice(0, 100);
      if (!timer) timer = root.setTimeout(flush, 10000);
    });
    if (queue.length) schedule();
  }
  function capture(name, properties) {
    if (!enabled || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
    var eventId = id();
    if (!eventId) return;
    var clean = {};
    if (properties && typeof properties === 'object') Object.keys(properties).slice(0, 20).forEach(function (key) {
      var value = properties[key];
      if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && !/password|token|secret|email/i.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && isFinite(value)))) clean[key] = value;
    });
    var referrer = null;
    try { if (root.document.referrer) referrer = new URL(root.document.referrer).hostname; } catch (_) {}
    queue.push({ id: eventId, name: name, timestamp: new Date().toISOString(), path: safePath(), visitorId: stored('localStorage', visitorKey), sessionId: stored('sessionStorage', sessionKey), referrer: referrer, properties: clean });
    if (queue.length > 100) queue.shift();
    if (queue.length >= 20) flush(); else schedule();
  }
  function pageview() { var path = safePath(); if (path !== currentPath) { currentPath = path; capture('pageview'); } }
  function init(config) {
    if (enabled || !config || !config.projectId || !config.endpoint) return;
    if (typeof config.writeKey !== 'string' || !/^crease_[A-Za-z0-9_-]{16,}$/.test(config.writeKey)) return;
    var endpoint;
    try { endpoint = new URL(config.endpoint, root.location.href); } catch (_) { return; }
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost') return;
    options = { projectId: String(config.projectId), endpoint: endpoint.href, writeKey: config.writeKey };
    enabled = true; currentPath = null; pageview();
    root.addEventListener('popstate', pageview);
    root.addEventListener('pagehide', flush);
  }
  function optOut() {
    enabled = false; queue = []; currentPath = null;
    if (timer) root.clearTimeout(timer); timer = null;
    root.removeEventListener('popstate', pageview); root.removeEventListener('pagehide', flush);
    try { root.localStorage.removeItem(visitorKey); root.sessionStorage.removeItem(sessionKey); } catch (_) {}
  }
  root.crease = { init: init, capture: capture, pageview: pageview, flush: flush, optOut: optOut };
})(window);
