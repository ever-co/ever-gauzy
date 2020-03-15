import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import { Employee, EmployeeCreateInput } from '@gauzy/models';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { AuthService } from '../../../auth';
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
		const { input } = command;
		const inputWithHash = await this._loadPasswordHash(input);

		const createdEmployees = await this.employeeService.createBulk(
			inputWithHash
		);

		this._sendWelcomeEmail(createdEmployees);

		console.log('createdEmployees:', createdEmployees);
		return createdEmployees;
	}

	private _sendWelcomeEmail(employees: Employee[]) {
		employees.map((employee) =>
			this.emailService.welcomeUser(employee.user)
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
