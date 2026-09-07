import {
	assertUiPreferencesSize,
	MAX_UI_PREFERENCES_BYTES,
	mergeUiPreferences,
	normalizeUiPreferences,
	sanitizeUiPreferencesPatch
} from './ui-preferences.util';

/**
 * Pure-function suite for the `PUT /user/ui-preferences` merge semantics that
 * `UserService.updateUiPreferences` runs. Kept free of the entity graph so it loads
 * under the core Jest harness regardless of the circular-import state of the rest.
 */
describe('ui-preferences.util', () => {
	describe('mergeUiPreferences', () => {
		it('replaces the whole feature object for a patched key and keeps the other features', () => {
			const current = { aiChat: { expanded: true, width: 400, position: 'start' }, docs: { zoom: 2 } };
			const merged = mergeUiPreferences(current, { aiChat: { expanded: false } });
			expect(merged).toEqual({ aiChat: { expanded: false }, docs: { zoom: 2 } });
		});

		it('adds a new feature key without touching existing ones', () => {
			const merged = mergeUiPreferences({ aiChat: { expanded: true } }, { calendar: { view: 'week' } });
			expect(merged).toEqual({ aiChat: { expanded: true }, calendar: { view: 'week' } });
		});

		it('removes a feature when patched with null', () => {
			const merged = mergeUiPreferences({ aiChat: { expanded: true }, docs: { zoom: 2 } }, { docs: null });
			expect(merged).toEqual({ aiChat: { expanded: true } });
		});

		it('starts from {} when nothing is stored yet (null / undefined)', () => {
			expect(mergeUiPreferences(null, { aiChat: { expanded: true } })).toEqual({ aiChat: { expanded: true } });
			expect(mergeUiPreferences(undefined, {})).toEqual({});
		});

		it('accepts the SQLite text form (JSON string) as the current value', () => {
			const merged = mergeUiPreferences('{"aiChat":{"expanded":false},"docs":{"zoom":1}}', {
				aiChat: { expanded: true, maximized: true }
			});
			expect(merged).toEqual({ aiChat: { expanded: true, maximized: true }, docs: { zoom: 1 } });
		});

		it('does not mutate the stored object', () => {
			const current = { aiChat: { expanded: true } };
			mergeUiPreferences(current, { aiChat: { expanded: false } });
			expect(current).toEqual({ aiChat: { expanded: true } });
		});

		it('ignores prototype-polluting feature keys', () => {
			const merged = mergeUiPreferences(
				{},
				JSON.parse('{"__proto__":{"polluted":true},"aiChat":{"expanded":true}}')
			);
			expect(merged).toEqual({ aiChat: { expanded: true } });
			expect(({} as any).polluted).toBeUndefined();
		});
	});

	describe('normalizeUiPreferences', () => {
		it('returns {} for corrupt JSON text instead of throwing', () => {
			expect(normalizeUiPreferences('{not json')).toEqual({});
		});

		it('returns {} for non-object values', () => {
			expect(normalizeUiPreferences(42)).toEqual({});
			expect(normalizeUiPreferences([1, 2])).toEqual({});
		});
	});

	describe('sanitizeUiPreferencesPatch', () => {
		it('accepts feature objects and null (removal)', () => {
			expect(sanitizeUiPreferencesPatch({ aiChat: { expanded: true }, docs: null })).toEqual({
				aiChat: { expanded: true },
				docs: null
			});
		});

		it('rejects a non-object body', () => {
			expect(() => sanitizeUiPreferencesPatch(null)).toThrow();
			expect(() => sanitizeUiPreferencesPatch([])).toThrow();
			expect(() => sanitizeUiPreferencesPatch('x')).toThrow();
		});

		it('rejects a feature whose value is not an object', () => {
			expect(() => sanitizeUiPreferencesPatch({ aiChat: true })).toThrow(/must be an object/);
			expect(() => sanitizeUiPreferencesPatch({ aiChat: [1] })).toThrow(/must be an object/);
		});

		it('rejects prototype accessor keys at both levels', () => {
			expect(() => sanitizeUiPreferencesPatch(JSON.parse('{"__proto__":{"a":1}}'))).toThrow(/Illegal/);
			expect(() => sanitizeUiPreferencesPatch({ constructor: { a: 1 } })).toThrow(/Illegal/);
			expect(() => sanitizeUiPreferencesPatch({ aiChat: JSON.parse('{"__proto__":1}') })).toThrow(/Illegal/);
		});

		it('rejects prototype accessor keys inside arrays', () => {
			expect(() =>
				sanitizeUiPreferencesPatch({ aiChat: { pinned: [JSON.parse('{"__proto__":{"x":1}}')] } })
			).toThrow(/Illegal/);
		});

		it('bounds the nesting depth for objects AND arrays (400, not a stack overflow)', () => {
			// 8 nested containers below the feature key are fine …
			const okObjects = { aiChat: { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } } };
			expect(() => sanitizeUiPreferencesPatch(okObjects)).not.toThrow();
			// … a deeply nested array payload is rejected with the same bounded-depth error.
			const deepArrays = { aiChat: { list: JSON.parse('['.repeat(200) + ']'.repeat(200)) } };
			expect(() => sanitizeUiPreferencesPatch(deepArrays)).toThrow(/nested too deeply/);
			// A small nested-array chain that could recurse without bound: 5000 levels fits the size cap.
			const stackBuster = { aiChat: { list: JSON.parse('['.repeat(5000) + ']'.repeat(5000)) } };
			expect(() => sanitizeUiPreferencesPatch(stackBuster)).toThrow(/nested too deeply/);
			// Deep object nesting is bounded too.
			let deep: Record<string, unknown> = { leaf: 1 };
			for (let i = 0; i < 20; i++) {
				deep = { next: deep };
			}
			expect(() => sanitizeUiPreferencesPatch({ aiChat: deep })).toThrow(/nested too deeply/);
		});
	});

	describe('assertUiPreferencesSize', () => {
		it('passes a normal blob and rejects an oversized one', () => {
			expect(() => assertUiPreferencesSize({ aiChat: { expanded: true, width: 384 } })).not.toThrow();
			const big = { notes: { text: 'x'.repeat(MAX_UI_PREFERENCES_BYTES) } };
			expect(() => assertUiPreferencesSize(big)).toThrow(/exceed/);
		});
	});
});
