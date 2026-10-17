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

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((t) => t.type === 'node') ?? targets[0];
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
const send = (method, params = {}) =>
	new Promise((resolve) => {
		const msgId = ++id;
		pending.set(msgId, resolve);
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
