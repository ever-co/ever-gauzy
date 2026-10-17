#!/usr/bin/env node
/**
 * Record a CPU profile of a running API started with `--inspect=127.0.0.1:<port>`, for a fixed time window,
 * through the inspector protocol (no restart, no `--cpu-prof` exit needed). Uses Node's global WebSocket.
 *
 * Usage: node tools/perf/cpu-profile.mjs <inspectPort=9230> <seconds=20> <out.cpuprofile> [samplingIntervalUs=200]
 * Then:  node tools/perf/cpuprofile-summary.mjs <out.cpuprofile>
 */
import fs from 'node:fs';

const [, , portArg, secondsArg, out = 'api.cpuprofile', intervalArg] = process.argv;
const port = Number(portArg || 9230);
const seconds = Number(secondsArg || 20);
const interval = Number(intervalArg || 200);

let targets;
try {
	targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
} catch (error) {
	console.error(`No inspector on 127.0.0.1:${port} (start the API with --inspect=127.0.0.1:${port}): ${error.message}`);
	process.exit(1);
}
const target = targets.find((t) => t.type === 'node') ?? targets[0];
if (!target?.webSocketDebuggerUrl) {
	console.error(`No debuggable target on 127.0.0.1:${port}`);
	process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	ws.onopen = resolve;
	ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
	const msg = JSON.parse(event.data);
	if (msg.id && pending.has(msg.id)) {
		pending.get(msg.id)(msg);
		pending.delete(msg.id);
	}
};
const failAll = (reason) => {
	for (const resolve of pending.values()) resolve({ error: { message: reason } });
	pending.clear();
};
ws.onclose = () => failAll('inspector connection closed');
ws.onerror = () => failAll('inspector connection error');
const send = (method, params = {}, timeoutMs = 30_000) =>
	new Promise((resolve, reject) => {
		const msgId = ++id;
		const timer = setTimeout(() => {
			pending.delete(msgId);
			reject(new Error(`${method} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		pending.set(msgId, (msg) => {
			clearTimeout(timer);
			if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
			else resolve(msg);
		});
		ws.send(JSON.stringify({ id: msgId, method, params }));
	});

await send('Profiler.enable');
await send('Profiler.setSamplingInterval', { interval });
await send('Profiler.start');
console.log(`profiling ${target.title} for ${seconds}s (sampling every ${interval}us)...`);
await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
const { result } = await send('Profiler.stop');
fs.writeFileSync(out, JSON.stringify(result.profile));
console.log(`wrote ${out}`);
ws.close();
