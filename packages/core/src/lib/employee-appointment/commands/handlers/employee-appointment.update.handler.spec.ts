// Must stay first: loads the entity graph before the handler pulls an entity.
import '../../../core/entities/internal';

import { IEmployeeAppointmentUpdateInput } from '@gauzy/contracts';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointmentUpdateHandler } from './employee-appointment.update.handler';

/**
 * The update kept a field only when `isNotEmpty` held, which is false for `false` and `0`: turning a buffer
 * off or setting the buffer/break minutes to 0 was silently ignored.
 */
describe('EmployeeAppointmentUpdateHandler false and zero values', () => {
	const setup = () => {
		const employeeAppointmentService = { update: jest.fn().mockResolvedValue({}) };
		const handler = new EmployeeAppointmentUpdateHandler(
			employeeAppointmentService as never,
			{ findOneByIdString: jest.fn() } as never,
			{ findOneByIdString: jest.fn() } as never
		);
		const update = (data: Partial<IEmployeeAppointmentUpdateInput>) =>
			handler.execute(new EmployeeAppointmentUpdateCommand('appointment-1', data as IEmployeeAppointmentUpdateInput));
		return { employeeAppointmentService, update };
	};

	it('writes false buffers and 0 minutes', async () => {
		const { employeeAppointmentService, update } = setup();

		await update({ bufferTimeStart: false, bufferTimeEnd: false, bufferTimeInMins: 0, breakTimeInMins: 0 });

		expect(employeeAppointmentService.update).toHaveBeenCalledWith('appointment-1', {
			bufferTimeStart: false,
			bufferTimeEnd: false,
			bufferTimeInMins: 0,
			breakTimeInMins: 0
		});
	});

	it('still coerces the minutes to numbers', async () => {
		const { employeeAppointmentService, update } = setup();

		await update({ bufferTimeInMins: '10' as never, breakTimeInMins: '5' as never });

		expect(employeeAppointmentService.update.mock.calls[0][1]).toEqual({ bufferTimeInMins: 10, breakTimeInMins: 5 });
	});

	it('keeps explicit null minutes null instead of coercing them to 0', async () => {
		const { employeeAppointmentService, update } = setup();

		await update({ bufferTimeInMins: null, breakTimeInMins: null });

		expect(employeeAppointmentService.update.mock.calls[0][1]).toEqual({ bufferTimeInMins: null, breakTimeInMins: null });
	});

	it('treats an empty string as not sent, as before', async () => {
		const { employeeAppointmentService, update } = setup();

		await update({ bufferTimeStart: '' as never, bufferTimeInMins: '' as never, agenda: 'Renamed' });

		expect(employeeAppointmentService.update.mock.calls[0][1]).toEqual({ agenda: 'Renamed' });
	});

	it('leaves the fields out of the request untouched', async () => {
		const { employeeAppointmentService, update } = setup();

		await update({ agenda: 'Renamed' });

		expect(employeeAppointmentService.update.mock.calls[0][1]).toEqual({ agenda: 'Renamed' });
	});
});
