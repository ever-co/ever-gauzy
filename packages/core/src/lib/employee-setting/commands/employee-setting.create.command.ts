import { ICommand } from '@nestjs/cqrs';
import { IEmployeeSettingCreateInput } from '@gauzy/contracts';

export class EmployeeSettingCreateCommand implements ICommand {
	static readonly type = '[EmployeeSetting] Create';

	constructor(public readonly input: IEmployeeSettingCreateInput) {}
}
