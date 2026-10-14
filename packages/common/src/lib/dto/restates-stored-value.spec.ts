import { restatesStoredValue } from './restates-stored-value';

/**
 * `restatesStoredValue` decides whether a member an update states is the value the row already holds, so an update
 * that refuses to move a read-only member still accepts a body that echoes it back. Every plugin had its own copy, whose
 * last fallback compared `String(stated) === String(stored)` - any two objects read `'[object Object]'`, so a body that
 * CHANGED a read-only object member was taken for a restatement and silently dropped instead of refused.
 */
describe('restatesStoredValue', () => {
	describe('a missing value', () => {
		it.each([
			[null, null],
			[null, undefined],
			[undefined, null],
			[undefined, undefined]
		])('restates a missing one (%p stored, %p stated)', (stored, stated) => {
			expect(restatesStoredValue(stored, stated)).toBe(true);
		});

		it.each([
			[null, 'x'],
			[undefined, 0],
			['x', null],
			[0, null],
			[{}, null],
			[null, {}],
			[new Date('2026-01-01T00:00:00.000Z'), null]
		])('restates nothing else (%p stored, %p stated)', (stored, stated) => {
			expect(restatesStoredValue(stored, stated)).toBe(false);
		});
	});

	describe('a date', () => {
		const stored = new Date('2026-10-14T12:00:00.000Z');

		it('is compared by its instant, whatever form the body states it in', () => {
			expect(restatesStoredValue(stored, '2026-10-14T12:00:00.000Z')).toBe(true);
			expect(restatesStoredValue(stored, '2026-10-14T14:00:00+02:00')).toBe(true);
			expect(restatesStoredValue(stored, new Date(stored.getTime()))).toBe(true);
			expect(restatesStoredValue('2026-10-14T12:00:00.000Z', stored)).toBe(true);
		});

		it('is a change when the instant differs or the body is not a date', () => {
			expect(restatesStoredValue(stored, '2026-10-14T12:00:01.000Z')).toBe(false);
			expect(restatesStoredValue(stored, 'not a date')).toBe(false);
			expect(restatesStoredValue(stored, {})).toBe(false);
			expect(restatesStoredValue(new Date(Number.NaN), new Date(Number.NaN))).toBe(false);
		});
	});

	describe('a decimal', () => {
		it.each([
			['10.000000', '10'],
			['10.000000', 10],
			['10.500000', '10.5'],
			['1', '+1'],
			['+1.0', '1'],
			['0.000000', '0'],
			['-2.50', '-2.5']
		])('%p is restated by %p (the column scale, a sign)', (stored, stated) => {
			expect(restatesStoredValue(stored, stated)).toBe(true);
		});

		it.each([
			['10.000000', '10.000001'],
			['10', '100'],
			['1.5', '15'],
			['-1', '1'],
			['10', '010']
		])('%p is not restated by %p', (stored, stated) => {
			expect(restatesStoredValue(stored, stated)).toBe(false);
		});

		it('reads a 100k-digit body in linear time (no backtracking trailing-zero pattern)', () => {
			// `/(\.\d*?)0+$/` backtracks quadratically on a digit run that does not end in a zero.
			const long = `1.${'0'.repeat(100_000)}1`;
			const started = Date.now();

			expect(restatesStoredValue('1.000000', long)).toBe(false);
			expect(restatesStoredValue(`1.${'0'.repeat(100_000)}`, '1')).toBe(true);
			expect(Date.now() - started).toBeLessThan(1_000);
		});

		it('uses the decimal reader a module passes', () => {
			const lenient = (value: unknown) => {
				const text = String(value).trim();
				return /^\d+$/.test(text) ? String(Number(text)) : null;
			};

			expect(restatesStoredValue('100', ' 0100 ', { decimal: lenient })).toBe(true);
			expect(restatesStoredValue('100', ' 0100 ')).toBe(false);
		});
	});

	describe('text', () => {
		it('restates an enumeration or an identifier as stored, and nothing else', () => {
			expect(restatesStoredValue('ACTIVE', 'ACTIVE')).toBe(true);
			expect(restatesStoredValue('ACTIVE', 'CANCELED')).toBe(false);
			expect(restatesStoredValue('3f8c', '3f8c')).toBe(true);
			expect(restatesStoredValue(true, 'true')).toBe(true);
		});

		it('is not restated by an array or an object that merely stringifies to it', () => {
			// `String(['ACTIVE']) === 'ACTIVE'` and `String(['0']) === '0'`: the old fallback took these for restatements.
			expect(restatesStoredValue('ACTIVE', ['ACTIVE'])).toBe(false);
			expect(restatesStoredValue('0.000000', ['0'])).toBe(false);
			expect(restatesStoredValue('[object Object]', {})).toBe(false);
		});
	});

	describe('an object or an array', () => {
		const stored = { plan: 'pro', seats: 3, tags: ['a', 'b'], billing: { day: 1, notes: null } };

		it('is restated by the same content, with the members in any order', () => {
			expect(
				restatesStoredValue(stored, {
					billing: { notes: null, day: 1 },
					tags: ['a', 'b'],
					seats: 3,
					plan: 'pro'
				})
			).toBe(true);
		});

		it('treats a member holding undefined as absent', () => {
			expect(restatesStoredValue(stored, { ...stored, extra: undefined })).toBe(true);
		});

		it.each([
			['a changed nested value', { ...stored, billing: { day: 2, notes: null } }],
			['a changed top-level value', { ...stored, seats: 4 }],
			['a member added', { ...stored, extra: 1 }],
			['a member removed', { plan: 'pro', seats: 3, tags: ['a', 'b'] }],
			['a nested null made a value', { ...stored, billing: { day: 1, notes: 'x' } }],
			['a number stated as text', { ...stored, seats: '3' }],
			['array items reordered', { ...stored, tags: ['b', 'a'] }],
			['an array item added', { ...stored, tags: ['a', 'b', 'c'] }],
			['an array for an object', [stored]],
			['an empty object', {}]
		])('is a change: %s', (_case, stated) => {
			expect(restatesStoredValue(stored, stated)).toBe(false);
		});

		it('compares arrays item by item, in order', () => {
			expect(restatesStoredValue([{ id: 'x', quantity: '1' }], [{ quantity: '1', id: 'x' }])).toBe(true);
			expect(restatesStoredValue([{ id: 'x', quantity: '1' }], [{ id: 'x', quantity: '2' }])).toBe(false);
			expect(restatesStoredValue([], [])).toBe(true);
			expect(restatesStoredValue([], [{}])).toBe(false);
		});

		it('compares a nested date by its instant (a relation read back beside an echoed ISO string)', () => {
			const at = new Date('2026-10-14T12:00:00.000Z');

			expect(restatesStoredValue([{ id: 'x', createdAt: at }], [{ id: 'x', createdAt: at.toISOString() }])).toBe(
				true
			);
			expect(
				restatesStoredValue([{ id: 'x', createdAt: at }], [{ id: 'x', createdAt: '2026-10-15T12:00:00.000Z' }])
			).toBe(false);
		});

		it('reads a JSON string on either side as the JSON it holds', () => {
			expect(restatesStoredValue('{"plan":"pro","seats":3}', { seats: 3, plan: 'pro' })).toBe(true);
			expect(restatesStoredValue({ seats: 3, plan: 'pro' }, '{"plan":"pro","seats":3}')).toBe(true);
			expect(restatesStoredValue({ seats: 3, plan: 'pro' }, '{"plan":"pro","seats":4}')).toBe(false);
			expect(restatesStoredValue({ seats: 3 }, 'not json')).toBe(false);
		});

		it('walks a deeply nested body without exhausting the call stack', () => {
			const nest = (depth: number) => {
				let value: unknown = 'leaf';
				for (let level = 0; level < depth; level++) value = { next: value };
				return value;
			};

			expect(restatesStoredValue(nest(50_000), nest(50_000))).toBe(true);
			expect(restatesStoredValue(nest(50_000), nest(49_999))).toBe(false);
		});
	});
});
