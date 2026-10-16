import { BadRequestException } from '@nestjs/common';
import { EmployeeSettingDataOperationEnum } from '@gauzy/contracts';
import {
	applyEmployeeSettingDataOperations,
	MAX_EMPLOYEE_SETTING_DATA_OPERATIONS,
	MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH
} from './employee-setting-data.utils';

const { SET, UNSET } = EmployeeSettingDataOperationEnum;

describe('applyEmployeeSettingDataOperations', () => {
	it('sets a nested key, creating the objects on the way, and keeps every other key', () => {
		const data = { display_filters: { layout: 'list' }, sidebar_preferences: { home: { is_pinned: true } } };

		const result = applyEmployeeSettingDataOperations(data, [
			{ op: SET, path: ['sidebar_preferences', 'views', 'is_pinned'], value: false },
			{ op: SET, path: ['home_preferences', 'my_stickies', 'is_enabled'], value: true }
		]);

		expect(result).toEqual({
			display_filters: { layout: 'list' },
			sidebar_preferences: { home: { is_pinned: true }, views: { is_pinned: false } },
			home_preferences: { my_stickies: { is_enabled: true } }
		});
	});

	it('replaces a whole subtree, so keys missing from the new value are gone', () => {
		const data = { rich_filters: { and: [{ state_id__in: ['a'] }] }, filters: { priority: ['urgent'] } };

		const result = applyEmployeeSettingDataOperations(data, [{ op: SET, path: ['rich_filters'], value: {} }]);

		expect(result).toEqual({ rich_filters: {}, filters: { priority: ['urgent'] } });
	});

	it('does not modify the input', () => {
		const data = { a: { b: 1 } };

		applyEmployeeSettingDataOperations(data, [{ op: SET, path: ['a', 'c'], value: { d: [1] } }]);

		expect(data).toEqual({ a: { b: 1 } });
	});

	it('copies the value, so a later change to it does not reach the result', () => {
		const value = { nested: { n: 1 } };
		const result = applyEmployeeSettingDataOperations({}, [{ op: SET, path: ['x'], value }]);

		value.nested.n = 2;

		expect(result).toEqual({ x: { nested: { n: 1 } } });
	});

	it('replaces a null on the way with an object', () => {
		expect(applyEmployeeSettingDataOperations({ a: null }, [{ op: SET, path: ['a', 'b'], value: 1 }])).toEqual({
			a: { b: 1 }
		});
	});

	it('starts from an empty object when the stored data is missing or not an object', () => {
		expect(applyEmployeeSettingDataOperations(undefined, [{ op: SET, path: ['a'], value: 1 }])).toEqual({ a: 1 });
		expect(applyEmployeeSettingDataOperations(null, [{ op: SET, path: ['a'], value: 1 }])).toEqual({ a: 1 });
	});

	it('clears a key and treats a missing path as a no-op', () => {
		const data = { sidebar_preferences: { views: { is_pinned: true }, home: {} } };

		const result = applyEmployeeSettingDataOperations(data, [
			{ op: UNSET, path: ['sidebar_preferences', 'views'] },
			{ op: UNSET, path: ['no', 'such', 'key'] }
		]);

		expect(result).toEqual({ sidebar_preferences: { home: {} } });
	});

	it('applies operations in order', () => {
		const result = applyEmployeeSettingDataOperations({}, [
			{ op: SET, path: ['a'], value: { b: 1 } },
			{ op: SET, path: ['a', 'c'], value: 2 },
			{ op: UNSET, path: ['a', 'b'] }
		]);

		expect(result).toEqual({ a: { c: 2 } });
	});

	it('accepts keys with dots as plain keys', () => {
		expect(applyEmployeeSettingDataOperations({}, [{ op: SET, path: ['a.b'], value: 1 }])).toEqual({ 'a.b': 1 });
	});

	it('uses own keys only, so inherited names such as toString are ordinary keys', () => {
		expect(
			applyEmployeeSettingDataOperations({}, [
				{ op: SET, path: ['toString', 'x'], value: 1 },
				{ op: SET, path: ['valueOf'], value: 2 }
			])
		).toEqual({ toString: { x: 1 }, valueOf: 2 });
		expect(applyEmployeeSettingDataOperations({ a: 1 }, [{ op: UNSET, path: ['hasOwnProperty', 'x'] }])).toEqual({
			a: 1
		});
	});

	it('stores an explicit null', () => {
		expect(applyEmployeeSettingDataOperations({ a: 1 }, [{ op: SET, path: ['a'], value: null }])).toEqual({
			a: null
		});
	});

	it('refuses a path through an array or a scalar', () => {
		expect(() => applyEmployeeSettingDataOperations({ a: [1] }, [{ op: SET, path: ['a', 'b'], value: 1 }])).toThrow(
			BadRequestException
		);
		expect(() => applyEmployeeSettingDataOperations({ a: 'x' }, [{ op: SET, path: ['a', 'b'], value: 1 }])).toThrow(
			BadRequestException
		);
	});

	it('refuses prototype keys anywhere in a path', () => {
		for (const key of ['__proto__', 'prototype', 'constructor']) {
			expect(() =>
				applyEmployeeSettingDataOperations({}, [{ op: SET, path: ['a', key, 'polluted'], value: true }])
			).toThrow(BadRequestException);
		}
		expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
	});

	it('refuses malformed operations', () => {
		const bad = [
			null,
			undefined,
			[null],
			[],
			[{ op: SET, path: [], value: 1 }],
			[{ op: SET, path: [''], value: 1 }],
			[{ op: SET, path: [1 as unknown as string], value: 1 }],
			[{ op: SET, path: ['a'] }],
			[{ op: 'merge' as EmployeeSettingDataOperationEnum, path: ['a'], value: 1 }],
			[{ op: SET, path: Array(MAX_EMPLOYEE_SETTING_DATA_PATH_DEPTH + 1).fill('k'), value: 1 }],
			Array(MAX_EMPLOYEE_SETTING_DATA_OPERATIONS + 1).fill({ op: SET, path: ['a'], value: 1 })
		];

		for (const operations of bad) {
			expect(() => applyEmployeeSettingDataOperations({}, operations)).toThrow(BadRequestException);
		}
	});
});
