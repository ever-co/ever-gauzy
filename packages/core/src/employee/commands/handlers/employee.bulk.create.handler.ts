import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../employee.service';
import {
	IEmployee,
	IEmployeeCreateInput,
	LanguagesEnum
} from '@gauzy/contracts';
import { EmployeeBulkCreateCommand } from '../employee.bulk.create.command';
import { AuthService } from '../../../auth/auth.service';
import { EmailService } from '../../../email';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';

@CommandHandler(EmployeeBulkCreateCommand)
export class EmployeeBulkCreateHandler
	implements ICommandHandler<EmployeeBulkCreateCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly authService: AuthService,
		private readonly emailService: EmailService,
		private readonly userOrganizationService: UserOrganizationService
	) {}

	public async execute(
		command: EmployeeBulkCreateCommand
	): Promise<IEmployee[]> {
		const { input, languageCode } = command;
		const inputWithHash = await this._loadPasswordHash(input);
		const createdEmployees = await this.employeeService.createBulk(inputWithHash);
		
		for await (const employee of createdEmployees) {
			await this.userOrganizationService.addUserToOrganization(
				employee.user,
				employee.organizationId
			);
		}
		await this._sendWelcomeEmail(createdEmployees, languageCode);
		return createdEmployees;
	}

	/**
	 * Send Welcome Email
	 * 
	 * @param employees 
	 * @param languageCode 
	 */
	private async _sendWelcomeEmail(employees: IEmployee[], languageCode: LanguagesEnum) {
		for await (const employee of employees) {
			await this.emailService.welcomeUser(
				employee.user,
				languageCode,
				employee.organization.id
			);
		}
	}

	private async _loadPasswordHash(employees: IEmployeeCreateInput[]) {
		for await (const employee of employees) {
			employee.user.hash = await this.authService.getPasswordHash(
				employee.password
			);
		}
		return employees;
	}
}
