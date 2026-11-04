/* =========================================================================
   READ CACHE (usage bachane ke liye)
   Poore collection ka .get() (jaise days, ledger, tanker_invoices) ab
   90 second tak memory mein rakha jata hai. Koi bhi write (set/update/
   delete/add/batch/transaction) us collection ka cache turant clear karta hai,
   isliye apne hi device par data hamesha taaza rahta hai.
   Sirf .where()/.orderBy() wali queries ko nahi chhuta. onSnapshot bhi nahi.
   Ye file firebase-firestore.js ke baad aur app_core.js se pehle load honi chahiye.
   ========================================================================= */
(function () {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  const F = firebase.firestore;
  const TTL = 90 * 1000;
  const cache = new Map();   // path -> { t, snap }
  const inflight = new Map(); // path -> promise
  const gen = new Map();      // path -> generation (write hone par badhta hai)

  const pathOf = ref => {
    try { return ref.parent ? ref.parent.path : (ref.path || null); } catch (e) { return null; }
  };
  const bust = path => {
    if (!path) return;
    cache.delete(path);
    inflight.delete(path);
    gen.set(path, (gen.get(path) || 0) + 1);
  };
  const bustAll = () => { for (const p of [...cache.keys(), ...inflight.keys()]) bust(p); };

  // ---- writes: DocumentReference ----
  ['set', 'update', 'delete'].forEach(m => {
    const orig = F.DocumentReference.prototype[m];
    if (!orig) return;
    F.DocumentReference.prototype[m] = function () {
      const p = pathOf(this);
      bust(p);
      const r = orig.apply(this, arguments);
      if (r && r.then) r.then(() => bust(p), () => bust(p));
      return r;
    };
  });

  // ---- writes: CollectionReference.add ----
  if (F.CollectionReference.prototype.add) {
    const origAdd = F.CollectionReference.prototype.add;
    F.CollectionReference.prototype.add = function () {
      const p = pathOf(this) || this.path;
      bust(p);
      const r = origAdd.apply(this, arguments);
      if (r && r.then) r.then(() => bust(p), () => bust(p));
      return r;
    };
  }

  // ---- writes: WriteBatch (set/update/delete collect karte hain, commit par clear) ----
  const batchProto = F.WriteBatch && F.WriteBatch.prototype;
  if (batchProto) {
    ['set', 'update', 'delete'].forEach(m => {
      const orig = batchProto[m];
      if (!orig) return;
      batchProto[m] = function (ref) {
        (this.__psPaths = this.__psPaths || new Set()).add(pathOf(ref));
        return orig.apply(this, arguments);
      };
    });
    const origCommit = batchProto.commit;
    if (origCommit) {
      batchProto.commit = function () {
        const paths = this.__psPaths ? [...this.__psPaths] : [];
        paths.forEach(bust);
        const r = origCommit.apply(this, arguments);
        if (r && r.then) r.then(() => paths.forEach(bust), () => paths.forEach(bust));
        return r;
      };
    }
  }

  // ---- transactions: kuch bhi badal sakti hai, sab clear ----
  const TxProto = F.Firestore && F.Firestore.prototype;
  const origTx = TxProto && TxProto.runTransaction;
  if (origTx) {
    TxProto.runTransaction = function () {
      bustAll();
      const r = origTx.apply(this, arguments);
      if (r && r.then) r.then(bustAll, bustAll);
      return r;
    };
  }

  // ---- reads: poora collection .get() ----
  const origGet = F.CollectionReference.prototype.get;
  F.CollectionReference.prototype.get = function (opts) {
    if (opts) return origGet.call(this, opts); // source: 'server' etc. ko direct jane do
    const key = this.path;
    const c = cache.get(key);
    if (c && Date.now() - c.t < TTL) return Promise.resolve(c.snap);
    if (inflight.has(key)) return inflight.get(key);
    const g = gen.get(key) || 0;
    const p = origGet.call(this).then(
      snap => {
        if ((gen.get(key) || 0) === g) cache.set(key, { t: Date.now(), snap });
        if (inflight.get(key) === p) inflight.delete(key);
        return snap;
      },
      err => { if (inflight.get(key) === p) inflight.delete(key); throw err; }
    );
    inflight.set(key, p);
    return p;
  };

  // debug / manual reset ke liye
  window.PS_READ_CACHE = { bustAll, bust, ttlMs: TTL, size: () => cache.size };
})();
