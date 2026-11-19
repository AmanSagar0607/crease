/* Zappa standalone browser tracker. MIT licensed; mirrors packages/zappa-analytics. */
(function (window, document) {
  'use strict';

  var api = window.Zappa || (window.Zappa = {});
  var VISITOR_PREFIX = 'Zappa_visitor:';
  var SESSION_PREFIX = 'Zappa_session:';
  var IDLE_MS = 30 * 60 * 1000;
  var MAX_SESSION_MS = 24 * 60 * 60 * 1000;
  api.capture = function (name, properties) {
    var active = window.__ZappaAnalytics;
    if (active && typeof active.track === 'function') return active.track(name, properties);
  };
  var DEFAULT_ENDPOINT;
  try { DEFAULT_ENDPOINT = new URL('/api/events', (document.currentScript && document.currentScript.src) || window.location.href).href; } catch (_) { DEFAULT_ENDPOINT = '/api/events'; }

  function id() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (_) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function storageRead(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } }
  function storageWrite(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} }
  function storageRemove(key) { try { window.localStorage.removeItem(key); } catch (_) {} }

  api.init = function (options) {
    options = options || {};
    if (!options.projectId || typeof options.projectId !== 'string' ||
        typeof options.writeKey !== 'string' || !/^Zappa_[A-Za-z0-9_-]{16,}$/.test(options.writeKey)) {
      return { track: function () {}, page: function () {}, identify: function () { return null; }, reset: function () {}, optOut: function () {}, destroy: function () {} };
    }

    var projectId = options.projectId;
    if (window.__ZappaAnalytics && window.__ZappaAnalytics.projectId === projectId) return window.__ZappaAnalytics;
    if (window.__ZappaAnalytics && window.__ZappaAnalytics.destroy) window.__ZappaAnalytics.destroy();

    var endpoint = options.endpoint || DEFAULT_ENDPOINT;
    try {
      var parsedEndpoint = new URL(endpoint, window.location.href);
      if (parsedEndpoint.protocol !== 'https:' && parsedEndpoint.hostname !== 'localhost' && parsedEndpoint.hostname !== '127.0.0.1') throw new Error('Invalid collector URL');
      endpoint = parsedEndpoint.href;
    } catch (_) {
      return { track: function () {}, page: function () {}, identify: function () { return null; }, reset: function () {}, optOut: function () {}, destroy: function () {} };
    }

    var visitorKey = VISITOR_PREFIX + projectId;
    var sessionKey = SESSION_PREFIX + projectId;
    var queue = [];
    var timer = null;
    var lastUrl = '';
    var previousPath = '';
    var enabled = true;
    var originals = {};

    function visitor() {
      if (!enabled) return null;
      var value = storageRead(visitorKey);
      if (!value) { value = id(); storageWrite(visitorKey, value); }
      return value;
    }

    function activeSession() {
      var now = Date.now();
      var state;
      try { state = JSON.parse(storageRead(sessionKey) || 'null'); } catch (_) { state = null; }
      if (!state || !state.id || now - state.lastActivity >= IDLE_MS || now - state.startedAt >= MAX_SESSION_MS) {
        state = { id: id(), startedAt: now, lastActivity: now, entryPage: window.location.pathname, exitPage: window.location.pathname, pageviews: 0 };
      }
      state.lastActivity = now;
      storageWrite(sessionKey, JSON.stringify(state));
      return state;
    }

    function attribution() {
      var result = {};
      try {
        var params = new URL(window.location.href).searchParams;
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
          var value = params.get(key);
          if (value && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,127}$/.test(value)) result[key] = value;
        });
      } catch (_) {}
      return result;
    }

    function flush() {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (!enabled || !queue.length) return;
      var batch = queue.splice(0, 20);
      window.fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-Zappa-Key': options.writeKey },
        body: JSON.stringify({ projectId: projectId, events: batch })
      }).then(function (response) {
        if (!response.ok && (response.status === 429 || response.status >= 500)) throw new Error('Temporary ingestion failure');
      }).catch(function () {
        if (enabled) { queue = batch.concat(queue).slice(0, 100); timer = window.setTimeout(flush, 10000); }
      });
      if (queue.length) timer = window.setTimeout(flush, 2000);
    }

    function track(name, properties, pathOverride, referrerOverride) {
      if (!enabled || typeof name !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return;
      var safeProperties = {};
      if (properties && typeof properties === 'object') {
        Object.keys(properties).slice(0, 20).forEach(function (key) {
          var value = properties[key];
          if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key) && !/password|token|secret|email/i.test(key) &&
              (typeof value === 'boolean' || (typeof value === 'number' && isFinite(value)))) safeProperties[key] = value;
        });
      }
      var session = activeSession();
      if (name === 'pageview') {
        session.pageviews += 1;
        session.exitPage = window.location.pathname;
        storageWrite(sessionKey, JSON.stringify(session));
      }
      var referrer = referrerOverride;
      if (typeof referrer === 'undefined') {
        try { referrer = document.referrer ? new URL(document.referrer).hostname : null; } catch (_) { referrer = null; }
      }
      var event = {
        id: id(), name: name, timestamp: new Date().toISOString(),
        path: pathOverride || window.location.pathname,
        visitorId: visitor(), sessionId: session.id, referrer: referrer,
        properties: safeProperties, schemaVersion: 1
      };
      if (name === 'pageview') event.attribution = attribution();
      queue.push(event);
      if (queue.length > 100) queue.shift();
      if (queue.length >= 20) flush();
      else if (!timer) timer = window.setTimeout(flush, 2000);
    }

    function page() {
      var url = window.location.pathname + window.location.search;
      if (!enabled || url === lastUrl) return;
      var oldUrl = lastUrl;
      lastUrl = url;
      previousPath = window.location.pathname;
      track('pageview', {}, undefined, oldUrl ? window.location.hostname : undefined);
    }

    function leaving() { flush(); }
    function visibilityChanged() { if (document.visibilityState === 'hidden') leaving(); }
    function announceRoute() { window.dispatchEvent(new Event('Zappa:navigation')); }

    ['pushState', 'replaceState'].forEach(function (method) {
      var original = window.history[method];
      if (typeof original !== 'function' || original.__ZappaPatched) return;
      var wrapped = function () {
        var result = original.apply(this, arguments);
        announceRoute();
        return result;
      };
      wrapped.__ZappaPatched = true;
      originals[method] = original;
      window.history[method] = wrapped;
    });

    var instance = {
      projectId: projectId,
      track: track,
      page: page,
      flush: flush,
      identify: visitor,
      reset: function () {
        storageRemove(visitorKey); storageRemove(sessionKey);
        lastUrl = ''; previousPath = '';
        page();
      },
      optOut: function () {
        enabled = false; queue = []; lastUrl = '';
        storageRemove(visitorKey); storageRemove(sessionKey);
        if (timer) window.clearTimeout(timer);
        timer = null;
      },
      destroy: function () {
        enabled = false; queue = [];
        window.removeEventListener('popstate', page);
        window.removeEventListener('Zappa:navigation', page);
        window.removeEventListener('pagehide', leaving);
        document.removeEventListener('visibilitychange', visibilityChanged);
        Object.keys(originals).forEach(function (method) {
          var current = window.history[method];
          if (current && current.__ZappaPatched) window.history[method] = originals[method];
        });
        if (timer) window.clearTimeout(timer);
        timer = null;
        if (window.__ZappaAnalytics === instance) delete window.__ZappaAnalytics;
      }
    };

    window.addEventListener('popstate', page);
    window.addEventListener('Zappa:navigation', page);
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.__ZappaAnalytics = instance;
    page();
    return instance;
  };
})(window, document);
