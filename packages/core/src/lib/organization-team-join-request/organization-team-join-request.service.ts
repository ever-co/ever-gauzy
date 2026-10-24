import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	HttpStatus,
	NotFoundException
} from '@nestjs/common';
import { MoreThanOrEqual, SelectQueryBuilder, IsNull, FindManyOptions, In } from 'typeorm';
import { JwtPayload } from 'jsonwebtoken';
import * as moment from 'moment';
import { IAppIntegrationConfig } from '@gauzy/common';
import { environment } from '@gauzy/config';
import {
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestCreateInput,
	IOrganizationTeamJoinRequestValidateInput,
	IPagination,
	IRole,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { generateAlphaNumericCode } from '@gauzy/utils';
import { TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from '../core/utils';
import { RequestContext } from './../core/context';
import { User } from './../core/entities/internal';
import { EmailService } from './../email-send/email.service';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamService } from './../organization-team/organization-team.service';
import { InviteService } from './../invite/invite.service';
import { RoleService } from './../role/role.service';
import { EmployeeService } from './../employee/employee.service';
import { TypeOrmOrganizationTeamJoinRequestRepository } from './repository/type-orm-organization-team-join-request.repository';
import { MikroOrmOrganizationTeamJoinRequestRepository } from './repository/mikro-orm-organization-team-join-request.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { LoginAttemptScope, LoginAttemptService } from '../auth/login-attempt.service';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';

@Injectable()
export class OrganizationTeamJoinRequestService extends TenantAwareCrudService<OrganizationTeamJoinRequest> {
	constructor(
		readonly typeOrmOrganizationTeamJoinRequestRepository: TypeOrmOrganizationTeamJoinRequestRepository,
		readonly mikroOrmOrganizationTeamJoinRequestRepository: MikroOrmOrganizationTeamJoinRequestRepository,
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _organizationTeamService: OrganizationTeamService,
		private readonly _emailService: EmailService,
		private readonly _inviteService: InviteService,
		private readonly _roleService: RoleService,
		private readonly _loginAttemptService: LoginAttemptService
	) {
		super(typeOrmOrganizationTeamJoinRequestRepository, mikroOrmOrganizationTeamJoinRequestRepository);
	}

	/**
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(
		options?: FindManyOptions<OrganizationTeamJoinRequest>
	): Promise<IPagination<OrganizationTeamJoinRequest>> {
		return await super.findAll(options);
	}

	/**
	 * Create organization team join request
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	async create(
		entity: IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>,
		languageCode?: LanguagesEnum
	): Promise<IOrganizationTeamJoinRequest> {
		const { organizationTeamId, email, fullName, linkAddress, position } = entity;

		/** find existing team join request and throw exception */
		const request = await this.count({
			where: {
				organizationTeamId,
				email
			}
		});
		if (request > 0) {
			throw new ConflictException(
				'You have sent already join request for this team, please wait for manager response.'
			);
		}

		/** Create new team join request */
		try {
			const organizationTeam = await this._organizationTeamService.findOneByIdString(organizationTeamId, {
				where: {
					public: true
				},
				relations: {
					organization: true
				}
			});
			const { organization, organizationId, tenantId } = organizationTeam;
			const code = generateAlphaNumericCode();

			const payload: JwtPayload = {
				email,
				tenantId,
				organizationId,
				organizationTeamId,
				code
			};
			/** Generate JWT token using above JWT payload */
			const token: string = signPurposeToken(TokenPurposeEnum.TEAM_JOIN, payload, {
				expiresIn: `${environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME}s`
			});

			/**
			 * Creates a new entity instance and copies all entity properties from this object into a new entity.
			 * Note that it copies only properties that are present in entity schema.
			 */
			const createEntityLike = this.typeOrmRepository.create({
				organizationTeamId,
				email,
				fullName,
				linkAddress,
				position,
				organizationId,
				tenantId,
				code,
				token,
				status: null
			});
			// Public route, no caller tenant to stamp: the row keeps the tenant of the public team found above.
			// Saved as a plain copy so MikroORM builds the relations from their ids instead of upserting the instance.
			const organizationTeamJoinRequest = await this.saveWithoutEnrichment({ ...createEntityLike });

			/** Place here organization team join request email to send verification code*/
			let { appName, appLogo, appSignature, appLink, companyLink, companyName } = entity;

			this._emailService.organizationTeamJoinRequest(
				organizationTeam,
				organizationTeamJoinRequest,
				languageCode,
				organization,
				{
					appName,
					appLogo,
					appSignature,
					appLink,
					companyLink,
					companyName
				}
			);

			return organizationTeamJoinRequest;
		} catch (error) {
			throw new BadRequestException('Error while requesting join organization team');
		}
	}

	/**
	 * Validate organization team join request
	 *
	 * @param options
	 * @returns
	 */
	async validateJoinRequest(
		options: IOrganizationTeamJoinRequestValidateInput
	): Promise<IOrganizationTeamJoinRequest> {
		const { email, token, code, organizationTeamId } = options;

		// The confirmation code is six alphanumeric characters — roughly 2^31 possibilities — so a
		// per-address rate limit alone leaves it guessable by anything distributed. Count failures
		// against the email instead, outside the catch that turns everything into a 400.
		const attempt = await this._loginAttemptService.begin(LoginAttemptScope.TEAM_JOIN_CODE, email);

		try {
			let record: IOrganizationTeamJoinRequest;

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const item = await this.mikroOrmRepository.findOneOrFail({
						email,
						organizationTeamId,
						expiredAt: { $gte: new Date() },
						status: null,
						$or: [{ code }, { token }]
					} as any);
					record = this.serialize(item);
					break;
				}
				case MultiORMEnum.TypeORM:
				default: {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.setFindOptions({
						select: {
							id: true,
							email: true,
							organizationTeamId: true
						}
					});
					query.where((qb: SelectQueryBuilder<OrganizationTeamJoinRequest>) => {
						qb.andWhere({
							email,
							organizationTeamId,
							expiredAt: MoreThanOrEqual(new Date()),
							status: IsNull()
						});
						// Only OR together the credentials that were actually supplied. The DTO validates code
						// or token, not both, so the other may arrive as null: as an OR arm that would now read
						// `token IS NULL` and widen a security-sensitive lookup instead of being dropped.
						const credentials = [...(code ? [{ code }] : []), ...(token ? [{ token }] : [])];
						if (credentials.length === 0) {
							throw new BadRequestException('A confirmation code or token is required');
						}
						qb.andWhere(credentials);
					});
					record = await query.getOneOrFail();
					break;
				}
			}

			await super.update(record.id, {
				status: OrganizationTeamJoinRequestStatusEnum.REQUESTED
			});
			delete record.id;

			await attempt.succeed();

			return record;
		} catch (error) {
			// A request that carried no code or token at all guessed nothing, so it gives its slot back
			// instead of counting against the email (a buggy client must not lock the join flow). Every
			// other path — above all the lookup miss of a wrong code — counts: the check fails closed.
			if (error instanceof BadRequestException) {
				await attempt.release();
			} else {
				await attempt.fail();
			}
			throw new BadRequestException();
		}
	}

	async resendConfirmationCode(
		entity: IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>,
		languageCode?: LanguagesEnum
	) {
		const { organizationTeamId, email } = entity;

		try {
			/** find existing team join request */
			const request = await this.findOneByOptions({
				where: {
					organizationTeamId,
					email,
					status: IsNull()
				},
				relations: {
					organizationTeam: {
						organization: true
					}
				}
			});

			const code = generateAlphaNumericCode();

			const payload: JwtPayload = {
				email,
				tenantId: request.tenantId,
				organizationId: request.organizationId,
				organizationTeamId,
				code
			};
			/** Generate JWT token using above JWT payload */
			const token: string = signPurposeToken(TokenPurposeEnum.TEAM_JOIN, payload, {
				expiresIn: `${environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME}s`
			});

			/** Update code, token and expiredAt */
			await super.update(request.id, {
				code,
				token,
				expiredAt: moment(new Date()).add(environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME, 'seconds').toDate()
			});

			/** Place here organization team join request email to send verification code*/
			let { appName, appLogo, appSignature, appLink, companyLink, companyName } = entity;
			this._emailService.organizationTeamJoinRequest(
				request.organizationTeam,
				{
					...request,
					code,
					token
				},
				languageCode,
				request.organizationTeam.organization,
				{
					appName,
					appLogo,
					appSignature,
					appLink,
					companyLink,
					companyName
				}
			);
		} finally {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`
			});
		}
	}

	async acceptRequestToJoin(id: string, action: OrganizationTeamJoinRequestStatusEnum, languageCode: LanguagesEnum) {
		const tenantId = RequestContext.currentTenantId();
		const createdByUserId = RequestContext.currentUserId();

		const request = await this.findOneByWhereOptions({
			id,
			tenantId
		});
		if (!request) {
			throw new NotFoundException('Request not found.');
		}

		await this.assertMayActOnRequest(request, tenantId);

		/**
		 * ACCEPTED
		 */
		if (action === OrganizationTeamJoinRequestStatusEnum.ACCEPTED) {
			this.assertAwaitsApproval(request);

			/**
			 * Fetch user if already present in current tenant
			 */
			let currentTenantUser: User = await this.typeOrmUserRepository.findOne({
				where: {
					email: request.email,
					tenantId
				},
				relations: {
					tenant: true,
					role: true
				}
			});

			/**
			 * Accepted Case - 1
			 * Current user is already part of tenant as separate user
			 */
			if (currentTenantUser) {
				const employee = await this._employeeService.findOneByOptions({
					where: {
						userId: currentTenantUser.id
					}
				});

				/**
				 * Check if user is already part of requested team
				 */
				let employeePresentInTeam = null;

				if (employee) {
					try {
						await this._organizationTeamService.findOneByWhereOptions({
							members: {
								employeeId: employee.id
							},
							id: request.organizationTeamId
						});
						employeePresentInTeam = true;
					} catch (error) {
						// A miss (404) means "not on the team yet". Any other failure is not an answer to that
						// question, so it is raised rather than read as a miss that would add the employee again.
						if (!(error instanceof NotFoundException)) {
							throw error;
						}
						employeePresentInTeam = false;
					}
				}

				/**
				 * Add employee to team
				 */
				if (!employeePresentInTeam && employee) {
					await this.typeOrmOrganizationTeamEmployeeRepository.save({
						employeeId: employee.id,
						organizationTeamId: request.organizationTeamId,
						tenantId,
						organizationId: request.organizationId
					});
				}

				/**
				 * Mark the request accepted, whether the employee was just added or was already on the team
				 */
				if (employee) {
					await super.update(id, {
						status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
						userId: currentTenantUser.id
					});
				}
			}

			/**
			 * Accepted Case - 2
			 * Current user is not belong to this tenant
			 */
			if (!currentTenantUser) {
				const names = request?.fullName?.trim().split(/\s+/) ?? [];

				const role: IRole = await this._roleService.findOneByWhereOptions({
					name: RolesEnum.EMPLOYEE
				});
				const newTenantUser = await this._inviteService.createUser(
					{
						user: {
							firstName: names[0] ?? '',
							lastName: names.slice(1).join(' '),
							email: request.email,
							tenantId: tenantId,
							role: role
						},
						organizationId: request.organizationId,
						createdByUserId
					},
					request.organizationTeamId,
					languageCode
				);

				await super.update(id, {
					status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
					userId: newTenantUser.id
				});
			}
		}

		/**
		 * REJECTED
		 */
		if (action === OrganizationTeamJoinRequestStatusEnum.REJECTED) {
			await super.update(id, {
				status: OrganizationTeamJoinRequestStatusEnum.REJECTED
			});
		}
	}

	/**
	 * Refuses to accept a join request that is not waiting for a manager's decision.
	 *
	 * A request moves through one sequence. The public `create` stores it with `status: null`. The requester
	 * confirms their address with the emailed code or token (`validateJoinRequest`, which only matches
	 * `status IS NULL` within `expiredAt`), and that moves it to `REQUESTED`. A manager then accepts or rejects it.
	 * `acceptRequestToJoin` never read the status, so an unconfirmed request (an address nobody proved they own)
	 * could be accepted. That added the existing employee behind that address to the team without their consent,
	 * or provisioned a passwordless EMPLOYEE account for it. A request already accepted or rejected could also be
	 * accepted again. Only `REQUESTED` is accepted now. That is also the only status the Ever Teams invitation
	 * table shows the accept action for.
	 *
	 * `expiredAt` is not re-checked: it bounds the confirmation code, which a `REQUESTED` request has already
	 * redeemed, and a manager may decide after that window.
	 *
	 * @param request - The join request a manager is accepting.
	 * @throws {ConflictException} When the request is unconfirmed, or already decided.
	 */
	private assertAwaitsApproval(request: IOrganizationTeamJoinRequest): void {
		if (request.status === OrganizationTeamJoinRequestStatusEnum.REQUESTED) {
			return;
		}

		if (!request.status) {
			throw new ConflictException('This join request has not been confirmed by email yet.');
		}

		throw new ConflictException(`This join request was already ${String(request.status).toLowerCase()}.`);
	}

	/**
	 * Without ORG_TEAM_JOIN_REQUEST_EDIT or CHANGE_SELECTED_EMPLOYEE, only a manager of the request's team may
	 * accept or reject it. A manager is whoever ever-teams shows the invitations to: a member flagged
	 * `isManager`, a member whose team role is MANAGER (how team creation stores managers), ADMIN or
	 * SUPER_ADMIN, or the team's creator. Both entry points are guarded, so a call without a request user is
	 * an internal one and is left as it was.
	 *
	 * @param request - The join request acted on.
	 * @param tenantId - The caller's tenant, which the request was read in.
	 * @throws {ForbiddenException} When the caller does not manage the request's team.
	 */
	private async assertMayActOnRequest(request: IOrganizationTeamJoinRequest, tenantId: string): Promise<void> {
		const user = RequestContext.currentUser();
		if (!user) {
			return;
		}

		if (
			RequestContext.hasAnyPermission([
				PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT,
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			])
		) {
			return;
		}

		// TypeORM drops an undefined where value, which would widen both reads below to any team.
		const { organizationTeamId } = request;
		if (!organizationTeamId || !tenantId) {
			throw new ForbiddenException();
		}

		if (user.employeeId) {
			const member = { tenantId, organizationTeamId, employeeId: user.employeeId };
			const managesTeam = await this.typeOrmOrganizationTeamEmployeeRepository.existsBy([
				{ ...member, isManager: true },
				{ ...member, role: { name: In([RolesEnum.MANAGER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN]) } }
			]);
			if (managesTeam) {
				return;
			}
		}

		const createdTeam = await this._organizationTeamService.findOneOrFailByWhereOptions({
			id: organizationTeamId,
			tenantId,
			createdByUserId: user.id
		});
		if (!createdTeam.success) {
			throw new ForbiddenException('You can only accept or reject join requests for teams you manage.');
		}
	}
}
