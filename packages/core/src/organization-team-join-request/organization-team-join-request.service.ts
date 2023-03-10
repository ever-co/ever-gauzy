import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IOrganizationTeamJoinRequest, IOrganizationTeamJoinRequestCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { OrganizationTeam } from './../core/entities/internal';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';

@Injectable()
export class OrganizationTeamJoinRequestService extends TenantAwareCrudService<OrganizationTeamJoinRequest> {
	constructor(
		@InjectRepository(OrganizationTeamJoinRequest)
		private readonly _organizationTeamJoinRequestRepository: Repository<OrganizationTeamJoinRequest>,

		@InjectRepository(OrganizationTeam)
		private readonly _organizationTeamRepository: Repository<OrganizationTeam>
	) {
		super(_organizationTeamJoinRequestRepository);
	}

	/**
	 * Create organization team join request
	 *
	 * @param entity
	 * @returns
	 */
	async create(entity: IOrganizationTeamJoinRequestCreateInput): Promise<IOrganizationTeamJoinRequest> {
		try {
			const { organizationTeamId } = entity;
			const organizationTeam = await this._organizationTeamRepository.findOneByOrFail({
				id: organizationTeamId,
				public: true
			});

			const { organizationId, tenantId } = organizationTeam;
			return await this._organizationTeamJoinRequestRepository.save({
				...entity,
				organizationId,
				tenantId
			});
		} catch (error) {
			throw new BadRequestException('Error while requesting join organization team', error);
		}
	}
}
