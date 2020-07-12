import { Employee, EmployeeCreateInput, LanguagesEnum } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuthService } from '../../../auth/auth.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { EmployeeService } from '../../employee.service';
import { EmployeeCreateCommand } from '../employee.create.command';
import { EmailService } from '../../../email/email.service';

@CommandHandler(EmployeeCreateCommand)
export class EmployeeCreateHandler
	implements ICommandHandler<EmployeeCreateCommand> {
	constructor(
		private readonly employeeService: EmployeeService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly authService: AuthService,
		private readonly emailService: EmailService
	) {}

	public async execute(command: EmployeeCreateCommand): Promise<Employee> {
		const { input } = command;
		const languageCode = command.languageCode || LanguagesEnum.ENGLISH;
		const inputWithHash = await this._addHashAndLanguage(
			input,
			languageCode
		);
		const employee = await this.employeeService.create(inputWithHash);

		await this.userOrganizationService.addUserToOrganization(
			employee.user,
			input.organization.id
		);

		this.emailService.welcomeUser(
			employee.user,
			languageCode,
			employee.organization.id
		);

		return employee;
	}

	private async _addHashAndLanguage(
		input: EmployeeCreateInput,
		languageCode: LanguagesEnum
	) {
		input.user.hash = await this.authService.getPasswordHash(
			input.password
		);
		input.user.preferredLanguage = languageCode;
		return input;
	}
}
