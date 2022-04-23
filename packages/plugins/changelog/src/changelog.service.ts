import { IChangelog, IPagination } from '@gauzy/contracts';
import { CrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { Changelog } from './changelog.entity';

@Injectable()
export class ChangelogService extends CrudService<Changelog> {
	constructor(
		@InjectRepository(Changelog)
		protected readonly changelogRepository: Repository<Changelog>
	) {
		super(changelogRepository);
	}

	/**
	 * GET all changelogs based on filter condition
	 * 
	 * @param filter 
	 * @returns 
	 */
	public async findAllChangelogs(
		filter?: FindManyOptions<Changelog>,
	): Promise<IPagination<IChangelog>> {
		return await this.findAll(filter || {});
	}
}
