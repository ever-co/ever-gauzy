import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ComponentLayoutStyleEnum, IEmployee, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../../core/context';
import { AuthService } from '../../../auth/auth.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { EmployeeService } from '../../employee.service';
import { EmployeeCreateCommand } from '../employee.create.command';
import { EmailService } from './../../../email-send/email.service';
import { UserCreateCommand } from './../../../user/commands';
import { RoleService } from './../../../role/role.service';
import { UserService } from './../../../user/user.service';

@CommandHandler(EmployeeCreateCommand)
export class EmployeeCreateHandler implements ICommandHandler<EmployeeCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _employeeService: EmployeeService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _authService: AuthService,
		private readonly _emailService: EmailService,
		private readonly _roleService: RoleService,
		private readonly _userService: UserService
	) {}

	/**
	 * Execute the employee creation command.
	 *
	 * @param command - The employee creation command.
	 * @returns The created employee.
	 * @throws SomeAppropriateException if an error occurs during the process.
	 */
	public async execute(command: EmployeeCreateCommand): Promise<IEmployee> {
		const { input, originUrl = environment.clientBaseUrl } = command;
		const languageCode = command.languageCode || LanguagesEnum.ENGLISH;
		const { organizationId } = input;

		if (isEmpty(input.userId)) {
			// 1. Find employee role for relative tenant
			const role = await this._roleService.findOneByWhereOptions({
				name: RolesEnum.EMPLOYEE,
				tenantId: RequestContext.currentTenantId()
			});

			// 2. Get Password Hash
			const passwordHash = await this._authService.getPasswordHash(input.password);

			// 3. Create user to relative tenant.
			const user = await this._commandBus.execute(
				new UserCreateCommand({
					...input.user,
					role,
					hash: passwordHash,
					preferredLanguage: languageCode,
					preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
				})
			);

			// 4. Create employee for specific user
			const employee = await this._employeeService.create({
				...input,
				user,
				organizationId,
				organization: { id: organizationId }
			});

			// 5. Assign organizations to the employee user
			if (!!employee.organizationId) {
				await this._userOrganizationService.addUserToOrganization(user, organizationId);
			}

			// 6. Send welcome email to user register employee
			this._emailService.welcomeUser(user, languageCode, organizationId, originUrl);
			return employee;
		} else {
			try {
				const user = await this._userService.findOneByIdString(input.userId);

				//1. Create employee for specific user
				return await this._employeeService.create({
					...input,
					user,
					organizationId,
					organization: { id: organizationId }
				});
			} catch (error) {
				console.log('Error while creating employee for existing user', error);
			}
		}
	}
}
