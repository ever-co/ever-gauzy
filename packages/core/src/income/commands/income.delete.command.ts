import { ICommand } from '@nestjs/cqrs';

export class IncomeDeleteCommand implements ICommand {
	static readonly type = '[Income] Delete';

	constructor(
		public readonly employeeId: string,
		public readonly incomeId: string
	) {}
}
