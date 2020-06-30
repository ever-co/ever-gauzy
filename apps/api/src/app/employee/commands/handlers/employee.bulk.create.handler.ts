import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { Employee, EmployeeCreateInput, LanguagesEnum } from '@gauzy/models';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { AuthService } from '../../../auth/auth.service';
import { EmailService } from '../../../email';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler
	implements ICommandHandler<EmployeeBulkCreateCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly authService: AuthService,
		private readonly emailService: EmailService
	) {}

	public async execute(
		command: EmployeeBulkCreateCommand
	): Promise<Employee[]> {
		const { input, languageCode } = command;
		const inputWithHash = await this._loadPasswordHash(input);

		const createdEmployees = await this.employeeService.createBulk(
			inputWithHash
		);

		this._sendWelcomeEmail(createdEmployees, languageCode);

		return createdEmployees;
	}

	private _sendWelcomeEmail(
		employees: Employee[],
		languageCode: LanguagesEnum
	) {
		employees.forEach((employee) =>
			this.emailService.welcomeUser(
				employee.user,
				languageCode,
				employee.organization.id
			)
		);
	}

	private async _loadPasswordHash(input: EmployeeCreateInput[]) {
		const mappedInput = input.map(async (entity) => {
			entity.user.hash = await this.authService.getPasswordHash(
				entity.password
			);
			return entity;
		});
		return Promise.all(mappedInput);
	}
}
