import {
	BadRequestException,
	ConflictException,
	Injectable,
	HttpStatus,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	MoreThanOrEqual,
	Repository,
	SelectQueryBuilder,
	IsNull,
	FindManyOptions,
} from 'typeorm';
import { JwtPayload, sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { IAppIntegrationConfig } from '@gauzy/common';
import {
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestCreateInput,
	IOrganizationTeamJoinRequestValidateInput,
	IPagination,
	IRole,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum,
	RolesEnum,
} from '@gauzy/contracts';
import * as moment from 'moment';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { TenantAwareCrudService } from './../core/crud';
import { generateRandomAlphaNumericCode } from './../core/utils';
import { RequestContext } from './../core/context';
import { OrganizationTeamEmployee, User } from './../core/entities/internal';
import { EmailService } from './../email-send/email.service';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamService } from './../organization-team/organization-team.service';
import { InviteService } from './../invite/invite.service';
import { RoleService } from './../role/role.service';

@Injectable()
export class OrganizationTeamJoinRequestService extends TenantAwareCrudService<OrganizationTeamJoinRequest> {
	constructor(
		@InjectRepository(OrganizationTeamJoinRequest)
		private readonly _organizationTeamJoinRequestRepository: Repository<OrganizationTeamJoinRequest>,

		private readonly _organizationTeamService: OrganizationTeamService,
		private readonly _emailService: EmailService,
		private readonly _inviteService: InviteService,
		private readonly _roleService: RoleService,

		@InjectRepository(User)
		protected readonly userRepository: Repository<User>,

		@InjectRepository(OrganizationTeamEmployee)
		protected readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>
	) {
		super(_organizationTeamJoinRequestRepository);
	}

	/**
	 *
	 * @param options
	 * @returns
	 */
	public async findAll(options?: FindManyOptions<OrganizationTeamJoinRequest>): Promise<IPagination<OrganizationTeamJoinRequest>> {
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
		const { organizationTeamId, email } = entity;

		/** find existing team join request and throw exception */
		const request = await this._organizationTeamJoinRequestRepository.countBy({
			organizationTeamId,
			email
		});
		if (request > 0) {
			throw new ConflictException('You have sent already join request for this team, please wait for manager response.');
		}

		/** Create new team join request */
		try {
			const organizationTeam = await this._organizationTeamService.findOneByIdString(organizationTeamId, {
				where: {
					public: true,
				},
				relations: {
					organization: true,
				}
			});
			const { organization, organizationId, tenantId } = organizationTeam;
			const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);

			const payload: JwtPayload = {
				email,
				tenantId,
				organizationId,
				organizationTeamId,
				code
			};
			/** Generate JWT token using above JWT payload */
			const token: string = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME}s`,
			});

			/**
			 * Creates a new entity instance and copies all entity properties from this object into a new entity.
			 * Note that it copies only properties that are present in entity schema.
			*/
			const createEntityLike = this._organizationTeamJoinRequestRepository.create({
				organizationTeamId,
				email,
				organizationId,
				tenantId,
				code,
				token,
				status: null,
			});
			const organizationTeamJoinRequest = await this._organizationTeamJoinRequestRepository.save(createEntityLike);

			/** Place here organization team join request email to send verification code*/
			let { appName, appLogo, appSignature, appLink } = entity;

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
		try {
			const query = this.repository.createQueryBuilder(this.alias);
			query.setFindOptions({
				select: {
					id: true,
					email: true,
					organizationTeamId: true,
				},
			});
			query.where(
				(qb: SelectQueryBuilder<OrganizationTeamJoinRequest>) => {
					qb.andWhere({
						email,
						organizationTeamId,
						expiredAt: MoreThanOrEqual(new Date()),
						status: IsNull(),
					});
					qb.andWhere([
						{
							code,
						},
						{
							token,
						},
					]);
				}
			);
			const record = await query.getOneOrFail();

			await this.repository.update(record.id, {
				status: OrganizationTeamJoinRequestStatusEnum.REQUESTED,
			});
			delete record.id;
			return record;
		} catch (error) {
			throw new BadRequestException();
		}
	}

	async resendConfirmationCode(
		entity: IOrganizationTeamJoinRequestCreateInput &
			Partial<IAppIntegrationConfig>,
		languageCode?: LanguagesEnum
	) {
		const { organizationTeamId, email } = entity;

		try {
			/** find existing team join request */
			const request = await this.repository.findOneOrFail({
				where: {
					organizationTeamId,
					email,
					status: IsNull(),
				},
				relations: {
					organizationTeam: {
						organization: true,
					},
				},
			});

			const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);

			const payload: JwtPayload = {
				email,
				tenantId: request.tenantId,
				organizationId: request.organizationId,
				organizationTeamId,
				code,
			};
			/** Generate JWT token using above JWT payload */
			const token: string = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME}s`,
			});

			/** Update code, token and expiredAt */
			await this.repository.update(request.id, {
				code,
				token,
				expiredAt: moment(new Date())
					.add(
						environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME,
						'seconds'
					)
					.toDate(),
			});

			/** Place here organization team join request email to send verification code*/
			let { appName, appLogo, appSignature, appLink } = entity;
			this._emailService.organizationTeamJoinRequest(
				request.organizationTeam,
				{
					...request,
					code,
					token,
				},
				languageCode,
				request.organizationTeam.organization,
				{
					appName,
					appLogo,
					appSignature,
					appLink,
				}
			);
		} finally {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`,
			});
		}
	}

	async acceptRequestToJoin(
		id: string,
		action: OrganizationTeamJoinRequestStatusEnum,
		languageCode: LanguagesEnum
	) {
		const tenantId = RequestContext.currentTenantId();
		const currentUserId = RequestContext.currentUserId();

		const request = await this.repository.findOne({
			where: {
				id,
				tenantId,
			},
		});
		if (!request) {
			throw new NotFoundException('Request not found.');
		}

		/**
		 * ACCEPTED
		 */
		if (action === OrganizationTeamJoinRequestStatusEnum.ACCEPTED) {
			/**
			 * Fetch user if already present in current tenant
			 */
			let currentTenantUser: User = await this.userRepository.findOne({
				where: {
					email: request.email,
					tenantId,
				},
				relations: {
					tenant: true,
					role: true,
					employee: true,
				},
			});

			/**
			 * Accepted Case - 1
			 * Current user is already part of tenant as separate user
			 */
			if (currentTenantUser) {
				/**
				 * Check if user is already part of requested team
				 */
				let employeePresentInTeam = null;
				try {
					employeePresentInTeam =
						await this._organizationTeamService.findOneByWhereOptions(
							{
								members: {
									employeeId: currentTenantUser.employeeId,
								},
								id: request.organizationTeamId,
							}
						);
				} catch (error) { }

				/**
				 * Add employee to team
				 */
				if (!employeePresentInTeam) {
					await this.organizationTeamEmployeeRepository.save({
						employeeId: currentTenantUser.employeeId,
						organizationTeamId: request.organizationTeamId,
						tenantId,
						organizationId: request.organizationId,
					});
					await this.repository.update(id, {
						status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
						userId: currentTenantUser.id,
					});
				}
			}

			/**
			 * Accepted Case - 2
			 * Current user is not belong to this tenant
			 */
			if (!currentTenantUser) {
				const names = request?.fullName?.split(' ');

				const role: IRole = await this._roleService.findOneByWhereOptions({
					name: RolesEnum.EMPLOYEE,
				});
				const newTenantUser = await this._inviteService.createUser(
					{
						user: {
							firstName:
								(names && names.length && names[0]) || '',
							lastName: (names && names.length && names[1]) || '',
							email: request.email,
							tenantId: tenantId,
							role: role,
						},
						organizationId: request.organizationId,
						createdById: currentUserId,
					},
					request.organizationTeamId,
					languageCode
				);

				await this.repository.update(id, {
					status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
					userId: newTenantUser.id,
				});
			}
		}

		/**
		 * REJECTED
		 */
		if (action === OrganizationTeamJoinRequestStatusEnum.REJECTED) {
			await this.repository.update(id, {
				status: OrganizationTeamJoinRequestStatusEnum.REJECTED,
			});
		}
	}
}
