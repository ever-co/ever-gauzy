// Must stay first: loads the entity graph before the handler pulls an entity.
import '../../../core/entities/internal';

import { IEmployeeAppointmentCreateInput, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeAppointmentCreateCommand } from '../employee-appointment.create.command';
import { EmployeeAppointmentCreateHandler } from './employee-appointment.create.handler';

/**
 * `bufferTimeInMins` and `breakTimeInMins` are optional, but the handler coerced them with a bare `+`:
 * an appointment created without them was saved with NaN, which Postgres rejects for an integer column.
 */
describe('EmployeeAppointmentCreateHandler optional minutes', () => {
	const setup = () => {
		const employeeAppointmentService = { create: jest.fn(async (appointment) => appointment) };
		const organizationService = { findOneByIdString: jest.fn().mockResolvedValue({ id: 'org-1' }) };
		const handler = new EmployeeAppointmentCreateHandler(
			employeeAppointmentService as never,
			{ sendAppointmentMail: jest.fn() } as never,
			{ findOneByIdString: jest.fn() } as never,
			organizationService as never
		);
		const create = (input: Partial<IEmployeeAppointmentCreateInput>) =>
			handler.execute(
				new EmployeeAppointmentCreateCommand(
					{
						agenda: 'Intro call',
						organizationId: 'org-1',
						startDateTime: new Date('2026-10-19T09:00:00Z'),
						endDateTime: new Date('2026-10-19T10:00:00Z'),
						...input
					} as IEmployeeAppointmentCreateInput,
					LanguagesEnum.ENGLISH
				)
			);
		return { employeeAppointmentService, create };
	};

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));

	afterEach(() => jest.restoreAllMocks());

	it('saves null, not NaN, when the minutes are omitted', async () => {
		const { employeeAppointmentService, create } = setup();

		await create({});

		const saved = employeeAppointmentService.create.mock.calls[0][0];
		expect(saved.bufferTimeInMins).toBeNull();
		expect(saved.breakTimeInMins).toBeNull();
	});

	it('saves the given minutes as numbers, 0 included', async () => {
		const { employeeAppointmentService, create } = setup();

		await create({ bufferTimeInMins: '15' as never, breakTimeInMins: 0 });

		const saved = employeeAppointmentService.create.mock.calls[0][0];
		expect(saved.bufferTimeInMins).toBe(15);
		expect(saved.breakTimeInMins).toBe(0);
	});
});
