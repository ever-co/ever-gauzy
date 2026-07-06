/* eslint-disable */
/**
 * Triage digest: distills each failed-spec's captured page.html (15MB full DOM, written by the
 * E2E_DUMP_HTML fixture) into a compact list of the interactive elements a page-object selector
 * could target — buttons, inputs/textareas, ng-selects, open dialog/card headers — with their
 * stable attributes. Pairs it with the failing Locator from Playwright's error-context.md.
 *
 * Output: one block per failed spec, small enough to reason over in bulk when re-grounding stale
 * selectors. Run from apps/gauzy-e2e after a run:  node tools/triage-digest.js [test-results-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || 'test-results';
const clip = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
const attr = (tag, name) => {
	const m = tag.match(new RegExp(name + '="([^"]*)"'));
	return m ? m[1] : undefined;
};

function digestHtml(html) {
	const out = { dialogs: [], headers: [], buttons: [], inputs: [], selects: [] };
	// Open dialog / mutation component tags (identify which form is mounted)
	for (const m of html.matchAll(/<(ngx-[a-z-]+|ga-[a-z-]+)[\s>]/g)) {
		if (/mutation|dialog|form|edit|add/i.test(m[1])) out.dialogs.push(m[1]);
	}
	out.dialogs = [...new Set(out.dialogs)].slice(0, 12);
	// Card / dialog headers
	for (const m of html.matchAll(/<nb-card-header[^>]*>([\s\S]*?)<\/nb-card-header>/g)) {
		const t = clip(m[1]);
		if (t) out.headers.push(t);
	}
	for (const m of html.matchAll(/<h[1-6][^>]*class="[^"]*card-header[^"]*"[^>]*>([\s\S]*?)<\/h[1-6]>/g)) {
		const t = clip(m[1]);
		if (t) out.headers.push(t);
	}
	out.headers = [...new Set(out.headers)].slice(0, 10);
	// Buttons (text + status + class + nb-icon)
	for (const m of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
		const open = m[1];
		const inner = m[2];
		const icon = (inner.match(/icon="([^"]*)"/) || [])[1];
		const b = {
			text: clip(inner),
			status: attr(open, 'status'),
			cls: (attr(open, 'class') || '').split(' ').filter((c) => /create|add|save|delete|action|next|primary|success|danger|basic|cancel|finish|submit/i.test(c)).join('.') || undefined,
			icon
		};
		if (b.text || b.status || b.cls || b.icon) out.buttons.push(b);
	}
	out.buttons = out.buttons.slice(0, 40);
	// Inputs + textareas
	for (const m of html.matchAll(/<(input|textarea)([^>]*)>/g)) {
		const t = m[2];
		const i = {
			tag: m[1],
			ph: attr(t, 'placeholder'),
			fcn: attr(t, 'formcontrolname'),
			id: attr(t, 'id'),
			type: attr(t, 'type')
		};
		if (i.ph || i.fcn || (i.id && !/^cdk|^mat/.test(i.id))) out.inputs.push(i);
	}
	out.inputs = out.inputs.slice(0, 40);
	// ng-select / nb-select
	for (const m of html.matchAll(/<(ng-select|nb-select)([^>]*)>/g)) {
		out.selects.push({ tag: m[1], id: attr(m[2], 'id'), fcn: attr(m[2], 'formcontrolname'), cls: clip(attr(m[2], 'class')) });
	}
	out.selects = out.selects.slice(0, 20);
	return out;
}

const dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
let n = 0;
for (const d of dirs) {
	const base = path.join(ROOT, d.name);
	const htmlPath = path.join(base, 'page.html');
	const ecPath = path.join(base, 'error-context.md');
	if (!fs.existsSync(htmlPath)) continue;
	n++;
	const html = fs.readFileSync(htmlPath, 'utf8');
	let locator = '';
	let strict = '';
	if (fs.existsSync(ecPath)) {
		const ec = fs.readFileSync(ecPath, 'utf8');
		locator = (ec.match(/Locator:\s*(.+)/) || [])[1] || '';
		strict = /strict mode violation/.test(ec) ? '  [STRICT-MODE]' : '';
	}
	const dg = digestHtml(html);
	console.log('\n=============================================================');
	console.log('SPEC: ' + d.name);
	console.log('FAILED LOCATOR: ' + locator.trim() + strict);
	console.log('OPEN FORMS/DIALOGS: ' + (dg.dialogs.join(', ') || '(none detected)'));
	console.log('HEADERS: ' + (dg.headers.join(' | ') || '-'));
	console.log('BUTTONS:');
	for (const b of dg.buttons) console.log('  - ' + JSON.stringify(b));
	console.log('INPUTS:');
	for (const i of dg.inputs) console.log('  - ' + JSON.stringify(i));
	if (dg.selects.length) {
		console.log('SELECTS:');
		for (const s of dg.selects) console.log('  - ' + JSON.stringify(s));
	}
}
console.error(`\n[triage-digest] processed ${n} captured failures from ${ROOT}`);
