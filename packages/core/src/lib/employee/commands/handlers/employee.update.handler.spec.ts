// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

import { IEmployeeUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * #10684: every employee update wrote `upworkId` and `linkedInId`, as null when the request left them
 * out, so toggling time tracking or saving another edit tab wiped both. They are now written only when
 * the request includes them, and an empty value still clears them.
 */
describe('EmployeeUpdateHandler — Upwork and LinkedIn ids', () => {
	const ID = 'employee-1';

	let create: jest.Mock;
	let handler: EmployeeUpdateHandler;

	beforeEach(() => {
		create = jest.fn(async (entity) => entity);
		const employeeService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: ID, upworkId: 'upwork-1', linkedInId: 'linkedin-1' }),
			create
		};
		handler = new EmployeeUpdateHandler(employeeService as any, {} as any);

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'admin', employeeId: null } as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.ORG_EMPLOYEES_EDIT
		);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The object the update hands to `create()`, which saves it. */
	async function saved(input: IEmployeeUpdateInput) {
		await handler.execute(new EmployeeUpdateCommand(ID, input));
		expect(create).toHaveBeenCalledTimes(1);
		return create.mock.calls[0][0];
	}

	it('does not write the ids when the request leaves them out', async () => {
		// A save from another edit tab, such as the timer settings
		const entity = await saved({ allowScreenshotCapture: false });

		expect(entity).toEqual({ id: ID, allowScreenshotCapture: false });
		expect(entity).not.toHaveProperty('upworkId');
		expect(entity).not.toHaveProperty('linkedInId');
	});

	it('does not write an id sent as undefined', async () => {
		const entity = await saved({ upworkId: undefined, linkedInId: undefined, description: 'Edited' });

		expect(entity).not.toHaveProperty('upworkId');
		expect(entity).not.toHaveProperty('linkedInId');
	});

	it('writes the id the request changes and leaves the other out', async () => {
		const entity = await saved({ upworkId: 'upwork-2' });

		expect(entity.upworkId).toBe('upwork-2');
		expect(entity).not.toHaveProperty('linkedInId');
	});

	it('clears an id sent empty or null', async () => {
		const entity = await saved({ upworkId: '', linkedInId: null });

		expect(entity).toMatchObject({ upworkId: null, linkedInId: null });
	});
});
