import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from '../../employee-appointment.service';
import { EmployeeAppointmentUpdateCommand } from '../employee-appointment.update.command';
import { EmployeeAppointment } from '../../employee-appointment.entity';
import { UpdateResult } from 'typeorm';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { isNotEmpty } from '@gauzy/utils';

@CommandHandler(EmployeeAppointmentUpdateCommand)
export class EmployeeAppointmentUpdateHandler implements ICommandHandler<EmployeeAppointmentUpdateCommand> {
	constructor(
		private employeeAppointmentService: EmployeeAppointmentService,
		private employeeService: EmployeeService,
		private organizationService: OrganizationService
	) {}

	public async execute(command?: EmployeeAppointmentUpdateCommand): Promise<UpdateResult | EmployeeAppointment> {
		const { id, employeeAppointmentUpdateRequest: data } = command;
		const employee = data.employeeId ? await this.employeeService.findOneByIdString(data.employeeId) : null;
		const organization = data.organizationId
			? await this.organizationService.findOneByIdString(data.organizationId)
			: null;
		const tenantId = organization?.tenantId ? organization.tenantId : null;
		const newAppointment = {
			...(isNotEmpty(employee) ? { employeeId: employee.id } : {}),
			...(isNotEmpty(organization) ? { organizationId: organization.id } : {}),
			...(isNotEmpty(tenantId) ? { tenantId: organization.tenantId } : {}),
			...(isNotEmpty(data.agenda) ? { agenda: data.agenda } : {}),
			...(isNotEmpty(data['emails']) ? { emails: data['emails'] } : {}),
			...(isNotEmpty(data['status']) ? { status: data['status'] } : {}),
			...(isNotEmpty(data.description) ? { description: data.description } : {}),
			...(isNotEmpty(data.location) ? { location: data.location } : {}),
			...(isNotEmpty(data.breakStartTime) ? { breakStartTime: data.breakStartTime } : {}),
			// `isNotEmpty` treats false and 0 as empty, so switching a buffer off or setting 0 minutes was dropped:
			// only a key left out of the request is skipped (null stays null instead of being coerced to 0)
			...(data.breakTimeInMins !== undefined
				? { breakTimeInMins: data.breakTimeInMins === null ? null : +data.breakTimeInMins }
				: {}),
			...(data.bufferTimeStart !== undefined ? { bufferTimeStart: data.bufferTimeStart } : {}),
			...(data.bufferTimeEnd !== undefined ? { bufferTimeEnd: data.bufferTimeEnd } : {}),
			...(data.bufferTimeInMins !== undefined
				? { bufferTimeInMins: data.bufferTimeInMins === null ? null : +data.bufferTimeInMins }
				: {}),
			...(isNotEmpty(data.startDateTime) ? { startDateTime: data.startDateTime } : {}),
			...(isNotEmpty(data.endDateTime) ? { endDateTime: data.endDateTime } : {})
		};
		const updatedAppointment = await this.employeeAppointmentService.update(id, newAppointment);

		return updatedAppointment;
	}
}
