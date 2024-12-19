import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IEmployeeSetting } from '@gauzy/contracts';
import { EmployeeSettingUpdateCommand } from '../employee-setting.update.command';
import { EmployeeSettingService } from '../../employee-setting.service';

@CommandHandler(EmployeeSettingUpdateCommand)
export class EmployeeSettingUpdateHandler implements ICommandHandler<EmployeeSettingUpdateCommand> {
	constructor(private readonly employeeSettingService: EmployeeSettingService) {}

	public async execute(command: EmployeeSettingUpdateCommand): Promise<IEmployeeSetting> {
		const { id, input } = command;
		return await this.employeeSettingService.update(id, input);
	}
}
