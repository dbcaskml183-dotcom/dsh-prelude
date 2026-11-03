// host/transaction-gate.mjs
import { DatabaseSync } from "node:sqlite";
import { lstatSync, fstatSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, linkSync, unlinkSync, renameSync, chmodSync, constants } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID, createHash } from "node:crypto";
var PROTOCOL = "prelude-json-gate/v1";
var CoordinationError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CoordinationError";
    this.code = code;
  }
};
var busy = (e) => [5, 6].includes(e?.errcode) || /database (?:is )?(?:locked|busy)/i.test(e?.message || "");
var missing = (e) => e?.code === "ENOENT";
var hash = (b) => createHash("sha256").update(b).digest("hex");
var TransactionGate = class {
  constructor(dir, legacyName) {
    this.dir = dir;
    this.path = join(dir, ".coordination.sqlite");
    this.legacy = join(dir, legacyName);
  }
  marker() {
    try {
      const st = lstatSync(this.legacy);
      if (!st.isFile() || st.isSymbolicLink() || st.size > 4096) return { state: "unknown", message: "\u65E7\u7248\u9501\u5F52\u5C5E\u65E0\u6CD5\u786E\u8BA4\uFF0C\u5DF2\u4FDD\u7559\uFF1B\u8BF7\u505C\u7528\u5171\u4EAB\u6B64\u76EE\u5F55\u7684\u5199\u5165\u8005\u540E\u79BB\u7EBF\u68C0\u67E5\u3002" };
      const fd = openSync(this.legacy, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        const opened = fstatSync(fd);
        if (opened.dev !== st.dev || opened.ino !== st.ino || opened.size > 4096) throw new CoordinationError("GATE_CHANGED", "\u9501\u5728\u8BFB\u53D6\u671F\u95F4\u53D1\u751F\u53D8\u5316\uFF0C\u5DF2\u505C\u6B62\u3002");
        bytes = readFileSync(fd);
      } finally {
        closeSync(fd);
      }
      let value;
      try {
        value = JSON.parse(bytes);
      } catch {
        return { state: "unknown", message: "\u68C0\u6D4B\u5230\u7A7A\u767D\u6216\u635F\u574F\u7684\u65E7\u7248\u9501\uFF1B\u4E0D\u4F1A\u636E\u6B64\u62A2\u9501\uFF0C\u8BF7\u79BB\u7EBF\u68C0\u67E5\u3002" };
      }
      return { state: "present", value, dev: st.dev, ino: st.ino, sha256: hash(bytes) };
    } catch (e) {
      if (missing(e)) return { state: "absent" };
      throw e;
    }
  }
  health() {
    try {
      const m = this.marker();
      if (m.state === "absent") return { state: "ready", file: basename(this.legacy) };
      if (m.state === "present" && m.value?.protocol === PROTOCOL) return { state: "pending", file: basename(this.legacy), message: "\u68C0\u6D4B\u5230\u4E8B\u52A1\u6807\u8BB0\uFF1B\u5199\u5165\u65F6\u4F1A\u5728\u7CFB\u7EDF\u4E92\u65A5\u4E0B\u786E\u8BA4\u5F52\u5C5E\uFF0C\u4E0D\u80FD\u4EC5\u6309\u65F6\u95F4\u5224\u5B9A\u3002" };
      return { state: "legacy-lock", file: basename(this.legacy), message: m.message || "\u68C0\u6D4B\u5230\u65E7\u7248\u9501\uFF1B\u5199\u5165\u4F1A\u6838\u9A8C\u5F52\u5C5E\uFF0C\u65E0\u6CD5\u786E\u8BA4\u65F6\u4FDD\u7559\u73B0\u573A\u3002" };
    } catch {
      return { state: "storage-error", file: basename(this.legacy), message: "\u5B58\u50A8\u534F\u8C03\u72B6\u6001\u4E0D\u53EF\u8BFB\u53D6\uFF0C\u8BF7\u6838\u5BF9\u6587\u4EF6\u6743\u9650\u548C\u78C1\u76D8\uFF1B\u672A\u91CD\u5EFA\u6570\u636E\u3002" };
    }
  }
  open() {
    try {
      const st = lstatSync(this.path);
      if (!st.isFile() || st.isSymbolicLink()) throw new CoordinationError("GATE_STORAGE", "\u534F\u8C03\u6587\u4EF6\u4E0D\u662F\u666E\u901A\u6587\u4EF6\uFF0C\u5DF2\u505C\u6B62\u5199\u5165\u3002");
    } catch (e) {
      if (!missing(e)) throw e;
    }
    let db;
    try {
      db = new DatabaseSync(this.path);
      chmodSync(this.path, 384);
      db.exec("PRAGMA busy_timeout=0; PRAGMA synchronous=FULL;");
      db.exec("BEGIN IMMEDIATE");
      db.exec("CREATE TABLE IF NOT EXISTS gate_identity (id INTEGER PRIMARY KEY CHECK (id=1), nonce TEXT NOT NULL)");
      db.prepare("INSERT OR IGNORE INTO gate_identity (id,nonce) VALUES (1,?)").run(randomUUID());
      db.exec("COMMIT");
      db.exec("BEGIN IMMEDIATE");
      const row = db.prepare("SELECT nonce FROM gate_identity WHERE id=1").get();
      if (!row || !/^[-a-f0-9]{36}$/.test(row.nonce)) throw new Error("invalid coordination identity");
      return { db, nonce: row.nonce };
    } catch (e) {
      try {
        db?.close();
      } catch {
      }
      if (e instanceof CoordinationError) throw e;
      throw new CoordinationError(busy(e) ? "GATE_BUSY" : "GATE_STORAGE", busy(e) ? "\u53E6\u4E00\u5199\u5165\u8005\u6B63\u5728\u63D0\u4EA4\uFF0C\u8BF7\u7A0D\u540E\u624B\u52A8\u91CD\u8BD5\uFF1B\u6CA1\u6709\u62A2\u9501\u3002" : "\u5B58\u50A8\u534F\u8C03\u4E0D\u53EF\u7528\uFF0C\u8BF7\u6838\u5BF9\u6743\u9650\u3001\u78C1\u76D8\u6216\u534F\u8C03\u6587\u4EF6\uFF1B\u539F\u6570\u636E\u672A\u91CD\u5EFA\u3002");
    }
  }
  retire(marker, nonce) {
    let proven = marker.value?.protocol === PROTOCOL && marker.value?.gateNonce === nonce && marker.value?.resource === basename(this.legacy);
    if (!proven && marker.state === "present" && !marker.value?.protocol && Number.isSafeInteger(marker.value?.pid) && marker.value.pid > 0) {
      try {
        process.kill(marker.value.pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") proven = true;
      }
    }
    if (!proven) throw new CoordinationError("GATE_LEGACY", marker.message || "\u65E7\u7248\u9501\u4ECD\u5728\u4E14\u4E0D\u80FD\u786E\u8BA4\u5DF2\u5931\u6548\uFF1B\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5148\u505C\u6B62\u65E7\u7248\u5199\u5165\u8005\u5E76\u79BB\u7EBF\u68C0\u67E5\u3002");
    const current = this.marker();
    if (current.state !== "present" || current.dev !== marker.dev || current.ino !== marker.ino || current.sha256 !== marker.sha256) throw new CoordinationError("GATE_CHANGED", "\u9501\u5728\u6838\u5BF9\u671F\u95F4\u53D1\u751F\u53D8\u5316\uFF0C\u5DF2\u505C\u6B62\uFF1B\u8BF7\u5237\u65B0\u68C0\u67E5\u3002");
    renameSync(this.legacy, this.legacy + ".retired-" + randomUUID());
  }
  run(fn) {
    let db, nonce, claim, tmp;
    try {
      ({ db, nonce } = this.open());
      const marker = this.marker();
      if (marker.state !== "absent") this.retire(marker, nonce);
      tmp = join(this.dir, ".prelude-lock-" + randomUUID() + ".tmp");
      const fd = openSync(tmp, "wx", 384);
      try {
        writeFileSync(fd, JSON.stringify({ protocol: PROTOCOL, gateNonce: nonce, resource: basename(this.legacy), pid: process.pid, createdAt: (/* @__PURE__ */ new Date()).toISOString() }));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      try {
        linkSync(tmp, this.legacy);
      } catch (e) {
        if (e.code === "EEXIST") throw new CoordinationError("GATE_BUSY", "\u53E6\u4E00\u65E7\u7248\u5199\u5165\u8005\u5DF2\u53D6\u5F97\u6587\u4EF6\u9501\uFF1B\u672C\u6B21\u672A\u5199\u5165\u3002");
        throw e;
      }
      claim = lstatSync(this.legacy);
      unlinkSync(tmp);
      tmp = null;
      const result = fn();
      if (result && typeof result.then === "function") throw new TypeError("transaction callback must be synchronous");
      const after = lstatSync(this.legacy);
      if (after.dev !== claim.dev || after.ino !== claim.ino) throw new CoordinationError("GATE_CHANGED", "\u63D0\u4EA4\u671F\u95F4\u5199\u5165\u5C4F\u969C\u53D1\u751F\u53D8\u5316\uFF1B\u8BF7\u5237\u65B0\u6838\u5BF9\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8BD5\u3002");
      unlinkSync(this.legacy);
      claim = null;
      db.exec("COMMIT");
      return result;
    } catch (e) {
      if (e instanceof CoordinationError) throw e;
      if (busy(e)) throw new CoordinationError("GATE_BUSY", "\u53E6\u4E00\u5199\u5165\u8005\u6B63\u5728\u63D0\u4EA4\uFF0C\u8BF7\u7A0D\u540E\u624B\u52A8\u91CD\u8BD5\u3002");
      throw e;
    } finally {
      if (claim) try {
        const after = lstatSync(this.legacy);
        if (after.dev === claim.dev && after.ino === claim.ino) unlinkSync(this.legacy);
      } catch {
      }
      if (tmp) try {
        unlinkSync(tmp);
      } catch {
      }
      try {
        db?.close();
      } catch {
      }
    }
  }
};

// tools/storage-doctor.mjs
import { lstatSync as lstatSync2, realpathSync } from "node:fs";
import { isAbsolute, join as join2 } from "node:path";
var [root, flag, ...extra] = process.argv.slice(2);
if (!root || !isAbsolute(root) || extra.length || flag && flag !== "--recover-proven-locks") {
  console.error("Usage: node bin/storage-doctor.mjs ABSOLUTE_STATE_DIR [--recover-proven-locks]");
  process.exit(2);
}
if (!lstatSync2(root).isDirectory() || realpathSync(root) !== root) throw new Error("state directory must be real, absolute and not redirected");
var failed = false;
var rows = [];
for (const [dir, file] of [[root, ".usage.lock"], [join2(root, "library"), ".write.lock"]]) {
  try {
    const st = lstatSync2(dir);
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("not a real directory");
    const gate = new TransactionGate(dir, file);
    let recovered = false;
    if (flag && gate.marker().state !== "absent") {
      gate.run(() => {
      });
      recovered = true;
    }
    rows.push({ directory: dir, ...gate.health(), recovered });
  } catch (e) {
    if (e.code === "ENOENT") rows.push({ directory: dir, state: "absent" });
    else {
      failed = true;
      rows.push({ directory: dir, state: "refused", message: e.message });
    }
  }
}
console.log(JSON.stringify({ mode: flag ? "recover-proven-locks" : "read-only", dataFilesWritten: false, rows }, null, 2));
if (failed) process.exitCode = 1;
