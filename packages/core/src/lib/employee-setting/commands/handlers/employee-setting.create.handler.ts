import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeSetting } from '@gauzy/contracts';
import { EmployeeSettingCreateCommand } from '../employee-setting.create.command';
import { EmployeeSettingService } from '../../employee-setting.service';

@CommandHandler(EmployeeSettingCreateCommand)
export class EmployeeSettingCreateHandler implements ICommandHandler<EmployeeSettingCreateCommand> {
	constructor(private readonly employeeSettingService: EmployeeSettingService) {}

	public async execute(command: EmployeeSettingCreateCommand): Promise<IEmployeeSetting> {
		const { input } = command;
		return await this.employeeSettingService.create(input);
	}
}
