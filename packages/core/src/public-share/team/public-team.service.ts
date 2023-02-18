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
		options: FindOptionsWhere<OrganizationTeam>,
		relations: string[]
	): Promise<IOrganizationTeam> {
		try {
			return await this.repository.findOneOrFail({
				where: {
					public: true,
					...options
				},
				...(
					(relations) ? {
						relations: relations
					} : {}
				),
			});
		} catch (error) {
			throw new NotFoundException();
		}
	}
}
