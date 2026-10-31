/**
 * The cases `i18n-parity-check.mjs` must read correctly.
 *
 * A parity check that misses a renamed placeholder reports a broken translation as complete, and one that flags a
 * reordered or re-spaced placeholder teaches translators to ignore it; both directions are pinned here.
 *
 * Run from the repository root: `node --test tools/scripts/i18n-parity-check.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	compareCatalogues,
	flattenCatalogue,
	isComplete,
	parseArguments,
	placeholdersOf
} from './i18n-parity-check.mjs';

test('a catalogue flattens to dotted paths in document order', () => {
	const flat = flattenCatalogue({ BUTTONS: { SAVE: 'Save', NESTED: { DEEP: 'Deep' } }, TITLE: 'Title' });

	assert.deepEqual([...flat.keys()], ['BUTTONS.SAVE', 'BUTTONS.NESTED.DEEP', 'TITLE']);
	assert.equal(flat.get('BUTTONS.NESTED.DEEP'), 'Deep');
});

test('an empty-string key keeps its own path', () => {
	const flat = flattenCatalogue({ TEXT: { '': '' } });

	assert.deepEqual([...flat.keys()], ['TEXT.']);
});

test('interpolations are read without their inner whitespace', () => {
	assert.deepEqual(placeholdersOf('Hello {{ name }}'), placeholdersOf('你好 {{name}}'));
	assert.deepEqual(placeholdersOf("'{{ name }}' in '{{ organization }}'"), ['{{name}}', '{{organization}}']);
});

test('placeholders are compared with repeats counted, so order does not matter but repetition does', () => {
	assert.deepEqual(placeholdersOf('{{ a }} then {{ b }}'), placeholdersOf('先 {{ b }} 后 {{ a }}'));
	assert.notDeepEqual(placeholdersOf('{{ error }}'), placeholdersOf('{{ error }} => {{ error }}'));
});

test('HTML tags are read by name and kind, and an interpolation inside an attribute is still read', () => {
	const tokens = placeholdersOf('<a href={{downloadURL}} rel="noopener" target="_blank">Download</a><br/>');

	assert.deepEqual(tokens, ['</a>', '<a>', '<br/>', '{{downloadURL}}']);
	assert.deepEqual(placeholdersOf('<STRONG>Note</STRONG>'), ['</strong>', '<strong>']);
});

test('printf tokens and single-brace arguments are read; JSON-looking text is not', () => {
	assert.deepEqual(placeholdersOf('%s of %1$d'), ['%1$d', '%s']);
	assert.deepEqual(placeholdersOf('At least {count} Super Admin'), ['{count}']);
	assert.deepEqual(placeholdersOf('{count, plural, one {# item} other {# items}}'), ['{count,plural}']);
	assert.deepEqual(placeholdersOf('{ "key": "value" }'), []);
	assert.deepEqual(placeholdersOf('No placeholders here.'), []);
	assert.deepEqual(placeholdersOf(undefined), []);
});

test('missing, extra and identical keys are reported', () => {
	const source = { A: { ONE: 'One', TWO: 'Two' }, API: 'API' };
	const target = { A: { ONE: '一' }, API: 'API', OLD: '旧' };

	const result = compareCatalogues(source, target);

	assert.equal(result.total, 3);
	assert.deepEqual(result.missing, ['A.TWO']);
	assert.deepEqual(result.extra, ['OLD']);
	assert.deepEqual(result.identical, ['API']);
	assert.equal(isComplete(result), false);
});

test('a translated, renamed, dropped or duplicated placeholder is a mismatch', () => {
	const source = {
		TRANSLATED: "Screenshot for '{{ name }}' removed",
		RENAMED: 'Version v{{version}} created',
		DROPPED: 'Hello {{ name }}',
		DUPLICATED: '{{ error }}'
	};
	const target = {
		TRANSLATED: '截图“{{名称}}”已删除',
		RENAMED: '版本 v{{number}} 已创建',
		DROPPED: '你好',
		DUPLICATED: '{{ error }} => {{ error }}'
	};

	const { placeholderMismatches } = compareCatalogues(source, target);

	assert.deepEqual(
		placeholderMismatches.map(({ key }) => key),
		['TRANSLATED', 'RENAMED', 'DROPPED', 'DUPLICATED']
	);
	assert.deepEqual(placeholderMismatches[0], { key: 'TRANSLATED', expected: ['{{name}}'], actual: ['{{名称}}'] });
});

test('a complete translation with moved and re-spaced placeholders passes', () => {
	const source = { MSG: "Integration '{{provider}}' has been added to '{{organization}}'", TAG: '<b>Bold</b>' };
	const target = { MSG: '“{{ provider }}”集成已添加到“{{ organization }}”', TAG: '<b>粗体</b>' };

	const result = compareCatalogues(source, target);

	assert.deepEqual(result.placeholderMismatches, []);
	assert.equal(isComplete(result), true);
});

test('the command line names languages, a folder and a list', () => {
	assert.deepEqual(parseArguments(['zh', '--list', 'missing', '--dir', 'some/dir']), {
		languages: ['zh'],
		all: false,
		directory: 'some/dir',
		list: 'missing',
		json: false
	});
	assert.equal(parseArguments(['--all']).all, true);
	assert.throws(() => parseArguments(['zh', '--list', 'everything']), /--list takes one of/);
	assert.throws(() => parseArguments(['--strict']), /Unknown option/);
	assert.throws(() => parseArguments(['zh', '--dir']), /--dir needs a folder/);
});
