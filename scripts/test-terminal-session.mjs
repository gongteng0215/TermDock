import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { EventEmitter } from "node:events";
import ssh2 from "ssh2";

import { TerminalService } from "../dist-electron/main/terminal/terminal-service.js";

const { Server } = ssh2;
const observations = new EventEmitter();
const clients = new Set();
const ptys = [];
const windowChanges = [];
let currentShell;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const server = new Server({ hostKeys: [privateKey] }, (client) => {
  clients.add(client);
  client.on("error", () => {});
  client.on("close", () => clients.delete(client));
  client.on("authentication", (context) => setTimeout(() => context.accept(), 120));
  client.on("ready", () => client.on("session", (accept) => {
    const session = accept();
    session.on("pty", (acceptPty, _reject, info) => {
      ptys.push({ cols: info.cols, rows: info.rows });
      acceptPty();
    });
    session.on("window-change", (_accept, _reject, info) => {
      windowChanges.push({ cols: info.cols, rows: info.rows });
      observations.emit("window-change");
    });
    session.on("shell", (acceptShell) => {
      observations.emit("shell-request");
      setTimeout(() => { currentShell = acceptShell(); }, 120);
    });
  }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const record = { id: "terminal-session-test", host: "127.0.0.1", port: server.address().port,
  username: "fixture", authType: "password" };
const events = [];
const service = new TerminalService({ getById: async () => record, markConnected: async () => record },
  { getSessionSecret: async () => "fixture-password" });
const sender = { isDestroyed: () => false, send: (_channel, event) => {
  events.push(event);
  if (event.type === "hostKeyPrompt") void service.respondHostKeyPrompt(event.tabId, event.promptId, "trust");
  observations.emit("terminal-event");
} };
const until = async (predicate, message) => {
  const deadline = Date.now() + 5_000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message + "\n" + JSON.stringify(events));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
try {
  const shellRequested = new Promise((resolve) => observations.once("shell-request", resolve));
  await service.connect("tab", record.id, sender, { cols: 83, rows: 27 });
  await service.resize("tab", 91, 29);
  await shellRequested;
  assert.deepEqual(ptys.at(-1), { cols: 91, rows: 29 }, "the PTY must use the latest size sent before authentication completes");
  await service.resize("tab", 77, 21);
  await until(() => events.some((event) => event.type === "status" && event.status === "connected"), "connect timed out");
  await until(() => windowChanges.some((size) => size.cols === 77 && size.rows === 21), "resize during shell creation was lost");
  await service.resize("tab", 101, 33);
  await until(() => windowChanges.at(-1)?.cols === 101, "live resize was lost");
  console.log("PASS: delayed authentication, shell creation and live resize retain the latest dimensions");

  events.length = 0;
  const text = "中文命令回显🙂完整";
  const bytes = Buffer.from(text);
  for (let index = 0; index < bytes.length; index += 2) {
    currentShell.write(bytes.subarray(index, index + 2));
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  const output = () => events.filter((event) => event.type === "output").map((event) => event.data).join("");
  await until(() => [...output()].length >= [...text].length, "terminal output timed out");
  assert.equal(output(), text, "UTF-8 characters split across SSH chunks must survive intact");
  console.log("PASS: split Chinese and emoji output remains intact");

  await service.close("tab");
  events.length = 0;
  await service.connect("tab", record.id, sender, { cols: 64, rows: 19 });
  await until(() => events.some((event) => event.type === "status" && event.status === "connected"), "reconnect timed out: " + JSON.stringify(events));
  assert.deepEqual(ptys.at(-1), { cols: 64, rows: 19 });
  console.log("PASS: reconnect uses the new terminal size");
} finally {
  await service.close("tab");
  for (const client of clients) client.end();
  await new Promise((resolve) => server.close(resolve));
}
