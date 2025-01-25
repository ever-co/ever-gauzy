import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { IChangelog, IPagination } from '@gauzy/contracts';
import { CrudService } from '@gauzy/core';
import { Changelog } from './changelog.entity';
import { TypeOrmChangelogRepository } from './repository/type-orm-changelog.repository';
import { MikroOrmChangelogRepository } from './repository/mikro-orm-changelog.repository';

@Injectable()
export class ChangelogService extends CrudService<Changelog> {
	constructor(
		typeOrmChangelogRepository: TypeOrmChangelogRepository,
		mikroOrmChangelogRepository: MikroOrmChangelogRepository
	) {
		super(typeOrmChangelogRepository, mikroOrmChangelogRepository);
	}

	/**
	 * GET all changelogs based on filter condition
	 *
	 * @param filter
	 * @returns
	 */
	public async findAllChangelogs(filter?: FindManyOptions<Changelog>): Promise<IPagination<IChangelog>> {
		return await this.findAll(filter || {});
	}
}
