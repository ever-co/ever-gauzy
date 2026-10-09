import { applyProjection } from './field-selection';

/**
 * The projection copies what a caller selected and nothing else — and a selected path is caller input
 * whenever the resource declares no `selectable` list, so no path may reach the prototype chain of the
 * object being built.
 */
describe('applyProjection — what a selection copies', () => {
	it('keeps only the selected paths, nesting a relation path', () => {
		const rows = [{ id: 'r1', title: 'Widget', secret: 'x', customer: { name: 'Ada', email: 'ada@example.com' } }];

		expect(applyProjection(rows, { paths: ['id', 'customer.name'] })).toEqual([
			{ id: 'r1', customer: { name: 'Ada' } }
		]);
	});

	it('merges two paths under one relation into one object', () => {
		const rows = [{ customer: { name: 'Ada', email: 'ada@example.com', phone: '1' } }];

		expect(applyProjection(rows, { paths: ['customer.name', 'customer.email'] })).toEqual([
			{ customer: { name: 'Ada', email: 'ada@example.com' } }
		]);
	});

	it('skips a path whose parent is not present rather than inventing it', () => {
		const rows = [{ id: 'r1' }];

		expect(applyProjection(rows, { paths: ['id', 'customer.name'] })).toEqual([{ id: 'r1' }]);
	});

	it('returns the rows untouched when nothing was selected', () => {
		const rows = [{ id: 'r1', title: 'Widget' }];

		expect(applyProjection(rows, undefined)).toBe(rows);
		expect(applyProjection(rows, { paths: [] })).toBe(rows);
	});
});

describe('applyProjection — a path never reaches the prototype chain', () => {
	afterEach(() => {
		// Belt and braces: a failure below must not leak into the rest of the run.
		delete (Object.prototype as Record<string, unknown>)['polluted'];
	});

	it('skips `__proto__`, even when the row carries it as an own key', () => {
		// A row parsed from JSON can own a `__proto__` key. Projecting it by assignment would replace the
		// projected object's prototype, and walking through it would write onto `Object.prototype`.
		const rows = [JSON.parse('{"id":"r1","__proto__":{"polluted":"yes"}}') as Record<string, unknown>];

		const [projected] = applyProjection(rows, { paths: ['id', '__proto__.polluted', '__proto__'] });

		expect(projected).toEqual({ id: 'r1' });
		expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('projects `constructor` and `prototype` as the ordinary own keys they are, and writes nothing on `Object`', () => {
		// Read as an inherited member, `constructor` is the `Object` function, and the walk used to carry on
		// writing into it. Looked up among the target's own keys it is a name like any other.
		const rows = [
			{ constructor: { prototype: { polluted: 'yes' } }, id: 'r1' } as unknown as Record<string, unknown>
		];

		const [projected] = applyProjection(rows, { paths: ['id', 'constructor.prototype.polluted'] });

		expect(Object.prototype.hasOwnProperty.call(projected, 'constructor')).toBe(true);
		expect(projected).toEqual({ id: 'r1', constructor: { prototype: { polluted: 'yes' } } });
		expect((Object as unknown as Record<string, unknown>)['prototype']).toBe(Object.prototype);
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});
});
