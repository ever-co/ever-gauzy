import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, UpdateResult } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import {
	OrganizationTeamCreateInput as IOrganizationTeamCreateInput,
	OrganizationTeams as IOrganizationTeams
} from '@gauzy/models';
import { Employee } from '../employee';
import { IPagination } from '../core';
import { User } from '../user';
import { OrganizationTeams } from './organization-teams.entity';

@Injectable()
export class OrganizationTeamsService extends CrudService<OrganizationTeams> {
	constructor(
		@InjectRepository(OrganizationTeams)
		private readonly organizationTeamsRepository: Repository<
			OrganizationTeams
		>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {
		super(organizationTeamsRepository);
	}

	async createOrgTeam(
		entity: IOrganizationTeamCreateInput
	): Promise<OrganizationTeams> {
		const organizationTeam = new OrganizationTeams();
		organizationTeam.name = entity.name;
		organizationTeam.organizationId = entity.organizationId;

		const employees = await this.employeeRepository.findByIds(
			entity.members,
			{
				relations: ['user']
			}
		);

		organizationTeam.members = employees;

		return this.organizationTeamsRepository.save(organizationTeam);
	}

	async updateOrgTeam(
		id: string,
		entity: IOrganizationTeams
	): Promise<UpdateResult> {
		try {
			console.log('ID =>>>>', id);

			for (const [i, member] of entity.members.entries()) {
				entity.members[i] = await this.employeeRepository.findOne(
					member.id,
					{
						relations: ['user']
					}
				);
			}

			// console.log('ENTITY =>>>>', entity);

			return await this.organizationTeamsRepository.update(id, entity);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}

	async getAllOrgTeams(
		filter: FindManyOptions<OrganizationTeams>
	): Promise<IPagination<IOrganizationTeams>> {
		const total = await this.organizationTeamsRepository.count(filter);

		const items = await this.organizationTeamsRepository.find(filter);

		for (const orgTeams of items) {
			for (const emp of orgTeams.members) {
				emp.user = await this.userRepository.findOne(emp.userId);
			}
		}

		return { items, total };
	}
}
