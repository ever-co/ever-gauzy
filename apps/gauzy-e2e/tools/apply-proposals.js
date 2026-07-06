/* eslint-disable */
/**
 * Apply grounded selector-fix proposals from the e2e-selector-triage workflow.
 * Input: a JSON file = array of {specName, file, constantName, oldValue, newValue, confidence, evidence}.
 * For each, rewrites the line `constantName: <oldValue>` -> `constantName: <newValue>` in `file`
 * (quote style preserved). Auto-applies confidence high|medium; lists low + conflicts + misses for review.
 *
 * Usage:  node tools/apply-proposals.js proposals.json [--dry] [--all]
 *   --dry : report only, write nothing.   --all : also apply low-confidence.
 */
const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2];
const dry = process.argv.includes('--dry');
const includeLow = process.argv.includes('--all');
if (!jsonPath) { console.error('usage: node tools/apply-proposals.js proposals.json [--dry] [--all]'); process.exit(1); }

let proposals = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (proposals.proposals) proposals = proposals.proposals; // accept {proposals,flags} too

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Detect conflicts: same file+constant proposed different newValues
const byKey = {};
for (const p of proposals) {
	const k = p.file + '::' + p.constantName;
	(byKey[k] ||= []).push(p);
}

const applied = [], skipped = [], conflicts = [], misses = [];
const seen = new Set();

for (const p of proposals) {
	const k = p.file + '::' + p.constantName;
	if (seen.has(k)) continue;
	seen.add(k);
	const group = byKey[k];
	const distinct = [...new Set(group.map((g) => g.newValue))];
	if (distinct.length > 1) { conflicts.push({ k, options: distinct, specs: group.map((g) => g.specName) }); continue; }
	const conf = (p.confidence || 'medium').toLowerCase();
	if (conf === 'low' && !includeLow) { skipped.push({ k, reason: 'low-confidence (review)', newValue: p.newValue }); continue; }

	const abs = path.resolve(p.file);
	if (!fs.existsSync(abs)) { misses.push({ k, reason: 'file not found: ' + p.file }); continue; }
	let src = fs.readFileSync(abs, 'utf8');
	// Match:  <constant>: '...'   or  "..."   (whole RHS string literal on the line)
	const re = new RegExp('(' + esc(p.constantName) + '\\s*:\\s*)([\'"])(.*?)\\2', '');
	const m = src.match(re);
	if (!m) { misses.push({ k, reason: 'constant line not found' }); continue; }
	if (m[3] === p.newValue) { skipped.push({ k, reason: 'already at newValue' }); continue; }
	if (p.oldValue && m[3] !== p.oldValue) {
		// current value differs from what the agent saw — still apply but note it
	}
	const quote = m[2];
	const safeNew = String(p.newValue).replace(new RegExp(quote, 'g'), '\\' + quote);
	src = src.replace(re, m[1] + quote + safeNew + quote);
	if (!dry) fs.writeFileSync(abs, src);
	applied.push({ k, from: m[3], to: p.newValue, conf, spec: p.specName });
}

const out = (label, arr) => { console.log(`\n## ${label} (${arr.length})`); for (const a of arr) console.log('  ' + JSON.stringify(a)); };
out(dry ? 'WOULD APPLY' : 'APPLIED', applied);
out('CONFLICTS (manual pick)', conflicts);
out('SKIPPED', skipped);
out('MISSES', misses);
console.error(`\n[apply-proposals] ${dry ? 'dry-run ' : ''}applied=${applied.length} conflicts=${conflicts.length} skipped=${skipped.length} misses=${misses.length}`);
