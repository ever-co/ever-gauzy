import { BadRequestException, ConflictException, Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, SelectQueryBuilder, IsNull } from 'typeorm';
import { JwtPayload, sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { IAppIntegrationConfig } from '@gauzy/common';
import {
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestCreateInput,
	IOrganizationTeamJoinRequestValidateInput,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import * as moment from 'moment';
import { TenantAwareCrudService } from './../core/crud';
import { generateRandomInteger } from './../core/utils';
import { EmailService } from './../email/email.service';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamService } from './../organization-team/organization-team.service';

@Injectable()
export class OrganizationTeamJoinRequestService extends TenantAwareCrudService<OrganizationTeamJoinRequest> {
	constructor(
		@InjectRepository(OrganizationTeamJoinRequest)
		private readonly _organizationTeamJoinRequestRepository: Repository<OrganizationTeamJoinRequest>,

		private readonly _organizationTeamService: OrganizationTeamService,
		private readonly _emailService: EmailService
	) {
		super(_organizationTeamJoinRequestRepository);
	}

	/**
	 * Create organization team join request
	 *
	 * @param entity
	 * @returns
	 */
	async create(
		entity: IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>,
		languageCode?: LanguagesEnum
	): Promise<IOrganizationTeamJoinRequest> {
		const { organizationTeamId, email } = entity;

		/** find existing team join request and throw exception */
		const request = await this.repository.findOne({
			where: {
				organizationTeamId,
				email
			}
		});
		if (!!request) {
			throw new ConflictException('You have sent already join request for this team, please wait for manager response.');
		}

		/** create new team join request */
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
			const code = generateRandomInteger(6);

			const payload: JwtPayload = {
				email,
				tenantId,
				organizationId,
				organizationTeamId,
				code
			};
			/** Generate JWT token using above JWT payload */
			const token: string = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME}s`
			});

			const organizationTeamJoinRequest: IOrganizationTeamJoinRequest = await this.repository.save(
					this.repository.create({
						...entity,
						organizationId,
						tenantId,
						code,
						token,
						status: null
					})
				);

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
					appLink
				}
			);

			return organizationTeamJoinRequest;
		} catch (error) {
			throw new BadRequestException('Error while requesting join organization team', error);
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
					organizationTeamId: true
				}
			});
			query.where((qb: SelectQueryBuilder<OrganizationTeamJoinRequest>) => {
					qb.andWhere({
						email,
						organizationTeamId,
						expiredAt: MoreThanOrEqual(new Date()),
						status: IsNull()
					})
					qb.andWhere([
						{
							code
						},
						{
							token
						}
					]);
				}
			);
			const record = await query.getOneOrFail();

			await this.repository.update(record.id, {
				status: OrganizationTeamJoinRequestStatusEnum.REQUESTED,
			});

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
				relations: [
					'organizationTeam',
					'organizationTeam.organization',
				],
			});

			const code = generateRandomInteger(6);

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
			return new Object({
				status: HttpStatus.OK,
				message: `OK`,
			});
		} catch (error) {
			return new Object({
				status: HttpStatus.OK,
				message: `OK`,
			});
		}
	}
}
