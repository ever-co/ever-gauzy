import {
	ComponentLayoutStyleEnum,
	IEmployee,
	LanguagesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { environment } from '@gauzy/config';
import { isEmpty } from '@gauzy/common';
import { RequestContext } from './../../../core/context';
import { AuthService } from '../../../auth/auth.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { EmployeeService } from '../../employee.service';
import { EmployeeCreateCommand } from '../employee.create.command';
import { EmailService } from '../../../email/email.service';
import { UserCreateCommand } from './../../../user/commands';
import { RoleService } from './../../../role/role.service';
import { UserService } from './../../../user/user.service';

@CommandHandler(EmployeeCreateCommand)
export class EmployeeCreateHandler
	implements ICommandHandler<EmployeeCreateCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _employeeService: EmployeeService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _authService: AuthService,
		private readonly _emailService: EmailService,
		private readonly _roleService: RoleService,
		private readonly _userService: UserService
	) {}

	public async execute(command: EmployeeCreateCommand): Promise<IEmployee> {
		const { input, originUrl = environment.clientBaseUrl } = command;
		const languageCode = command.languageCode || LanguagesEnum.ENGLISH;

		if (isEmpty(input.userId)) {
			/**
			 * Find employee role for relative tenant
			 */
			const role = await this._roleService.findOneByWhereOptions({
				name: RolesEnum.EMPLOYEE,
				tenantId: RequestContext.currentTenantId()
			});

			// 1. Create user to relative tenant.
			const user = await this._commandBus.execute(
				new UserCreateCommand({
					...input.user,
					role,
					hash: await this._authService.getPasswordHash(input.password),
					preferredLanguage: languageCode,
					preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
				})
			);

			// 2. Create employee for specific user
			const employee = await this._employeeService.create({
				...input,
				user
			});

			// 3. Assign organizations to the employee user
			if (employee.organizationId) {
				await this._userOrganizationService.addUserToOrganization(
					employee.user,
					employee.organizationId
				);
			}

			// 4. Send welcome email to user register employee
			this._emailService.welcomeUser(
				employee.user,
				languageCode,
				employee.organizationId,
				originUrl
			);
			return employee;
		} else {
			try {
				const { userId } = input;
				const user = await this._userService.findOneByIdString(userId);

				//2. Create employee for specific user
				return await this._employeeService.create({
					...input,
					user
				});
			} catch (error) {
				console.log('Error while creating employee for existing user', error);
			}
		}
	}
}
