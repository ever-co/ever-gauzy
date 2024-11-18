import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventTypeCreateCommand } from '../event-type.create.command';
import { EventType } from '../../event-type.entity';
import { EventTypeService } from '../../event-type.service';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
import { RequestContext } from '../../../core/context';

@CommandHandler(EventTypeCreateCommand)
export class EventTypeCreateHandler
	implements ICommandHandler<EventTypeCreateCommand> {
	constructor(
		private readonly eventTypeService: EventTypeService,
		private readonly employeeService: EmployeeService,
		private readonly organizationService: OrganizationService
	) {}

	public async execute(command: EventTypeCreateCommand): Promise<EventType> {
		const { input } = command;

		const eventType = new EventType();
		const employee = input.employeeId
			? await this.employeeService.findOneByIdString(input.employeeId)
			: null;
		const organization = await this.organizationService.findOneByIdString(
			input.organizationId
		);

		eventType.employee = employee;
		eventType.organization = organization;
		eventType.isActive = input.isActive || false;
		eventType.description = input.description;
		eventType.title = input.title;
		eventType.durationUnit = input.durationUnit;
		eventType.duration = input.duration;
		eventType.tags = input.tags;
		eventType.tenantId = RequestContext.currentTenantId();

		return await this.eventTypeService.create(eventType);
	}
}
