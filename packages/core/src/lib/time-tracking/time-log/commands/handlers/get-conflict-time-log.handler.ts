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

				let overlapQuery: string = '';
				switch (this.configService.dbConnectionOptions.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						overlapQuery = `'${startedAt}' >= "time_log"."startedAt" and '${startedAt}' <= "time_log"."stoppedAt"`;
						break;
					case DatabaseTypeEnum.postgres:
						overlapQuery = `("time_log"."startedAt", "time_log"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`;
						break;
					case DatabaseTypeEnum.mysql:
						overlapQuery = p(
							`"time_log"."startedAt" BETWEEN '${startedAt}' AND '${stoppedAt}' AND "time_log"."stoppedAt" BETWEEN '${startedAt}' AND '${stoppedAt}'`
						);
						break;
					default:
						throw Error(
							`cannot get conflict time log due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
						);
				}

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
						populate: (input.relations || ['timeSlots']) as any
					}
				);
				return items.map((item) => wrapSerialize(item)) as TimeLog[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				let conflictQuery = this.typeOrmTimeLogRepository.createQueryBuilder();

				let query: string = ``;
				switch (this.configService.dbConnectionOptions.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						query = `'${startedAt}' >= "${conflictQuery.alias}"."startedAt" and '${startedAt}' <= "${conflictQuery.alias}"."stoppedAt"`;
						break;
					case DatabaseTypeEnum.postgres:
						query = `("${conflictQuery.alias}"."startedAt", "${conflictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`;
						break;
					case DatabaseTypeEnum.mysql:
						query = p(
							`"${conflictQuery.alias}"."startedAt" BETWEEN '${startedAt}' AND '${stoppedAt}' AND "${conflictQuery.alias}"."stoppedAt" BETWEEN '${startedAt}' AND '${stoppedAt}'`
						);
						break;
					default:
						throw Error(
							`cannot get conflict time log due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
						);
				}
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
