import { Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	IActivityLog,
	ID,
	IPagination,
	PermissionsEnum,
	TimeLogChangeKindEnum
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { TimeLog } from './time-log.entity';
import { TIME_LOG_KIND_FIELDS } from './time-log-history';
import { TimeLogService } from './time-log.service';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogHistoryQueryDTO } from './dto/query/time-log-history-query.dto';

/** The page size of a period read when the request names none. */
const DEFAULT_TAKE = 100;

/**
 * Reads the history of time entries (activity log rows whose entity is `TimeLog`) under the time scoping: a member
 * reads the history of their own entries, people who manage a member or may see everyone's time read theirs, and
 * nobody else. Reads go through TypeORM, which both ORMs initialise; the rows are written through it too.
 */
@Injectable()
export class TimeLogHistoryService {
	constructor(
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly timeLogService: TimeLogService,
		private readonly managedEmployeeService: ManagedEmployeeService
	) {}

	/**
	 * The history of one entry of an organization, newest first. The entry may be deleted: a soft-deleted one is still
	 * found, and a hard-deleted one is known by the owner its rows keep. An entry of another organization is not found,
	 * whatever the caller may read there.
	 *
	 * @param id The entry.
	 * @param organizationId The organization the read is made in, one of the caller's (the route checks it).
	 * @throws NotFoundException When the organization has no such entry and no history for it.
	 * @throws ForbiddenException When the caller may not read the owner's time.
	 */
	async findEntryHistory(id: ID, organizationId: ID): Promise<IActivityLog[]> {
		const tenantId = RequestContext.currentTenantId();
		const manager = this.typeOrmTimeLogRepository.manager;
		const entry = await manager.findOne(TimeLog, {
			where: { id, tenantId, organizationId },
			select: { id: true, employeeId: true },
			withDeleted: true
		});
		const rows = await manager.find(ActivityLog, {
			where: { entity: BaseEntityEnum.TimeLog, entityId: id, tenantId, organizationId },
			order: { createdAt: 'DESC' }
		});
		const ownerKeptInRows = (rows[0]?.data as { employeeId?: ID } | undefined)?.employeeId;
		const ownerId = entry?.employeeId ?? ownerKeptInRows;
		if (!ownerId) {
			throw new NotFoundException('The time entry was not found');
		}
		await this.timeLogService.assertCanReadEmployeeTimeLogs(ownerId);
		return rows;
	}

	/**
	 * The changes recorded over a period on the entries of the members the caller may read, newest first, optionally
	 * of some members and some kinds. The rows of an entry deleted for good (`forceDelete`) are kept, read by the owner
	 * they keep, as the history of that entry is.
	 *
	 * @param query The period, members, kinds and page.
	 */
	async findPeriodHistory(query: TimeLogHistoryQueryDTO): Promise<IPagination<IActivityLog>> {
		const tenantId = RequestContext.currentTenantId();
		const employeeIds = await this.readableEmployeeIds(query.employeeIds);
		const readsNobody = Array.isArray(employeeIds) && employeeIds.length === 0;
		if (readsNobody) {
			return { items: [], total: 0 };
		}

		const take = query.take ?? DEFAULT_TAKE;
		const page = query.skip ?? 1;
		const builder = this.typeOrmTimeLogRepository.manager
			.createQueryBuilder(ActivityLog, 'history')
			.withDeleted()
			// A left join: the entry of a row may have been deleted for good.
			.leftJoin(TimeLog, 'entry', entryJoinCondition())
			.where(p(`"history"."entity" = :entity`), { entity: BaseEntityEnum.TimeLog })
			.andWhere(p(`"history"."deletedAt" IS NULL`))
			.andWhere(p(`"history"."tenantId" = :tenantId`), { tenantId })
			.andWhere(p(`"history"."organizationId" = :organizationId`), { organizationId: query.organizationId })
			.andWhere(p(`"history"."createdAt" BETWEEN :startDate AND :endDate`), {
				startDate: new Date(query.startDate),
				endDate: new Date(query.endDate)
			});
		if (employeeIds) {
			builder.andWhere(new Brackets((owner) => this.whereOwnerIn(owner, employeeIds)));
		}
		if (query.kinds?.length) {
			builder.andWhere(new Brackets((kinds) => this.whereKinds(kinds, query.kinds)));
		}
		builder
			.orderBy('history.createdAt', 'DESC')
			// Rows recorded at the same moment keep one order from page to page.
			.addOrderBy('history.id', 'DESC')
			.skip(take * (page - 1))
			.take(take);

		const [items, total] = await builder.getManyAndCount();
		return { items, total };
	}

	/**
	 * The members whose entries' history the caller may read: `undefined` for everyone of the organization (a caller
	 * who may see every member's time and names none), else a list, empty when the caller reads nobody's.
	 *
	 * Follows the time logs' own list: a caller who may not see everyone's time reads their own entries, and the
	 * members they ask for when they manage every one of them.
	 *
	 * @param requested The members the request names.
	 */
	async readableEmployeeIds(requested: ID[] | undefined): Promise<ID[] | undefined> {
		const namesSome = Array.isArray(requested) && requested.length > 0;
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			if (namesSome) {
				return requested;
			}
			return undefined;
		}
		const ownEmployeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
		if (!ownEmployeeId) {
			return [];
		}
		if (!namesSome) {
			return [ownEmployeeId];
		}
		const others = requested.filter((employeeId) => String(employeeId) !== String(ownEmployeeId));
		const managesThemAll =
			others.length === 0 || (await this.managedEmployeeService.canManageEmployees(others, []));
		if (managesThemAll) {
			return requested;
		}
		return [ownEmployeeId];
	}

	/** The members' rows: by the entry's owner, or by the owner the rows keep once the entry is deleted for good. */
	private whereOwnerIn(builder: WhereExpressionBuilder, employeeIds: ID[]): void {
		builder.where(p(`"entry"."employeeId" IN (:...employeeIds)`), { employeeIds }).orWhere(
			new Brackets((deleted) => {
				deleted
					.where(p(`"entry"."id" IS NULL`))
					.andWhere(`${keptOwner()} IN (:...employeeIds)`, { employeeIds });
			})
		);
	}

	/** One condition per kind asked, joined by OR. */
	private whereKinds(builder: WhereExpressionBuilder, kinds: TimeLogChangeKindEnum[]): void {
		let parameterIndex = 0;
		for (const kind of kinds) {
			if (kind === TimeLogChangeKindEnum.CREATED) {
				builder.orWhere(p(`"history"."action" = :created`), { created: ActionTypeEnum.Created });
				continue;
			}
			if (kind === TimeLogChangeKindEnum.DELETED) {
				builder.orWhere(p(`"history"."action" = :deleted`), { deleted: ActionTypeEnum.Deleted });
				continue;
			}
			for (const field of TIME_LOG_KIND_FIELDS[kind] ?? []) {
				const name = `kindField${parameterIndex}`;
				parameterIndex++;
				builder.orWhere(
					new Brackets((updated) => {
						updated
							.where(p(`"history"."action" = :updatedAction`), { updatedAction: ActionTypeEnum.Updated })
							.andWhere(`${updatedFieldsAsText()} LIKE :${name}`, { [name]: `%"${field}"%` });
					})
				);
			}
		}
	}
}

/**
 * The join of a history row to its entry. `activity_log.entityId` is a varchar and `time_log.id` a uuid on
 * PostgreSQL, so the id is compared as text there, as the request approvals join their requests.
 */
function entryJoinCondition(): string {
	if (isPostgres()) {
		return `"entry"."id"::"varchar" = "history"."entityId"`;
	}
	if (isMySQL()) {
		return p(
			`CAST("entry"."id" AS CHAR) COLLATE utf8mb4_unicode_ci = "history"."entityId" COLLATE utf8mb4_unicode_ci`
		);
	}
	return `"entry"."id" = "history"."entityId"`;
}

/** The owner a history row keeps (`data.employeeId`), on each database (jsonb, json, or text holding JSON). */
function keptOwner(): string {
	if (isPostgres()) {
		return `"history"."data"->>'employeeId'`;
	}
	if (isMySQL()) {
		return "JSON_UNQUOTE(JSON_EXTRACT(`history`.`data`, '$.employeeId'))";
	}
	return `json_extract("history"."data", '$.employeeId')`;
}

/** The `updatedFields` column as text, on each database (jsonb on PostgreSQL, json on MySQL, text on SQLite). */
function updatedFieldsAsText(): string {
	if (isPostgres()) {
		return `CAST("history"."updatedFields" AS TEXT)`;
	}
	if (isMySQL()) {
		return 'CAST(`history`.`updatedFields` AS CHAR)';
	}
	return `"history"."updatedFields"`;
}
