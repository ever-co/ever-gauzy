import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeeSettingDataOperationEnum } from '@gauzy/contracts';
import { EmployeeSettingDataOperationDTO } from './patch-employee-setting-data.dto';

/** The validation errors of one operation, by property. */
const errorsOf = async (operation: Record<string, unknown>) =>
	(await validate(plainToInstance(EmployeeSettingDataOperationDTO, operation))).map((error) => error.property);

describe('EmployeeSettingDataOperationDTO', () => {
	const { SET, UNSET } = EmployeeSettingDataOperationEnum;

	it('accepts any JSON value for set, null included', async () => {
		for (const value of [null, false, 0, '', [], {}, { nested: [1] }]) {
			expect(await errorsOf({ op: SET, path: ['a'], value })).toEqual([]);
		}
	});

	it('refuses a set without a value', async () => {
		expect(await errorsOf({ op: SET, path: ['a'] })).toEqual(['value']);
	});

	it('accepts an unset without a value', async () => {
		expect(await errorsOf({ op: UNSET, path: ['a'] })).toEqual([]);
	});

	it('refuses an unknown op and an empty or non-string path', async () => {
		expect(await errorsOf({ op: 'merge', path: ['a'], value: 1 })).toEqual(['op']);
		expect(await errorsOf({ op: SET, path: [], value: 1 })).toEqual(['path']);
		expect(await errorsOf({ op: SET, path: [''], value: 1 })).toEqual(['path']);
		expect(await errorsOf({ op: SET, path: [1], value: 1 })).toEqual(['path']);
	});
});
