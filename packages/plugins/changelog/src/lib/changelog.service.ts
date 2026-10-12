import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IChangelog, IPagination } from '@gauzy/contracts';
import { CrudService } from '@gauzy/core';
import { Changelog } from './changelog.entity';
import { TypeOrmChangelogRepository } from './repository/type-orm-changelog.repository';
import { MikroOrmChangelogRepository } from './repository/mikro-orm-changelog.repository';

@Injectable()
export class ChangelogService extends CrudService<Changelog> {
	/**
	 * Upper bound for the public listing. The endpoint is unauthenticated and
	 * the consumers (What's New sidebar, login/register panels) only ever show
	 * a handful of entries, so an unbounded SELECT is all downside.
	 */
	private static readonly MAX_PUBLIC_ITEMS = 20;

	constructor(
		typeOrmChangelogRepository: TypeOrmChangelogRepository,
		mikroOrmChangelogRepository: MikroOrmChangelogRepository
	) {
		super(typeOrmChangelogRepository, mikroOrmChangelogRepository);
	}

	/**
	 * GET changelog entries for the public consumers, newest first.
	 *
	 * Ordering lives here, not in the clients: the seeded rows all share one
	 * creation date, so without `date DESC` the display order was whatever the
	 * database felt like returning.
	 *
	 * @param where filter (e.g. `{ isFeature: true }`), already validated/whitelisted by the controller
	 * @returns
	 */
	public async findAllChangelogs(where?: FindOptionsWhere<Changelog>): Promise<IPagination<IChangelog>> {
		// An absent query param can still surface as an `undefined`-valued key,
		// which TypeORM must never see in a `where`.
		const filter = Object.fromEntries(
			Object.entries(where ?? {}).filter(([, value]) => value !== undefined)
		) as FindOptionsWhere<Changelog>;
		return await this.findAll({
			...(Object.keys(filter).length ? { where: filter } : {}),
			order: { date: 'DESC', createdAt: 'DESC' },
			take: ChangelogService.MAX_PUBLIC_ITEMS
		});
	}
}
