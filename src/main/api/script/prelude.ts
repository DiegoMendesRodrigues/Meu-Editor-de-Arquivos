// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * "Prelude" do sandbox: JavaScript avaliado dentro do próprio QuickJS que monta a API do script
 * (req, res, env, vars, test, expect, console, crypto, uuid e o alias pm). O resultado da avaliação é
 * uma função que recebe o estado em JSON e devolve outra, que o Main chama no fim para recolher o que
 * o script fez (console, testes, variáveis, requisição). Só crypto e uuid dependem do host
 * (__hmac, __hash, __uuid, __b64e, __b64d), e o prelude apaga esses nomes do escopo global.
 * Não usar crases nem "dollar-chave" aqui dentro: o texto vive num template literal.
 */
export const PRELUDE = String.raw`(function (stateJson) {
  'use strict';
  var g = globalThis;
  var S = JSON.parse(stateJson);
  var hostHmac = g.__hmac, hostHash = g.__hash, hostUuid = g.__uuid, hostB64e = g.__b64e, hostB64d = g.__b64d, hostSend = g.__send;
  delete g.__hmac; delete g.__hash; delete g.__uuid; delete g.__b64e; delete g.__b64d; delete g.__send;
  var stringify = JSON.stringify, parse = JSON.parse, hasOwn = Object.prototype.hasOwnProperty;
  var isPre = S.phase === 'pre';

  var logs = [], tests = [], envSets = Object.create(null), varSets = Object.create(null), secretsRead = Object.create(null);
  var secretNames = Object.create(null);
  S.secretNames.forEach(function (n) { secretNames[n] = true; });

  function str(v) {
    if (typeof v === 'string') return v;
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') { try { return stringify(v); } catch (e) { /* cai no String */ } }
    return String(v);
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n) : s; }
  function inspect(v) {
    if (typeof v === 'string') return stringify(v);
    if (typeof v === 'function') return '[Function]';
    if (v === undefined) return 'undefined';
    try { var s = stringify(v); return s === undefined ? String(v) : clip(s, 120); } catch (e) { return String(v); }
  }
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    var t = typeof v;
    if (t === 'object') { var tag = Object.prototype.toString.call(v).slice(8, -1).toLowerCase(); return tag === 'object' ? 'object' : tag; }
    return t;
  }
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a !== a && b !== b;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!hasOwn.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }
  function errText(e) {
    var m = e && e.message !== undefined ? e.message : e;
    return clip(str(m), 500);
  }

  /* ---------------------------------------------------------------- console */
  function logger(level) {
    return function () {
      if (logs.length >= S.maxLogLines) return;
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        parts.push(typeof a === 'string' ? a : inspect(a));
      }
      logs.push({ level: level, text: clip(parts.join(' '), 4000) });
    };
  }
  g.console = { log: logger('log'), info: logger('info'), warn: logger('warn'), error: logger('error'), debug: logger('log') };

  /* ---------------------------------------------------------------- variáveis */
  function readEnv(name) {
    name = String(name);
    if (hasOwn.call(envSets, name)) return envSets[name].value;
    if (hasOwn.call(S.values, name)) {
      if (secretNames[name]) secretsRead[name] = true;
      return S.values[name];
    }
    return undefined;
  }
  var env = {
    get: readEnv,
    set: function (name, value, opts) {
      name = String(name);
      envSets[name] = { value: clip(str(value), 100000), secret: !!(opts && opts.secret) };
    },
    has: function (name) { return readEnv(name) !== undefined; },
    unset: function (name) { delete envSets[String(name)]; }
  };
  var vars = {
    get: function (name) {
      name = String(name);
      return hasOwn.call(varSets, name) ? varSets[name] : readEnv(name);
    },
    set: function (name, value) { varSets[String(name)] = clip(str(value), 100000); },
    has: function (name) { return vars.get(name) !== undefined; }
  };

  /* ---------------------------------------------------------------- requisição e resposta */
  function toObject(list) {
    var o = {};
    list.forEach(function (kv) {
      o[kv[0]] = hasOwn.call(o, kv[0]) ? o[kv[0]] + ', ' + kv[1] : kv[1];
    });
    return o;
  }
  function findKey(obj, name) {
    var low = String(name).toLowerCase();
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === low) return keys[i];
    return undefined;
  }
  function headerApi(obj) {
    Object.defineProperty(obj, 'get', { enumerable: false, value: function (name) { var k = findKey(obj, name); return k === undefined ? undefined : obj[k]; } });
    Object.defineProperty(obj, 'has', { enumerable: false, value: function (name) { return findKey(obj, name) !== undefined; } });
    return obj;
  }
  var req = { method: S.req.method, url: S.req.url, headers: headerApi(toObject(S.req.headers)), body: S.req.body };
  var res;
  if (!isPre) {
    var resHeaders = headerApi(toObject(S.res.headers));
    res = {
      status: S.res.status,
      statusText: S.res.statusText,
      headers: resHeaders,
      responseTime: S.res.responseTime,
      text: function () { return S.res.body; },
      json: function () { return parse(S.res.body); }
    };
    Object.freeze(req.headers); Object.freeze(req); Object.freeze(res.headers);
  }

  /* ---------------------------------------------------------------- expect (estilo Chai) */
  function AssertionError(message) { this.name = 'AssertionError'; this.message = message; }
  AssertionError.prototype = Object.create(Error.prototype);
  AssertionError.prototype.constructor = AssertionError;

  function Assertion(obj, negate, deep) { this.__o = obj; this.__n = !!negate; this.__d = !!deep; }
  var P = Assertion.prototype;
  function check(self, cond, pos, neg) {
    if (self.__n ? cond : !cond) throw new AssertionError(self.__n ? neg : pos);
    return self;
  }
  ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'but', 'does', 'still', 'also', 'all', 'any'].forEach(function (w) {
    Object.defineProperty(P, w, { get: function () { return this; } });
  });
  Object.defineProperty(P, 'not', { get: function () { return new Assertion(this.__o, !this.__n, this.__d); } });
  Object.defineProperty(P, 'deep', { get: function () { return new Assertion(this.__o, this.__n, true); } });
  function flagProp(name, fn, label) {
    Object.defineProperty(P, name, { get: function () {
      return check(this, fn(this.__o), 'expected ' + inspect(this.__o) + ' to be ' + label, 'expected ' + inspect(this.__o) + ' not to be ' + label);
    } });
  }
  flagProp('ok', function (o) { return !!o; }, 'truthy');
  flagProp('true', function (o) { return o === true; }, 'true');
  flagProp('false', function (o) { return o === false; }, 'false');
  flagProp('null', function (o) { return o === null; }, 'null');
  flagProp('undefined', function (o) { return o === undefined; }, 'undefined');
  flagProp('exist', function (o) { return o !== null && o !== undefined; }, 'existing');
  flagProp('empty', function (o) {
    if (typeof o === 'string' || Array.isArray(o)) return o.length === 0;
    if (o && typeof o === 'object') return Object.keys(o).length === 0;
    return false;
  }, 'empty');

  function method(names, fn) {
    names.forEach(function (n) { P[n] = fn; });
  }
  method(['equal', 'equals', 'eq'], function (v) {
    var eq = this.__d ? deepEqual(this.__o, v) : this.__o === v;
    return check(this, eq, 'expected ' + inspect(this.__o) + ' to equal ' + inspect(v), 'expected ' + inspect(this.__o) + ' not to equal ' + inspect(v));
  });
  method(['eql', 'eqls'], function (v) {
    return check(this, deepEqual(this.__o, v), 'expected ' + inspect(this.__o) + ' to deeply equal ' + inspect(v), 'expected ' + inspect(this.__o) + ' not to deeply equal ' + inspect(v));
  });
  method(['a', 'an'], function (t) {
    var actual = typeOf(this.__o);
    return check(this, actual === String(t).toLowerCase(), 'expected ' + inspect(this.__o) + ' to be a ' + t, 'expected ' + inspect(this.__o) + ' not to be a ' + t);
  });
  method(['include', 'includes', 'contain', 'contains'], function (v) {
    var o = this.__o, found = false, self = this;
    if (typeof o === 'string') found = o.indexOf(String(v)) >= 0;
    else if (Array.isArray(o)) found = o.some(function (x) { return x === v || ((self.__d || typeof v === 'object') && deepEqual(x, v)); });
    else if (o && typeof o === 'object' && v && typeof v === 'object') {
      found = Object.keys(v).every(function (k) { return hasOwn.call(o, k) && (self.__d ? deepEqual(o[k], v[k]) : o[k] === v[k]); });
    }
    return check(this, found, 'expected ' + inspect(o) + ' to include ' + inspect(v), 'expected ' + inspect(o) + ' not to include ' + inspect(v));
  });
  P.property = function (name, val) {
    var o = this.__o;
    var has = o !== null && o !== undefined && name in Object(o);
    if (arguments.length > 1) {
      var same = has && (this.__d ? deepEqual(o[name], val) : o[name] === val);
      return check(this, same, 'expected ' + inspect(o) + ' to have property ' + inspect(name) + ' of ' + inspect(val), 'expected ' + inspect(o) + ' not to have property ' + inspect(name) + ' of ' + inspect(val));
    }
    check(this, has, 'expected ' + inspect(o) + ' to have property ' + inspect(name), 'expected ' + inspect(o) + ' not to have property ' + inspect(name));
    return this.__n ? this : new Assertion(o[name], false, this.__d);
  };
  method(['lengthOf', 'length'], function (n) {
    var len = this.__o === null || this.__o === undefined ? undefined : this.__o.length;
    return check(this, len === n, 'expected ' + inspect(this.__o) + ' to have length ' + n + ' but got ' + len, 'expected ' + inspect(this.__o) + ' not to have length ' + n);
  });
  function cmp(names, label, fn) {
    method(names, function (n) {
      return check(this, typeof this.__o === 'number' && fn(this.__o, n), 'expected ' + inspect(this.__o) + ' to be ' + label + ' ' + n, 'expected ' + inspect(this.__o) + ' not to be ' + label + ' ' + n);
    });
  }
  cmp(['above', 'gt', 'greaterThan'], 'above', function (a, b) { return a > b; });
  cmp(['below', 'lt', 'lessThan'], 'below', function (a, b) { return a < b; });
  cmp(['least', 'gte'], 'at least', function (a, b) { return a >= b; });
  cmp(['most', 'lte'], 'at most', function (a, b) { return a <= b; });
  P.within = function (lo, hi) {
    return check(this, typeof this.__o === 'number' && this.__o >= lo && this.__o <= hi, 'expected ' + inspect(this.__o) + ' to be within ' + lo + '..' + hi, 'expected ' + inspect(this.__o) + ' not to be within ' + lo + '..' + hi);
  };
  P.closeTo = function (n, d) {
    return check(this, typeof this.__o === 'number' && Math.abs(this.__o - n) <= d, 'expected ' + inspect(this.__o) + ' to be close to ' + n, 'expected ' + inspect(this.__o) + ' not to be close to ' + n);
  };
  method(['match', 'matches'], function (re) {
    return check(this, typeof this.__o === 'string' && re.test(this.__o), 'expected ' + inspect(this.__o) + ' to match ' + String(re), 'expected ' + inspect(this.__o) + ' not to match ' + String(re));
  });
  P.string = function (sub) {
    return check(this, typeof this.__o === 'string' && this.__o.indexOf(sub) >= 0, 'expected ' + inspect(this.__o) + ' to contain ' + inspect(sub), 'expected ' + inspect(this.__o) + ' not to contain ' + inspect(sub));
  };
  method(['keys', 'key'], function () {
    var want = [].concat.apply([], arguments).map(String).sort();
    var have = this.__o && typeof this.__o === 'object' ? Object.keys(this.__o).sort() : [];
    return check(this, deepEqual(want, have), 'expected ' + inspect(this.__o) + ' to have keys ' + inspect(want), 'expected ' + inspect(this.__o) + ' not to have keys ' + inspect(want));
  });
  P.oneOf = function (list) {
    return check(this, Array.isArray(list) && list.indexOf(this.__o) >= 0, 'expected ' + inspect(this.__o) + ' to be one of ' + inspect(list), 'expected ' + inspect(this.__o) + ' not to be one of ' + inspect(list));
  };
  P.satisfy = function (fn) {
    return check(this, !!fn(this.__o), 'expected ' + inspect(this.__o) + ' to satisfy the function', 'expected ' + inspect(this.__o) + ' not to satisfy the function');
  };
  P.status = function (code) {
    var o = this.__o;
    var s = o ? (o.status !== undefined ? o.status : o.code) : undefined;
    return check(this, s === code, 'expected response to have status ' + code + ' but got ' + s, 'expected response not to have status ' + code);
  };
  function expect(v) { return new Assertion(v, false, false); }

  /* ---------------------------------------------------------------- test */
  function test(name, fn) {
    if (tests.length >= 500) return;
    var entry = { name: clip(String(name), 300), passed: true };
    tests.push(entry);
    try {
      var r = typeof fn === 'function' ? fn() : undefined;
      if (r && typeof r.then === 'function') {
        r.then(null, function (e) { entry.passed = false; entry.error = errText(e); });
      }
    } catch (e) {
      entry.passed = false;
      entry.error = errText(e);
    }
  }

  /* ---------------------------------------------------------------- crypto */
  function enc(e) { return e === 'base64' ? 'base64' : 'hex'; }
  var cryptoApi = {
    hmac: function (alg, key, data, e) { return hostHmac(String(alg).toLowerCase(), str(key), str(data), enc(e)); },
    sha1: function (data, e) { return hostHash('sha1', str(data), enc(e)); },
    sha256: function (data, e) { return hostHash('sha256', str(data), enc(e)); },
    sha512: function (data, e) { return hostHash('sha512', str(data), enc(e)); },
    md5: function (data, e) { return hostHash('md5', str(data), enc(e)); },
    base64: {
      encode: function (data) { return hostB64e(str(data)); },
      decode: function (data) { return hostB64d(str(data)); }
    },
    uuid: function () { return hostUuid(); }
  };
  g.crypto = cryptoApi;
  g.uuid = function () { return hostUuid(); };

  /* ---------------------------------------------------------------- API pública */
  g.env = env; g.vars = vars; g.test = test; g.expect = expect; g.req = req;
  if (!isPre) g.res = res;

  function setHeader(h) {
    var k = findKey(req.headers, h.key);
    if (k !== undefined) delete req.headers[k];
    req.headers[String(h.key)] = str(h.value);
  }
  /* pm.sendRequest: a rede fica no Main; aqui só se monta o pedido e se embrulha a resposta. */
  function pairs(list) {
    var out = [];
    if (Array.isArray(list)) {
      list.forEach(function (it) {
        if (it && typeof it === 'object' && it.disabled !== true && it.key !== undefined) out.push([str(it.key), str(it.value)]);
      });
    } else if (list && typeof list === 'object') {
      Object.keys(list).forEach(function (k) { out.push([k, str(list[k])]); });
    }
    return out;
  }
  function sendSpec(a) {
    if (typeof a === 'string') return { url: a, method: 'GET', headers: [], body: { mode: 'none' } };
    if (!a || typeof a !== 'object') throw new Error('invalid');
    var url = typeof a.url === 'object' && a.url ? (a.url.raw !== undefined ? a.url.raw : '') : a.url;
    var b = a.body, body = { mode: 'none' };
    if (typeof b === 'string') body = { mode: 'raw', raw: b };
    else if (b && typeof b === 'object') {
      if (b.mode === 'raw') body = { mode: 'raw', raw: str(b.raw) };
      else if (b.mode === 'urlencoded') body = { mode: 'urlencoded', fields: pairs(b.urlencoded) };
      else if (b.mode === 'formdata') body = { mode: 'formdata', fields: pairs(b.formdata) };
    }
    return { url: str(url), method: String(a.method || 'GET').toUpperCase(), headers: pairs(a.header !== undefined ? a.header : a.headers), body: body };
  }
  function sendErr(code) { return { name: 'ApiError', code: String(code), message: String(code) }; }
  function sendRes(r) {
    return {
      code: r.code,
      status: r.status,
      headers: headerApi(toObject(r.headers)),
      responseTime: r.responseTime,
      text: function () { return r.body; },
      json: function () { return parse(r.body); }
    };
  }
  function sendRequest(a, cb) {
    var done = new Promise(function (resolve) {
      var spec;
      try { spec = sendSpec(a); } catch (e) { return resolve({ err: sendErr('invalidRequest') }); }
      spec.read = Object.keys(secretsRead); hostSend(stringify(spec)).then(function (json) {
        var o;
        try { o = parse(json); } catch (e) { o = { ok: false, code: 'unknown' }; }
        resolve(o && o.ok ? { err: null, res: sendRes(o.res) } : { err: sendErr(o && o.code), res: undefined });
      });
    });
    if (typeof cb === 'function') {
      return done.then(function (r) {
        try { cb(r.err, r.res); } catch (e) { console.error('pm.sendRequest callback: ' + errText(e)); }
        return r.res;
      });
    }
    return done.then(function (r) { if (r.err) throw r.err; return r.res; });
  }
  var pm = {
    environment: env,
    globals: env,
    variables: vars,
    collectionVariables: { get: env.get, set: env.set, has: env.has, unset: env.unset },
    test: test,
    expect: expect,
    info: { eventName: isPre ? 'prerequest' : 'test' },
    sendRequest: sendRequest,
    request: {
      get url() { return req.url; },
      set url(v) { req.url = String(v); },
      get method() { return req.method; },
      set method(v) { req.method = String(v); },
      get body() { return req.body; },
      headers: {
        add: setHeader,
        upsert: setHeader,
        get: function (n) { return req.headers.get(n); },
        has: function (n) { return req.headers.has(n); },
        remove: function (n) { var k = findKey(req.headers, n); if (k !== undefined) delete req.headers[k]; }
      }
    }
  };
  if (!isPre) {
    var to = new Assertion(res, false, false);
    var statusProp = function (name, fn, label) {
      Object.defineProperty(to, name, { get: function () {
        return check(this, fn(res.status), 'expected response to be ' + label + ' but got ' + res.status, 'expected response not to be ' + label);
      } });
    };
    statusProp('ok', function (s) { return s === 200; }, 'ok (200)');
    statusProp('success', function (s) { return s >= 200 && s < 300; }, 'successful');
    statusProp('clientError', function (s) { return s >= 400 && s < 500; }, 'a client error');
    statusProp('serverError', function (s) { return s >= 500 && s < 600; }, 'a server error');
    statusProp('error', function (s) { return s >= 400 && s < 600; }, 'an error');
    statusProp('withBody', function () { return res.text().length > 0; }, 'with a body');
    pm.response = {
      code: res.status,
      status: res.statusText,
      headers: res.headers,
      responseTime: res.responseTime,
      text: res.text,
      json: res.json,
      to: to
    };
  }
  g.pm = pm;

  /* ---------------------------------------------------------------- coleta */
  return function () {
    var out = {
      logs: logs,
      tests: tests,
      envSets: Object.keys(envSets).map(function (k) { return { name: k, value: envSets[k].value, secret: envSets[k].secret }; }),
      varSets: Object.keys(varSets).map(function (k) { return { name: k, value: varSets[k] }; }),
      secretsRead: Object.keys(secretsRead)
    };
    if (isPre) {
      out.req = {
        method: str(req.method),
        url: str(req.url),
        headers: Object.keys(req.headers).map(function (k) { return [k, str(req.headers[k])]; }),
        body: str(req.body)
      };
    }
    return stringify(out);
  };
})`
