import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Windows registry guard for a desktop app under test.
 *
 * On its first start the desktop timer registers itself as a login item (`app.setLoginItemSettings`
 * writes `HKCU\...\CurrentVersion\Run` and `...\Explorer\StartupApproved\Run`) and as the handler of
 * its deep-link protocol (`app.setAsDefaultProtocolClient` writes `HKCU\Software\Classes\<protocol>`).
 * On a workstation where the released app is installed, both overwrite the installed app's entries
 * (same app id, same protocol) with the path of the build under test.
 *
 * `RegistryGuard` exports the watched keys before the app starts and, afterwards, puts back exactly
 * what the run changed: for value-watched keys only the values that differ (another program may have
 * changed other values in the meantime), for tree-watched keys the whole subtree. Everything goes
 * through `reg export` / `reg import` files, so every value type round-trips unchanged.
 */
const HEADER = 'Windows Registry Editor Version 5.00';

type Sections = Map<string, Map<string, string>>;

interface Snapshot {
	key: string;
	mode: 'values' | 'tree';
	exists: boolean;
	body: string;
	sections: Sections;
}

export interface RegistryChange {
	key: string;
	change: 'added' | 'changed' | 'removed' | 'tree-changed';
	name?: string;
	before?: string;
	after?: string;
}

/** Splits a `reg export` text into sections (key → value name → full value text incl. continuation lines). */
export function parseRegExport(text: string): Sections {
	const sections: Sections = new Map();
	let current: Map<string, string> | undefined;
	let pendingName: string | undefined;
	for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
		if (pendingName && current) {
			current.set(pendingName, `${current.get(pendingName)}\r\n${line}`);
			if (!line.endsWith('\\')) pendingName = undefined;
			continue;
		}
		const section = /^\[(.+)\]$/.exec(line);
		if (section) {
			current = new Map();
			sections.set(section[1], current);
			continue;
		}
		if (!current || line === '' || line === HEADER) continue;
		const name = valueName(line);
		if (name === undefined) continue;
		current.set(name, line);
		if (line.endsWith('\\')) pendingName = name;
	}
	return sections;
}

/** The value name of a `"name"=...` / `@=...` line, in its exported (quoted) form. */
function valueName(line: string): string | undefined {
	if (line.startsWith('@=')) return '@';
	if (!line.startsWith('"')) return undefined;
	for (let i = 1; i < line.length; i++) {
		if (line[i] === '\\') {
			i++;
			continue;
		}
		if (line[i] === '"') return line[i + 1] === '=' ? line.slice(0, i + 1) : undefined;
	}
	return undefined;
}

export class RegistryGuard {
	private readonly snapshots: Snapshot[] = [];
	private readonly dir = mkdtempSync(join(tmpdir(), 'gauzy-e2e-reg-'));
	private seq = 0;

	static get supported(): boolean {
		return process.platform === 'win32';
	}

	/** Remembers the values of `key` (not its subkeys); afterwards only values the run touched are put back. */
	watchValues(key: string): this {
		this.snapshots.push(this.take(key, 'values'));
		return this;
	}

	/** Remembers `key` with all its subkeys; afterwards the whole subtree is put back if anything differs. */
	watchTree(key: string): this {
		this.snapshots.push(this.take(key, 'tree'));
		return this;
	}

	/** What differs from the snapshots right now (nothing is changed). */
	diff(): RegistryChange[] {
		const changes: RegistryChange[] = [];
		for (const before of this.snapshots) {
			const after = this.take(before.key, before.mode);
			if (before.mode === 'tree') {
				if (before.body !== after.body) changes.push({ key: before.key, change: 'tree-changed' });
				continue;
			}
			const b = before.sections.get(before.key) ?? new Map<string, string>();
			const a = after.sections.get(before.key) ?? new Map<string, string>();
			for (const [name, line] of a) {
				if (!b.has(name)) changes.push({ key: before.key, change: 'added', name, after: line });
				else if (b.get(name) !== line) changes.push({ key: before.key, change: 'changed', name, before: b.get(name), after: line });
			}
			for (const [name, line] of b) if (!a.has(name)) changes.push({ key: before.key, change: 'removed', name, before: line });
		}
		return changes;
	}

	/** Puts back everything the run changed, then checks that nothing differs any more. Returns what it restored. */
	restore(): RegistryChange[] {
		const changes = this.diff();
		const blocks: string[] = [];
		for (const before of this.snapshots) {
			const mine = changes.filter((c) => c.key === before.key);
			if (!mine.length) continue;
			if (before.mode === 'tree') {
				blocks.push(`[-${before.key}]`);
				if (before.exists) blocks.push(before.body);
				continue;
			}
			const lines = mine.map((c) => (c.change === 'added' ? `${c.name}=-` : (c.before as string)));
			blocks.push(`[${before.key}]\r\n${lines.join('\r\n')}`);
		}
		if (blocks.length) {
			const file = join(this.dir, `restore-${++this.seq}.reg`);
			writeFileSync(file, Buffer.from(`﻿${HEADER}\r\n\r\n${blocks.join('\r\n\r\n')}\r\n`, 'utf16le'));
			execFileSync('reg', ['import', file], { stdio: 'pipe' });
		}
		const left = this.diff();
		if (left.length) throw new Error(`registry not restored: ${JSON.stringify(left)}`);
		return changes;
	}

	dispose(): void {
		rmSync(this.dir, { recursive: true, force: true });
	}

	private take(key: string, mode: 'values' | 'tree'): Snapshot {
		const file = join(this.dir, `snap-${++this.seq}.reg`);
		let exists = true;
		try {
			execFileSync('reg', ['export', key, file, '/y'], { stdio: 'pipe' });
		} catch {
			exists = false;
		}
		const text = exists ? readFileSync(file).toString('utf16le').replace(/^﻿/, '') : '';
		const body = text.replace(HEADER, '').trim();
		const sections = parseRegExport(text);
		// `reg export` writes key names as stored; compare them case-insensitively, under the name given here.
		for (const name of [...sections.keys()]) {
			const values = sections.get(name) as Map<string, string>;
			sections.delete(name);
			if (name.toLowerCase() === key.toLowerCase()) sections.set(key, values);
			else if (mode === 'tree') sections.set(name, values);
			// values mode: subkeys are someone else's business.
		}
		return { key, mode, exists, body: mode === 'tree' ? body : '', sections };
	}
}
