import { IOrganizationTeam } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OrganizationTeam } from './../../core/entities/internal';

@Injectable()
export class PublicTeamService {

	constructor(
		@InjectRepository(OrganizationTeam)
		private readonly repository: Repository<OrganizationTeam>,
	) { }

	/**
	 * GET organization team by profile link
	 *
	 * @param options
	 * @param relations
	 * @returns
	 */
	async findOneByProfileLink(
		where: FindOptionsWhere<OrganizationTeam>,
		relations: string[]
	): Promise<IOrganizationTeam> {
		try {
			return await this.repository.findOneOrFail({
				where,
				relations
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
