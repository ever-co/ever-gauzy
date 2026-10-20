import { mayWriteGlobalSettings, operatorUserIds, OPERATOR_USER_IDS_ENV } from './global-setting-writer';

/**
 * The installation-wide settings are every tenant's defaults (their analytics and error-report targets among them),
 * and `GLOBAL_SETTING` is held by every tenant's super admin: only the operator of the installation may write them.
 */
describe('mayWriteGlobalSettings', () => {
	const tenants = (count: number) => jest.fn().mockResolvedValue(count);

	it('lets the super admin of a single-tenant installation write them, as before', async () => {
		expect(await mayWriteGlobalSettings('user-1', tenants(1), {})).toBe(true);
	});

	it('refuses the super admin of one tenant among several when no operator is listed', async () => {
		expect(await mayWriteGlobalSettings('user-1', tenants(2), {})).toBe(false);
		expect(await mayWriteGlobalSettings('user-1', tenants(250), {})).toBe(false);
	});

	it('refuses everyone on an installation with no tenant', async () => {
		expect(await mayWriteGlobalSettings('user-1', tenants(0), {})).toBe(false);
	});

	it('lets a listed operator write them whatever the number of tenants, without counting them', async () => {
		const count = tenants(250);
		const env = { [OPERATOR_USER_IDS_ENV]: ' Operator-1 , operator-2 ' };

		expect(await mayWriteGlobalSettings('operator-1', count, env)).toBe(true);
		expect(await mayWriteGlobalSettings('OPERATOR-2', count, env)).toBe(true);
		expect(count).not.toHaveBeenCalled();
	});

	it('refuses anyone the list does not name, even on a single-tenant installation', async () => {
		const env = { [OPERATOR_USER_IDS_ENV]: 'operator-1' };

		expect(await mayWriteGlobalSettings('user-1', tenants(1), env)).toBe(false);
		expect(await mayWriteGlobalSettings(null, tenants(1), env)).toBe(false);
		expect(await mayWriteGlobalSettings(undefined, tenants(1), env)).toBe(false);
	});
});

describe('operatorUserIds', () => {
	it.each([[undefined], [''], [' , ,']])('reads %p as no list', (value) => {
		expect(operatorUserIds({ [OPERATOR_USER_IDS_ENV]: value })).toBeNull();
	});

	it('reads a comma separated list, trimmed and lower-cased', () => {
		expect(operatorUserIds({ [OPERATOR_USER_IDS_ENV]: 'A-1, b-2 ,,' })).toEqual(['a-1', 'b-2']);
	});
});
