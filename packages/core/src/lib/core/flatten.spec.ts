import { flatten } from './utils';

/**
 * `flatten` turns a relations map into the dot-notated paths both ORMs load.
 *
 * It answered `undefined` for the rest of the map once a key was falsy (so the next key threw on
 * `undefined.concat`), and it joined the keys of a nested object into one path (`kind.owner.labels`) that no
 * ORM can resolve, instead of one path per key. `RequestApprovalService` and the CRUD base hand it the
 * relations a caller states, in either form.
 */
describe('flatten', () => {
	it('answers an array as it is', () => {
		const relations = ['tags', 'kind.owner'];

		expect(flatten(relations)).toBe(relations);
	});

	it('answers one path per key, and one per nested key', () => {
		expect(flatten({ tags: true, kind: { owner: true, labels: true } })).toEqual([
			'tags',
			'kind.owner',
			'kind.labels'
		]);
	});

	it('follows nesting to any depth', () => {
		expect(flatten({ kind: { owner: { avatar: true } } })).toEqual(['kind.owner.avatar']);
	});

	it('skips a falsy key wherever it is, and keeps the keys after it', () => {
		expect(flatten({ tags: false, kind: true, labels: undefined, owner: true })).toEqual(['kind', 'owner']);
		expect(flatten({ kind: { owner: false, labels: true } })).toEqual(['kind.labels']);
	});

	it('answers the key of a nested array, as before', () => {
		expect(flatten({ labels: ['a', 'b'] })).toEqual(['labels']);
	});

	it('answers nothing for anything that is not a map or an array', () => {
		expect(flatten(undefined)).toEqual([]);
		expect(flatten(null)).toEqual([]);
		expect(flatten('tags')).toEqual([]);
		expect(flatten({})).toEqual([]);
	});
});
