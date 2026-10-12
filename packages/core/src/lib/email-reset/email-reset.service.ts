import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ForbiddenException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IsNull, MoreThanOrEqual, SelectQueryBuilder } from 'typeorm';
import { ID, IEmailReset, IEmailResetFindInput, IOrganization, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { generateAlphaNumericCode } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { UserService } from '../user/user.service';
import { TenantAwareCrudService } from '../core/crud';
import { freshTimestamp, MultiORMEnum } from '../core/utils';
import { UNCONFIRMED_EMAIL_STATE } from '../user/email-change.util';
import { EmailReset } from './email-reset.entity';
import { UserEmailDTO } from '../user/dto';
import { EmailResetCreateCommand } from './commands';
import { EmailResetGetQuery } from './queries';
import { VerifyEmailResetRequestDTO } from './dto/verify-email-reset-request.dto';
import { EmailService } from './../email-send/email.service';
import { EmployeeService } from './../employee/employee.service';
import { AuthService } from './../auth/auth.service';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmEmailResetRepository } from './repository/type-orm-email-reset.repository';
import { MikroOrmEmailResetRepository } from './repository/mikro-orm-email-reset.repository';

/**
 * One address-change request as a list answers it: who asked, from which address to which, and whether it
 * has lapsed. The verification code and the token are never members — they are the secret the request is
 * proved with, and a list that carried them would let its reader complete someone else's change.
 */
export interface IEmailResetView {
	id: ID;
	email: string;
	oldEmail: string;
	userId?: ID;
	tenantId?: ID;
	isExpired: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

/** The most requests one read answers: a person makes a handful, and the newest are the ones that matter. */
const EMAIL_RESET_READ_LIMIT = 100;

@Injectable()
export class EmailResetService extends TenantAwareCrudService<EmailReset> {
	constructor(
		readonly typeOrmEmailResetRepository: TypeOrmEmailResetRepository,
		readonly mikroOrmEmailResetRepository: MikroOrmEmailResetRepository,
		private readonly userService: UserService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
		private readonly emailService: EmailService,
		private readonly employeeService: EmployeeService,
		private readonly authService: AuthService
	) {
		super(typeOrmEmailResetRepository, mikroOrmEmailResetRepository);
	}

	/**
	 * The address-change requests of one user of the caller's tenant, newest first, without their secrets.
	 *
	 * By default the caller's own. Another user's requests are read only by a caller holding
	 * `ORG_USERS_EDIT` — the grant that may change another user's account — and only within the caller's
	 * tenant, which the read is scoped to; a user of another tenant reads as having none. The code and the
	 * token are not selected at all, so no projection mistake can leak them.
	 *
	 * @param userId The user whose requests are read. Omit it for the caller.
	 * @returns The requests, at most a hundred, newest first.
	 * @throws UnauthorizedException when the request carries no user or no tenant.
	 * @throws ForbiddenException when the caller asks for another user's requests without `ORG_USERS_EDIT`.
	 */
	async findForUser(userId?: ID): Promise<IEmailResetView[]> {
		const tenantId = RequestContext.currentTenantId();
		const callerId = RequestContext.currentUserId();

		if (!tenantId || !callerId) {
			throw new UnauthorizedException();
		}

		const subject = userId ?? callerId;

		if (subject !== callerId && !RequestContext.hasPermission(PermissionsEnum.ORG_USERS_EDIT)) {
			throw new ForbiddenException("Reading another user's address-change requests requires ORG_USERS_EDIT.");
		}

		const rows = await this.find({
			where: { tenantId, userId: subject },
			select: {
				id: true,
				email: true,
				oldEmail: true,
				userId: true,
				tenantId: true,
				expiredAt: true,
				createdAt: true,
				updatedAt: true
			},
			order: { createdAt: 'DESC' },
			take: EMAIL_RESET_READ_LIMIT
		} as never);
		const now = Date.now();

		// Built member by member rather than spread, so a column the read did return can never ride along.
		return (rows ?? []).map((row) => ({
			id: row.id,
			email: row.email,
			oldEmail: row.oldEmail,
			userId: row.userId,
			tenantId: row.tenantId,
			isExpired: row.expiredAt ? new Date(row.expiredAt).getTime() < now : false,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}));
	}

	async requestChangeEmail(request: UserEmailDTO, languageCode: LanguagesEnum) {
		try {
			let user = RequestContext.currentUser();

			user = await this.userService.findOneByIdString(user.id, {
				relations: { role: true }
			});

			const token = await this.authService.getJwtAccessToken(user);

			/**
			 * User with email already exist
			 */
			if (user.email === request.email || (await this.userService.checkIfExistsEmail(request.email))) {
				return new Object({
					status: HttpStatus.OK,
					message: `OK`
				});
			}

			const verificationCode = generateAlphaNumericCode();

			await this.commandBus.execute(
				new EmailResetCreateCommand({
					code: verificationCode,
					email: request.email,
					oldEmail: user.email,
					userId: user.id,
					token
				})
			);

			// The mail is branded/sent through the user's organization. Users without an employee record
			// (admins, other non-employee roles) have no employee to look up — an empty id must not be
			// looked up (it used to match an arbitrary employee and borrow THAT organization's SMTP);
			// fall back to the caller's current organization / tenant instead.
			let organization: IOrganization | undefined;
			if (user.employeeId) {
				const employee = await this.employeeService.findOneByIdString(user.employeeId, {
					relations: { organization: true }
				});
				organization = employee?.organization;
			}
			if (!organization) {
				organization = {
					id: RequestContext.currentOrganizationId() ?? undefined,
					tenantId: user.tenantId
				} as IOrganization;
			}

			this.emailService.emailReset(
				{
					...user,
					email: request.email
				},
				languageCode || (user.preferredLanguage as LanguagesEnum),
				verificationCode,
				organization
			);
		} finally {
			// we reply "OK" in any case for security reasons
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}

	async verifyCode(request: VerifyEmailResetRequestDTO) {
		try {
			const { code } = request;
			const user = RequestContext.currentUser();

			const record: IEmailReset = await this.queryBus.execute(
				new EmailResetGetQuery({
					code,
					oldEmail: user.email,
					userId: user.id
				})
			);

			if (
				!record ||
				/**
				 * Check if other user has already registered with same email
				 */
				(await this.userService.checkIfExistsEmail(record.email))
			) {
				// we reply with OK, but just do not update email for the user if something is wrong
				return new Object({
					status: HttpStatus.OK,
					message: `OK`
				});
			}

			// we only do update if all checks completed above.
			// The code was e-mailed to the new address, so entering it confirms that address: record a
			// fresh confirmation instead of keeping the one made for the previous address, and drop any
			// confirmation link or code that was issued for the previous address.
			await this.userService.update(
				{
					id: record.userId
				},
				{
					email: record.email,
					...UNCONFIRMED_EMAIL_STATE,
					emailVerifiedAt: freshTimestamp()
				}
			);
		} finally {
			// we reply "OK" in any case for security reasons
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}

	async getEmailResetIfCodeMatches(input: IEmailResetFindInput) {
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const item = await this.mikroOrmRepository.findOneOrFail(
						{
							...input,
							$or: [{ expiredAt: { $gte: new Date() } }, { expiredAt: null }]
						} as any,
						{
							orderBy: { createdAt: 'DESC' as any }
						}
					);
					return this.serialize(item);
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder('email_reset');
					query.where((qb: SelectQueryBuilder<EmailReset>) => {
						qb.andWhere(input);
						qb.andWhere([
							{
								expiredAt: MoreThanOrEqual(new Date())
							},
							{
								expiredAt: IsNull()
							}
						]);
					});
					query.orderBy(p(`"${query.alias}"."createdAt"`), 'DESC');

					return await query.getOneOrFail();
				}
			}
		} catch (error) {
			throw new NotFoundException(error);
		}
	}
}
