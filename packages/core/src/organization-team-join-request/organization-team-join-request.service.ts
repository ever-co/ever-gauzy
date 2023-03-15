import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
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
				}
			});
			const { organizationId, tenantId } = organizationTeam;
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

			const request = await this.repository.save(
				this.repository.create({
					...entity,
					organizationId,
					tenantId,
					code,
					token,
					status: OrganizationTeamJoinRequestStatusEnum.REQUESTED
				})
			);
			/** Place here organization team join request email to send verification code*/
			return request;
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
		const { email, code, token, organizationTeamId } = options;
		try {
			const query = this.repository.createQueryBuilder(this.alias);
			query.setFindOptions({
				select: {
					email: true,
					organizationTeamId: true
				}
			});
			query.where((qb: SelectQueryBuilder<OrganizationTeamJoinRequest>) => {
				qb.andWhere({
					email,
					organizationTeamId,
					expiredAt: MoreThanOrEqual(new Date()),
					status: OrganizationTeamJoinRequestStatusEnum.REQUESTED
				})
				qb.andWhere([
					{
						code
					},
					{
						token
					}
				]);
			});
			return await query.getOneOrFail();
		} catch (error) {
			throw new BadRequestException();
		}
	}
}
