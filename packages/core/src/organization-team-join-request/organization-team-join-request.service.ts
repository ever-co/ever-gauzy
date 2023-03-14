import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import {
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestCreateInput,
	IOrganizationTeamJoinRequestValidateInput,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum
} from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { generateRandomInteger } from './../core/utils';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamService } from './../organization-team/organization-team.service';

@Injectable()
export class OrganizationTeamJoinRequestService extends TenantAwareCrudService<OrganizationTeamJoinRequest> {
	constructor(
		@InjectRepository(OrganizationTeamJoinRequest)
		private readonly _organizationTeamJoinRequestRepository: Repository<OrganizationTeamJoinRequest>,

		private readonly organizationTeamService: OrganizationTeamService,
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
			const organizationTeam = await this.organizationTeamService.findOneByIdString(organizationTeamId, {
				where: {
					public: true
				}
			});

			const otp = generateRandomInteger(6);
			const { organizationId, tenantId } = organizationTeam;

			return await this.repository.save(
				this.repository.create({
					...entity,
					organizationId,
					tenantId,
					code: otp,
					status: OrganizationTeamJoinRequestStatusEnum.REQUESTED
				})
			);
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
