import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { CandidateStatusEnum, ComponentLayoutStyleEnum, ICandidate, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { UserCreateCommand } from './../../../user/commands';
import { CandidateCreateCommand } from '../candidate.create.command';
import { AuthService } from './../../../auth/auth.service';
import { CandidateService } from '../../candidate.service';
import { RoleService } from './../../../role/role.service';
import { UserOrganizationService } from './../../../user-organization/user-organization.services';
import { EmailService } from './../../../email-send/email.service';

@CommandHandler(CandidateCreateCommand)
export class CandidateCreateHandler implements ICommandHandler<CandidateCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _authService: AuthService,
		private readonly _candidateService: CandidateService,
		private readonly _roleService: RoleService,
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _emailService: EmailService
	) {}

	/**
	 * Executes the candidate creation process.
	 *
	 * @param command - The command containing the necessary information to create a candidate.
	 * @returns A promise that resolves to the created candidate.
	 * @throws BadRequestException if any error occurs during the candidate creation process.
	 */
	public async execute(command: CandidateCreateCommand): Promise<ICandidate> {
		try {
			const { input, originUrl = environment.clientBaseUrl, languageCode } = command;

			// Find candidate role for the relative tenant
			const role = await this._roleService.findOneByWhereOptions({
				name: RolesEnum.CANDIDATE
			});

			// 1. Create user to relative candidate for specific tenant.
			const user = await this._commandBus.execute(
				new UserCreateCommand({
					...input.user,
					role,
					hash: await this._authService.getPasswordHash(input.password),
					preferredLanguage: languageCode || LanguagesEnum.ENGLISH,
					preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
				})
			);

			// 2. Create candidate for specific user
			const candidate = await this._candidateService.create({
				...input,
				status: CandidateStatusEnum.APPLIED,
				user
			});

			// 3. Assign organization to the candidate user
			if (candidate.organizationId) {
				await this._userOrganizationService.addUserToOrganization(user, candidate.organizationId);
			}

			// 4. Send welcome email to candidate user
			this._emailService.welcomeUser(user, languageCode, candidate.organizationId, originUrl);
			return candidate;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
