import { isClassInstance } from './is-class-instance';
import { deepClone } from './deep-clone';
import { deepMerge } from './deep-merge';

describe('isClassInstance', () => {
	it('returns false for plain object literals', () => {
		expect(isClassInstance({})).toBe(false);
		expect(isClassInstance({ a: 1 })).toBe(false);
	});

	it('returns true for class instances', () => {
		class Foo {}
		expect(isClassInstance(new Foo())).toBe(true);
		expect(isClassInstance(new Date())).toBe(true);
	});

	it('returns false for non-objects', () => {
		expect(isClassInstance(null)).toBe(false);
		expect(isClassInstance(undefined)).toBe(false);
		expect(isClassInstance('hi')).toBe(false);
		expect(isClassInstance([1, 2, 3])).toBe(false);
	});

	it('returns false for a null-prototype object instead of throwing', () => {
		// Object.create(null) has no `constructor` property at all - a naive
		// `item.constructor.name` read throws on it. It's a legitimate,
		// sometimes-used pattern (e.g. a "safe dictionary" specifically meant to
		// avoid prototype-chain surprises), and should be treated as plain data.
		const nullProto = Object.create(null);
		nullProto.foo = 'bar';
		expect(() => isClassInstance(nullProto)).not.toThrow();
		expect(isClassInstance(nullProto)).toBe(false);
	});
});

describe('deepClone / deepMerge with null-prototype values', () => {
	it('deepClone does not throw on a null-prototype object', () => {
		const nullProto = Object.create(null);
		nullProto.foo = 'bar';
		expect(() => deepClone(nullProto)).not.toThrow();
		expect(deepClone(nullProto)).toEqual({ foo: 'bar' });
	});

	it('deepMerge does not throw when a null-prototype object appears as a nested value', () => {
		const nullProtoSettings = Object.create(null);
		nullProtoSettings.theme = 'dark';

		const target = { settings: { theme: 'light', extra: true } };
		const source = { settings: nullProtoSettings };

		expect(() => deepMerge(target, source)).not.toThrow();
		expect(deepMerge(target, source)).toEqual({ settings: { theme: 'dark', extra: true } });
	});
});
