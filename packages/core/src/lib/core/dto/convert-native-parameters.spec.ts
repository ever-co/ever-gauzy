import { convertNativeParameters } from './base-query.dto';

/**
 * `convertNativeParameters` runs on every `where` leaf of the paginated list endpoints. It used to
 * `Boolean(JSON.parse(...))` each leaf, so numeric search text became a boolean ("2024" -> true).
 */
describe('convertNativeParameters', () => {
	it('converts the boolean literals', () => {
		expect(convertNativeParameters({ isArchived: 'true', isActive: 'false' })).toEqual({
			isArchived: true,
			isActive: false
		});
	});

	it('keeps the previous mapping of "null" to false', () => {
		expect(convertNativeParameters({ projectId: 'null' })).toEqual({ projectId: false });
	});

	it.each(['2024', '0', '1.5', '-3'])('keeps numeric text %p as a string', (value) => {
		expect(convertNativeParameters({ title: value })).toEqual({ title: value });
	});

	it('keeps other text, dates and ids unchanged', () => {
		const where = { name: 'Ada', invoiceDate: '2024-05-03', id: '0b3e7c4e-2f1a-4c55-9d3a-7d0e8f6a1b2c' };
		expect(convertNativeParameters(where)).toEqual(where);
	});

	it('converts nested objects and arrays recursively', () => {
		expect(
			convertNativeParameters({ user: { name: '2024' }, tags: ['a', 'true'], range: { min: '10' } })
		).toEqual({ user: { name: '2024' }, tags: ['a', true], range: { min: '10' } });
	});
});
