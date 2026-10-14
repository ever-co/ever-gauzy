import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { IGetConflictTimeLogCommand } from '../get-conflict-time-log.command';
import { RequestContext } from './../../../../core/context';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from '../../repository/mikro-orm-time-log.repository';
import { MultiORM, MultiORMEnum, getORMType, wrapSerialize } from './../../../../core/utils';

/**
 * SQL condition: the time log under `alias` overlaps the [startedAt, stoppedAt) range.
 *
 * PostgreSQL uses `OVERLAPS`. The SQLite condition only checked that the new start fell inside an existing
 * log, and the MySQL one that an existing log lay entirely inside the new range, so a log covering the new
 * range, or overlapping one of its ends, was not reported as a conflict and the time was counted twice.
 * Both now use the same half-open overlap test as `OVERLAPS`.
 */
export function overlapCondition(
	dbType: DatabaseTypeEnum,
	alias: string,
	startedAt: string,
	stoppedAt: string
): string {
	switch (dbType) {
		case DatabaseTypeEnum.postgres:
			return `("${alias}"."startedAt", "${alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`;
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			// Compared as dates: SQLite stores 'YYYY-MM-DD HH:MM:SS.SSS', and as text that sorts before the ISO
			// bounds ('T' > ' ') of the same day, so a plain string comparison missed most overlapping logs
			return `julianday("${alias}"."startedAt") < julianday('${stoppedAt}') AND julianday("${alias}"."stoppedAt") > julianday('${startedAt}')`;
		case DatabaseTypeEnum.mysql:
			// Quoted for the `dbType` given, not for the process-wide database `p()` reads
			return `\`${alias}\`.\`startedAt\` < '${stoppedAt}' AND \`${alias}\`.\`stoppedAt\` > '${startedAt}'`;
		default:
			throw new Error(`cannot get conflict time log due to unsupported database type: ${dbType}`);
	}
}

@CommandHandler(IGetConflictTimeLogCommand)
export class GetConflictTimeLogHandler implements ICommandHandler<IGetConflictTimeLogCommand> {
	protected ormType: MultiORM = getORMType();

	constructor(
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		private readonly configService: ConfigService
	) {}

	public async execute(command: IGetConflictTimeLogCommand): Promise<TimeLog[]> {
		const { input } = command;

		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { employeeId, organizationId } = input;

		const startedAt = moment.utc(input.startDate).toISOString();
		const stoppedAt = moment.utc(input.endDate).toISOString();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmTimeLogRepository.getKnex();
				let subQuery = knex('time_log').withSchema(knex.userParams.schema).as('time_log').select('time_log.id');

				const overlapQuery = overlapCondition(
					this.configService.dbConnectionOptions.type as DatabaseTypeEnum,
					'time_log',
					startedAt,
					stoppedAt
				);

				subQuery = subQuery
					.where('time_log.employeeId', employeeId)
					.where('time_log.tenantId', tenantId)
					.where('time_log.organizationId', organizationId)
					.whereRaw(overlapQuery);

				if (input.ignoreId) {
					subQuery = subQuery.whereNotIn(
						'time_log.id',
						input.ignoreId instanceof Array ? input.ignoreId : [input.ignoreId]
					);
				}

				const results = await subQuery;
				const ids = results.map((r) => r.id);

				if (ids.length === 0) {
					return [];
				}

				const items = await this.mikroOrmTimeLogRepository.find(
					{ id: { $in: ids } },
					{
						populate: [...new Set([...(input.relations || []), 'timeSlots'])] as any
					}
				);
				return items.map((item) => wrapSerialize(item)) as TimeLog[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				let conflictQuery = this.typeOrmTimeLogRepository.createQueryBuilder();

				const query = overlapCondition(
					this.configService.dbConnectionOptions.type as DatabaseTypeEnum,
					conflictQuery.alias,
					startedAt,
					stoppedAt
				);
				conflictQuery = conflictQuery
					.innerJoinAndSelect(`${conflictQuery.alias}.timeSlots`, 'timeSlots')
					.where(p(`"${conflictQuery.alias}"."employeeId" = :employeeId`), { employeeId })
					.andWhere(p(`"${conflictQuery.alias}"."tenantId" = :tenantId`), { tenantId })
					.andWhere(p(`"${conflictQuery.alias}"."organizationId" = :organizationId`), { organizationId })
					.andWhere(query);
				if (input.relations) {
					input.relations.forEach((relation) => {
						conflictQuery = conflictQuery.leftJoinAndSelect(`${conflictQuery.alias}.${relation}`, relation);
					});
				}
				if (input.ignoreId) {
					conflictQuery = conflictQuery.andWhere(`${conflictQuery.alias}.id NOT IN (:...id)`, {
						id: input.ignoreId instanceof Array ? input.ignoreId : [input.ignoreId]
					});
				}
				return await conflictQuery.getMany();
			}
		}
	}
}
