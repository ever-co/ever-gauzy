import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LockMode, raw } from '@mikro-orm/core';
import type { Collection, EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { Brackets, EntityManager, FindManyOptions, In } from 'typeorm';
import { isUUID } from 'class-validator';
import {
	ApprovalPolicyTypesStringEnum,
	IRequestApproval,
	RequestApprovalStatusTypesEnum,
	IRequestApprovalCreateInput,
	IRequestApprovalFindInput,
	IPagination,
	IRequestApprovalEmployee,
	IOrganizationTeam,
	IEmployee,
	IRequestApprovalTeam,
	ID,
	RolesEnum,
	StatusTypesEnum
} from '@gauzy/contracts';
import { isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { RequestContext } from '../core/context';
import {
	EquipmentSharing,
	OrganizationTeamEmployee,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	TimeOffRequest
} from './../core/entities/internal';
import { TenantAwareCrudService } from './../core/crud';
import { redactDatabaseError, toClientSafeError } from './../core/errors/database-error';
import { isWithinOrganizationBoundary } from './../core/crud/organization-boundary';
import { assertSensitiveRelationsAllowed } from './../core/util/sensitive-relations.helper';
import { MultiORMEnum, flatten, parseFindOptionsRelations } from './../core/utils';
import { RequestApproval } from './request-approval.entity';
import { MikroOrmRequestApprovalRepository } from './repository/mikro-orm-request-approval.repository';
import { TypeOrmRequestApprovalRepository } from './repository/type-orm-request-approval.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmOrganizationTeamRepository } from '../organization-team/repository/type-orm-organization-team.repository';
import { MikroOrmOrganizationTeamRepository } from '../organization-team/repository/mikro-orm-organization-team.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/mikro-orm-organization-team-employee.repository';
import {
	TimeOffBalanceDeductionService,
	TimeOffBalanceLeave
} from '../time-off-balance/time-off-balance-deduction.service';
import {
	ITimeOffBalanceLedger,
	mikroOrmTimeOffBalanceLedger,
	typeOrmTimeOffBalanceLedger
} from '../time-off-balance/time-off-balance-ledger';
import {
	answerRequestApproval,
	IEmployeeApproverSlot,
	IRequestApprovalAnswerOutcome,
	IRequestApprovalRequestedFor,
	isDecidedRequestApprovalStatus,
	ITeamApproverSlot,
	RequestApprovalVerdict
} from './request-approval-decision';

/** The two kinds of document a request approval moves when it is decided. */
export type RequestApprovalLinkedDocumentKind = 'time-off' | 'equipment-sharing';

/** A time-off request or an equipment sharing, as far as moving it goes. */
export interface IRequestApprovalLinkedDocument {
	id: ID;
	organizationId?: ID | null;
	status?: string | number | null;
}

/**
 * The reads and writes of one answer to a request approval, all made on one transaction: see
 * {@link RequestApprovalService.answer}.
 *
 * Every member runs on the transaction's own connection, so nothing the answer writes is visible to anybody else
 * before it commits, and a failure anywhere — a refusal, the linked document's conflict, a lost connection — leaves
 * the request, its slots and the document as they were. Nothing inside the transaction reads through another
 * connection either: on PostgreSQL and MySQL that would hold one pooled connection while waiting for a second, and
 * a burst of answers as large as the pool would wait for each other for good.
 */
export interface IRequestApprovalAnswerTransaction {
	/**
	 * Reads the request again, inside the tenant, holding its row until the transaction ends: `SELECT … FOR UPDATE`
	 * on PostgreSQL and MySQL. On SQLite there are no row locks and the transaction itself is serialized (see
	 * {@link RequestApprovalService.answer}).
	 *
	 * @returns The request, with its `organizationId` as stored, or null when it is no longer there (or no tenant is
	 * known).
	 */
	lockRequest(id: ID, tenantId: ID): Promise<RequestApproval | null>;
	/**
	 * The request's approver slots, read after the lock, so they carry every answer committed before it was granted
	 * (on PostgreSQL every statement reads what is committed; on MySQL the snapshot of a transaction's plain reads is
	 * taken at its first one, which comes after the locking read).
	 */
	readSlots(
		requestApprovalId: ID,
		tenantId: ID
	): Promise<{ employeeApprovals: IEmployeeApproverSlot[]; teamApprovals: ITeamApproverSlot[] }>;
	/** The teams, among `teamIds`, the employee is an active member of, inside the tenant. */
	readApproverTeams(employeeId: ID, teamIds: ID[], tenantId: ID): Promise<ID[]>;
	/**
	 * Records the answer on the slots named, inside the tenant, with the user who answered as the slot's
	 * `updatedByUserId`: who an approval recorded there counts for when `min_count` is counted (one person counts
	 * once, see `request-approval-decision.ts`).
	 *
	 * @param answeredByUserId The answering user; omitted, the slot's audit stamp is left to the ORM.
	 */
	writeSlots(
		kind: 'employee' | 'team',
		ids: ID[],
		tenantId: ID,
		status: number,
		answeredByUserId?: ID | null
	): Promise<void>;
	/**
	 * Who the document a request is about was filed by (its `createdByUserId`) and is for (its employees, and — for an
	 * equipment sharing — the active members of the teams it is for), inside the tenant (withdrawn rows left out): none
	 * of them answers the request as an approver. Empty when the document is not there.
	 *
	 * Read after the request's row lock: the in-place edit of an equipment sharing and the `POST /equipment-sharing`
	 * upsert of a stored one, which can change the employees and the teams it is for, take that same lock before they
	 * write (`EquipmentSharingService.updateInPlace` / `storeCreate`), so the edit and the answer run one after the
	 * other and the answer reads the memberships as they stand when it decides.
	 *
	 * Required, so a transaction cannot leave the check out by omission: it would answer as if the document named
	 * nobody, and re-open self-approval through a team slot.
	 */
	readLinkedDocumentRequesters(
		kind: RequestApprovalLinkedDocumentKind,
		id: ID,
		tenantId: ID
	): Promise<IRequestApprovalRequestedFor>;
	/** Writes the request's own status, inside the tenant. */
	writeRequestStatus(id: ID, tenantId: ID, status: number): Promise<void>;
	/**
	 * Reads the document a request is about, inside the tenant (withdrawn rows left out), or null.
	 *
	 * `locked` reads it under a row lock (`FOR UPDATE` on PostgreSQL and MySQL), which reads the version committed
	 * now. A plain read on MySQL (REPEATABLE READ) answers from the transaction's snapshot, taken at its first plain
	 * read: a change committed since, such as the time-off route deciding the leave, is not seen there.
	 *
	 * @param locked Read the row's current version under a row lock rather than the transaction's snapshot.
	 */
	readLinkedDocument(
		kind: RequestApprovalLinkedDocumentKind,
		id: ID,
		tenantId: ID,
		locked?: boolean
	): Promise<IRequestApprovalLinkedDocument | null>;
	/**
	 * Moves a time-off request that is still `REQUESTED` to the status given — a compare-and-set, so a leave its own
	 * route decided in the meantime is not overwritten.
	 *
	 * A leave that moves takes its leave balance with it, on this transaction, through the service the time-off
	 * route decides with (`TimeOffBalanceDeductionService`, ever-co/ever-gauzy#10183): approving it takes its working
	 * days from its employees' balances, and a policy that requires sufficient balance refuses (400) an approval its
	 * balances cannot cover, which rolls the whole answer back. A leave that does not move (decided through its own
	 * route, which settled its balance then) moves no balance.
	 *
	 * @returns How many rows moved: 0 when the leave is no longer `REQUESTED` (or not there).
	 * @throws BadRequestException when the leave's policy requires sufficient balance and its balances cannot cover it.
	 */
	moveTimeOff(id: ID, tenantId: ID, status: StatusTypesEnum): Promise<number>;
	/** Writes an equipment sharing's status, inside the tenant. */
	moveEquipmentSharing(id: ID, tenantId: ID, status: number): Promise<void>;
}

/**
 * The statements of one edit of a request approval, all made on one transaction: see
 * {@link RequestApprovalService.updateRequestApproval}.
 */
export interface IRequestApprovalEditTransaction {
	/** The request again, inside the tenant, under its row lock: the answer's own read (see its contract). */
	lockRequest: IRequestApprovalAnswerTransaction['lockRequest'];
	/** Removes the request's approver slots, of both kinds; the edit files them again. */
	deleteSlots(requestApprovalId: ID): Promise<void>;
	/** Saves the request, with the slots the edit files, as the CRUD base's `save()` saves it. */
	saveRequest(requestApproval: RequestApproval): Promise<RequestApproval>;
	/** Writes the request's own status, inside the tenant: the answer's own write. */
	writeRequestStatus: IRequestApprovalAnswerTransaction['writeRequestStatus'];
}

/**
 * What a decision that settles a request hands the code that moves the document it is about: see
 * {@link RequestApprovalService.answer}.
 */
export interface IRequestApprovalSettlement {
	/** The request, as the locked read found it, with the answer applied. */
	requestApproval: RequestApproval;
	/** What the answer did; `outcome.status` is the decision the document follows. */
	outcome: IRequestApprovalAnswerOutcome;
	/** The answer's transaction: the document is moved on it, in the same commit as the answer. */
	transaction: IRequestApprovalAnswerTransaction;
}

/**
 * The ids of the rows of a to-many relation, as either ORM loads it: an array under TypeORM, a collection under
 * MikroORM, read only once it is loaded (one that was not loaded names nobody rather than throwing).
 *
 * @param relation The relation's value on the row.
 */
function loadedRelationIds(relation: unknown): ID[] {
	const collection = relation as { getItems?: () => unknown[]; isInitialized?: () => boolean } | null | undefined;
	const rows: any[] = Array.isArray(relation)
		? relation
		: typeof collection?.getItems === 'function' &&
		  (typeof collection.isInitialized !== 'function' || collection.isInitialized())
		? collection.getItems()
		: [];
	return rows.map((row) => row?.id).filter((id): id is ID => !!id);
}

/**
 * Who a time-off request or an equipment sharing was filed by and is for, as either ORM reads it: its
 * `createdByUserId` (under MikroORM the mirror is `persist: false` and may be left unhydrated, so the key of the
 * `createdByUser` relation is read too) and the ids of its employees (an array under TypeORM, a collection under
 * MikroORM, read only once it is loaded) — together with the active members of the teams it is for, which the caller
 * reads ({@link teamIdsOfDocument}, then {@link typeOrmActiveTeamMemberIds} / {@link mikroOrmActiveTeamMemberIds}).
 *
 * @param row The document, or null when it is not there.
 * @param teamMemberIds The employees who are active members of the teams the document is for (an equipment sharing's
 * `teams`): the sharing is for them as much as for the employees it names.
 */
export function requestersOfDocument(
	row: unknown,
	teamMemberIds: ReadonlyArray<ID | null | undefined> = []
): IRequestApprovalRequestedFor {
	if (!row || typeof row !== 'object') {
		return { userIds: [], employeeIds: [] };
	}
	const document = row as Record<string, any>;
	const filer: ID | null = document.createdByUserId ?? document.createdByUser?.id ?? null;
	const employeeIds = [...loadedRelationIds(document.employees), ...teamMemberIds.filter((id): id is ID => !!id)];

	return {
		userIds: filer ? [filer] : [],
		employeeIds: employeeIds.filter((id, index) => employeeIds.indexOf(id) === index)
	};
}

/**
 * The teams a document is for: an equipment sharing's `teams`, as either ORM loads them (a time-off request has
 * none). Their active members are among the people the document is for (see {@link requestersOfDocument}).
 *
 * @param row The document, or null when it is not there.
 */
export function teamIdsOfDocument(row: unknown): ID[] {
	return row && typeof row === 'object' ? loadedRelationIds((row as Record<string, unknown>)['teams']) : [];
}

/**
 * The employees who are active members of the teams named, inside the tenant, read on a TypeORM transaction's
 * manager: the same membership an approver team is answered through (`readApproverTeams`). No team, no read.
 *
 * Team membership is not part of the document and is not locked: it is read as committed when the requester check
 * runs, after the request approval's row lock.
 *
 * @param manager The transaction's manager.
 * @param teamIds The teams the document is for.
 * @param tenantId The caller's tenant.
 */
export async function typeOrmActiveTeamMemberIds(
	manager: EntityManager,
	teamIds: ReadonlyArray<ID>,
	tenantId: ID
): Promise<ID[]> {
	if (!teamIds.length || !tenantId) {
		return [];
	}
	const memberships = await manager.find(OrganizationTeamEmployee, {
		where: { organizationTeamId: In([...teamIds]), tenantId, isActive: true }
	});
	return memberships.map((membership) => membership.employeeId).filter((id): id is ID => !!id);
}

/**
 * The MikroORM form of {@link typeOrmActiveTeamMemberIds}: on the transaction's fork, from the table rather than the
 * identity map the fork inherited.
 *
 * @param em The transaction's entity manager.
 * @param teamIds The teams the document is for.
 * @param tenantId The caller's tenant.
 */
export async function mikroOrmActiveTeamMemberIds(
	em: MikroOrmEntityManager,
	teamIds: ReadonlyArray<ID>,
	tenantId: ID
): Promise<ID[]> {
	if (!teamIds.length || !tenantId) {
		return [];
	}
	const memberships = (await em.find(
		OrganizationTeamEmployee,
		{ organizationTeamId: { $in: [...teamIds] }, tenantId, isActive: true } as any,
		{ disableIdentityMap: true } as any
	)) as any[];
	return memberships
		.map((membership) => membership.employee?.id ?? membership.employeeId)
		.filter((id): id is ID => !!id);
}

@Injectable()
export class RequestApprovalService extends TenantAwareCrudService<RequestApproval> {
	constructor(
		readonly typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,
		readonly mikroOrmRequestApprovalRepository: MikroOrmRequestApprovalRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		readonly mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository,
		readonly typeOrmOrganizationTeamEmployeeRepository?: TypeOrmOrganizationTeamEmployeeRepository,
		readonly mikroOrmOrganizationTeamEmployeeRepository?: MikroOrmOrganizationTeamEmployeeRepository,
		// Moves the leave balance of a time-off request an answer moves (see `moveTimeOff`).
		readonly timeOffBalanceDeductionService?: TimeOffBalanceDeductionService
	) {
		super(typeOrmRequestApprovalRepository, mikroOrmRequestApprovalRepository);
	}

	async findAllRequestApprovals(
		filter: FindManyOptions<RequestApproval>,
		findInput: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(filter);

		const tenantId = RequestContext.currentTenantId();
		/*
		 * The scope of the read is the caller's, and the input narrows it rather than stating it: a
		 * register asked for without a filter is the register of the caller's own organization, which is
		 * how every other list of this platform is scoped. Reading the member straight out of the input
		 * left it `undefined` for the bare request the administration surface and the purchase-order flow
		 * both make, and every condition below then compared a column against nothing — so the register
		 * answered an empty list while the single read of the same row answered it in full.
		 */
		const organizationId = findInput?.organizationId ?? RequestContext.currentOrganizationId();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				/*
				 * The ids in scope, read by the statement TypeORM's branch below builds: the policy, the time-off
				 * request and the equipment sharing joined, each without its withdrawn rows (TypeORM adds
				 * `deletedAt IS NULL` to the join of every entity it knows, by relation or by table name), the
				 * four scopes OR-ed, and the request's own withdrawn rows left out.
				 *
				 * The policy used to be joined as `leftJoin(table, alias, column, column)`. knex has no alias
				 * argument: its four-argument join is `(table, column, operator, column)`, so the statement could
				 * not be compiled — `The operator "approval_policy.id" is not permitted` — and the register's list
				 * answered HTTP 500 on REST and INTERNAL_ERROR on GraphQL `requestApprovals`, whatever was stored.
				 *
				 * The polymorphic pair is compared through identifier bindings, which knex quotes for the dialect
				 * it runs on; the double-quoted SQL it replaces was a pair of string literals on MySQL. The id is
				 * compared as text where it is not text, as TypeORM's branch compares it.
				 *
				 * A scope value the caller does not have is compared as `= NULL`, which matches nothing, as the
				 * TypeORM branch's bound parameter does. knex's object form would have turned it into `IS NULL`
				 * — the rows that name no organization, a wider read — or refused an `undefined` outright.
				 */
				const knex = this.mikroOrmRequestApprovalRepository.getKnex();
				const namesTheRequestedRow = (table: string) => {
					const columns = [`${table}.id`, 'request_approval.requestId'];
					return isPostgres()
						? knex.raw('??::text = ??', columns)
						: isMySQL()
						? knex.raw('CAST(?? AS CHAR) COLLATE utf8mb4_unicode_ci = ?? COLLATE utf8mb4_unicode_ci', columns)
						: knex.raw('?? = ??', columns);
				};
				const inCallerScope = (table: string) => (scope: any) =>
					scope
						.where(`${table}.organizationId`, '=', organizationId ?? null)
						.andWhere(`${table}.tenantId`, '=', tenantId ?? null);

				const query = knex('request_approval')
					.withSchema(knex.userParams.schema)
					.select('request_approval.id')
					.leftJoin('approval_policy', (join) =>
						join
							.on('approval_policy.id', '=', 'request_approval.approvalPolicyId')
							.andOnNull('approval_policy.deletedAt')
					)
					.leftJoin('time_off_request', (join) =>
						join.on(namesTheRequestedRow('time_off_request')).andOnNull('time_off_request.deletedAt')
					)
					.leftJoin('equipment_sharing', (join) =>
						join.on(namesTheRequestedRow('equipment_sharing')).andOnNull('equipment_sharing.deletedAt')
					)
					.where((scopes) => {
						scopes
							.where(inCallerScope('approval_policy'))
							.orWhere(inCallerScope('time_off_request'))
							.orWhere(inCallerScope('equipment_sharing'))
							// A request raised in this organization belongs to it even when it names no
							// policy and no time-off / equipment-sharing record (e.g. a purchasing request).
							.orWhere(inCallerScope('request_approval'));
					})
					// The row itself is the caller's tenant's, whichever arm admitted it: the policy and the
					// record an arm joins are named by the request's own columns, which its author states, so
					// an arm alone would show another tenant's request to the tenant whose policy or record it
					// names. Compared as `= NULL` without a tenant, which matches nothing.
					.andWhere('request_approval.tenantId', '=', tenantId ?? null)
					.whereNull('request_approval.deletedAt');

				const results = await query;
				const ids = results.map((r) => r.id);

				if (ids.length === 0) {
					return { items: [], total: 0 };
				}

				// TypeORM's branch selects the joined policy into every row whatever relations were asked
				// for, so this one populates it too: unpopulated, MikroORM serializes it as its bare id.
				const relations: string[] = flatten(filter.relations);
				const [items, total] = await this.mikroOrmRepository.findAndCount(
					{ id: { $in: ids } },
					{ populate: [...new Set(['approvalPolicy', ...relations])] as any[] }
				);
				return { items: items.map((e) => this.serialize(e)) as IRequestApproval[], total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmRepository.createQueryBuilder('request_approval');
				query.leftJoinAndSelect(`${query.alias}.approvalPolicy`, 'approvalPolicy');

				const timeOffRequestCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"time_off_request"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"time_off_request"."id"::"varchar" = "request_approval"."requestId"'
						: isMySQL()
						? p(
								`CAST("time_off_request"."id" AS CHAR) COLLATE utf8mb4_unicode_ci = "request_approval"."requestId" COLLATE utf8mb4_unicode_ci`
						  )
						: '"time_off_request"."id" = "request_approval"."requestId"'
				}`;
				const equipmentSharingCheckIdQuery = `${
					isSqlite() || isBetterSqlite3()
						? '"equipment_sharing"."id" = "request_approval"."requestId"'
						: isPostgres()
						? '"equipment_sharing"."id"::"varchar" = "request_approval"."requestId"'
						: isMySQL()
						? p(
								`CAST(CONVERT("equipment_sharing"."id" USING utf8mb4) AS CHAR) = CAST(CONVERT("request_approval"."requestId" USING utf8mb4) AS CHAR)`
						  )
						: '"equipment_sharing"."id" = "request_approval"."requestId"'
				}`;

				query.leftJoinAndSelect('time_off_request', 'time_off_request', timeOffRequestCheckIdQuery);
				query.leftJoinAndSelect('equipment_sharing', 'equipment_sharing', equipmentSharingCheckIdQuery);

				const relations = filter.relations as string[];
				if (relations && relations.length > 0) {
					query.setFindOptions({ relations: parseFindOptionsRelations(relations) });
				}

				const [items, total] = await query
					.where(
						new Brackets((scopes) => {
							scopes
								.where(
									new Brackets((sqb) => {
										sqb.where(p('approvalPolicy.organizationId =:organizationId'), {
											organizationId
										}).andWhere(p('approvalPolicy.tenantId =:tenantId'), {
											tenantId
										});
									})
								)
								.orWhere(
									new Brackets((sqb) => {
										sqb.where(p('time_off_request.organizationId =:organizationId'), {
											organizationId
										}).andWhere(p('time_off_request.tenantId =:tenantId'), {
											tenantId
										});
									})
								)
								.orWhere(
									new Brackets((sqb) => {
										sqb.where(p('equipment_sharing.organizationId =:organizationId'), {
											organizationId
										}).andWhere(p('equipment_sharing.tenantId =:tenantId'), {
											tenantId
										});
									})
								)
								// A request raised in this organization belongs to it even when it names no policy
								// and no time-off / equipment-sharing record (e.g. a purchasing request).
								.orWhere(
									new Brackets((sqb) => {
										sqb.where(p('request_approval.organizationId =:organizationId'), {
											organizationId
										}).andWhere(p('request_approval.tenantId =:tenantId'), {
											tenantId
										});
									})
								);
						})
					)
					// The row itself is the caller's tenant's, whichever arm admitted it: the policy and the
					// record an arm joins are named by the request's own columns, which its author states, so
					// an arm alone would show another tenant's request to the tenant whose policy or record it
					// names.
					.andWhere(p('request_approval.tenantId =:tenantId'), { tenantId })
					.getManyAndCount();

				return { items, total };
			}
		}
	}

	async findRequestApprovalsByEmployeeId(
		id: ID,
		relations: string[],
		findInput?: IRequestApprovalFindInput
	): Promise<IPagination<IRequestApproval>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		// The relations are applied to the EMPLOYEE read below, so the table is walked from `Employee`.
		assertSensitiveRelationsAllowed(this.typeOrmEmployeeRepository.metadata, relations);

		// Get the current tenant ID and current user ID from the request context.
		const currentUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		// The same scope rule as the register's list: the input narrows the read, and the caller's own
		// organization is what it is narrowed to when the input states none.
		const organizationId = findInput?.organizationId ?? RequestContext.currentOrganizationId();
		const result = await this.find({
			where: {
				createdByUserId: currentUserId,
				organizationId,
				tenantId
			}
		});
		let requestApproval: Pick<IRequestApprovalEmployee, 'requestApprovalId'>[] = [];
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const employee = await this.mikroOrmEmployeeRepository.findOne(id, {
					populate: relations as any
				});
				/*
				 * The employee's approvals count only when the caller asked for them, as on TypeORM, which leaves
				 * a relation it did not load `undefined`. A MikroORM collection that was not populated is never
				 * `undefined`, and it refuses to be read at all: asking it for its length threw `Collection
				 * <RequestApprovalEmployee> of entity Employee[…] not initialized`, so GraphQL
				 * `requestApprovalsByEmployee` — which names no relation — failed on every call. The request
				 * each approval points at is read from the relation, whose key MikroORM always hydrates.
				 */
				const approvals = employee?.requestApprovals as unknown as Collection<RequestApprovalEmployee>;
				if (approvals?.isInitialized()) {
					requestApproval = approvals.getItems().map((approval) => ({
						requestApprovalId: approval.requestApproval?.id ?? approval.requestApprovalId
					}));
				}
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const employee = await this.typeOrmEmployeeRepository.findOne({
					where: { id },
					relations: parseFindOptionsRelations(relations)
				});
				if (employee && employee.requestApprovals && employee.requestApprovals.length > 0) {
					requestApproval = [...requestApproval, ...employee.requestApprovals];
				}
				break;
			}
		}

		for (const request of requestApproval) {
			const approval = await this.findOneByOptions({
				where: {
					id: request.requestApprovalId
				},
				relations: {
					approvalPolicy: true,
					employeeApprovals: true,
					teamApprovals: true,
					tags: true
				}
			});
			result.push(approval);
		}

		return { items: result, total: result.length };
	}

	/**
	 * Resolves the approver employees named by a request approval, inside the caller's tenant only.
	 *
	 * The ids come from the request body and the raw repositories carry no tenant scoping, so an
	 * unscoped lookup attached another tenant's employee (and echoed it back in the response)
	 * (GHSA-gwpq-mmw7-vx85 sibling). Ids of other tenants are ignored; no tenant means no match.
	 *
	 * @param ids - The employee ids from the request.
	 * @param tenantId - The caller's tenant.
	 */
	private async findEmployeesInTenant(ids: ID[], tenantId: ID): Promise<IEmployee[]> {
		if (!tenantId || !Array.isArray(ids) || !ids.length) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.find({ id: { $in: ids }, tenantId } as any);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmEmployeeRepository.find({ where: { id: In(ids), tenantId } });
		}
	}

	/**
	 * Resolves the approver teams named by a request approval, inside the caller's tenant only.
	 * See {@link findEmployeesInTenant}.
	 *
	 * @param ids - The team ids from the request.
	 * @param tenantId - The caller's tenant.
	 */
	private async findTeamsInTenant(ids: ID[], tenantId: ID): Promise<IOrganizationTeam[]> {
		if (!tenantId || !Array.isArray(ids) || !ids.length) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmOrganizationTeamRepository.find({ id: { $in: ids }, tenantId } as any);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmOrganizationTeamRepository.find({ where: { id: In(ids), tenantId } });
		}
	}

	/**
	 * Creates a RequestApproval record.
	 *
	 * `requestId` and `requestType` are the polymorphic pair that attaches the request to the document
	 * it is about: `requestType` names the kind of document and `requestId` names the row, which is
	 * what lets an approver's list, a threshold policy and the document itself all resolve the same
	 * request without any of them owning a column on the other. A request filed without the pair
	 * exists, but nothing can say what it is about.
	 *
	 * @param entity - The input data to create a RequestApproval.
	 * @returns The saved RequestApproval entity.
	 */
	async createRequestApproval(entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		// Get the current tenant ID and current user ID from the request context.
		const tenantId = RequestContext.currentTenantId();

		const requestApproval = new RequestApproval();
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.name = entity.name;
		requestApproval.min_count = entity.min_count;
		// Kept only when it is an identifier: the record a request is about is named by its uuid, and the
		// equipment-sharing list joins on `uuid("requestId")`, which a free-text value would make fail for
		// every tenant. A value that is not one is left out, which is what this method did with every value
		// before it stored the field at all.
		requestApproval.requestId =
			typeof entity.requestId === 'string' && isUUID(entity.requestId) ? entity.requestId : undefined;
		requestApproval.requestType = entity.requestType;
		requestApproval.amount = entity.amount;
		requestApproval.currency = entity.currency;
		requestApproval.note = entity.note;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

		if (entity.employeeApprovals?.length) {
			const employees = await this.findEmployeesInTenant(entity.employeeApprovals as unknown as ID[], tenantId);

			requestApproval.employeeApprovals = employees.map((employee) => {
				const requestApprovalEmployee = new RequestApprovalEmployee();
				requestApprovalEmployee.employeeId = employee.id;
				requestApprovalEmployee.organizationId = entity.organizationId;
				requestApprovalEmployee.tenantId = tenantId;
				requestApprovalEmployee.status = RequestApprovalStatusTypesEnum.REQUESTED;
				return requestApprovalEmployee;
			});
		}

		if (entity.teams?.length) {
			const teams = await this.findTeamsInTenant(entity.teams as unknown as ID[], tenantId);

			requestApproval.teamApprovals = teams.map((team) => {
				const requestApprovalTeam = new RequestApprovalTeam();
				requestApprovalTeam.teamId = team.id;
				requestApprovalTeam.team = team;
				requestApprovalTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalTeam.organizationId = entity.organizationId;
				requestApprovalTeam.tenantId = tenantId;
				return requestApprovalTeam;
			});
		}

		return this.save(requestApproval);
	}

	/**
	 * Edits a request approval: its name, policy, `min_count`, tags and organization, and its approver slots, which are
	 * filed again as `REQUESTED`. The request goes back to `REQUESTED` too: an edit re-opens it, as it always has.
	 *
	 * The edit is one transaction that first takes the request's row lock (`SELECT … FOR UPDATE` on PostgreSQL and
	 * MySQL), the lock an answer ({@link answer}) and the order package's settle
	 * ({@link updateStatusRequestApprovalByAdmin}) take before they read anything. It used to remove the slots, file
	 * them again and save the request as separate statements under no lock, so an answer committed in between was lost
	 * or half kept (ever-co/ever-gauzy#11382, follow-up): its slot write could land on a slot the edit had just
	 * removed, and its status before or after the edit's save, leaving a request re-opened with its slots answered, or
	 * decided with fresh `REQUESTED` slots. Now the two take turns. An answer behind the edit answers the re-opened
	 * request and its new slots; an edit behind an answer re-opens the decided request, as an edit of a decided request
	 * did before. Who may edit, and what an edit may change, are unchanged.
	 *
	 * The checks `save()` makes (the tenant of the stored row and of the graph the save writes, the organization
	 * boundary) are made before the transaction opens, so none of their reads waits for it; the locked row is held to
	 * the caller's organization boundary again, as an answer holds it.
	 *
	 * @param id The request.
	 * @param entity The edit.
	 * @returns The request, as saved.
	 * @throws NotFoundException when the request is not in the caller's scope, or has moved out of it.
	 */
	async updateRequestApproval(id: string, entity: IRequestApprovalCreateInput): Promise<RequestApproval> {
		const tenantId = RequestContext.currentTenantId();
		const requestApproval = await this.findOneByIdString(id);
		requestApproval.name = entity.name;
		requestApproval.status = RequestApprovalStatusTypesEnum.REQUESTED;
		requestApproval.approvalPolicyId = entity.approvalPolicyId;
		requestApproval.min_count = entity.min_count;
		requestApproval.tags = entity.tags;
		requestApproval.organizationId = entity.organizationId;
		requestApproval.tenantId = tenantId;

		// The approver slots the edit files, resolved in the caller's tenant before the transaction opens.
		if (entity.employeeApprovals) {
			const employees = await this.findEmployeesInTenant(entity.employeeApprovals as unknown as ID[], tenantId);
			const requestApprovalEmployees: IRequestApprovalEmployee[] = [];
			employees.forEach((employee) => {
				const raEmployees = new RequestApprovalEmployee();
				raEmployees.employeeId = employee.id;
				raEmployees.employee = employee;
				raEmployees.organizationId = entity.organizationId;
				raEmployees.tenantId = tenantId;
				raEmployees.status = RequestApprovalStatusTypesEnum.REQUESTED;
				requestApprovalEmployees.push(raEmployees);
			});
			requestApproval.employeeApprovals = requestApprovalEmployees;
		}

		if (entity.teams) {
			const teams = await this.findTeamsInTenant(entity.teams as unknown as ID[], tenantId);
			const requestApprovalTeams: IRequestApprovalTeam[] = [];
			teams.forEach((team) => {
				const raTeam = new RequestApprovalTeam();
				raTeam.teamId = team.id;
				raTeam.team = team;
				raTeam.status = RequestApprovalStatusTypesEnum.REQUESTED;
				raTeam.organizationId = entity.organizationId;
				raTeam.tenantId = tenantId;
				requestApprovalTeams.push(raTeam);
			});
			requestApproval.teamApprovals = requestApprovalTeams;
		}

		// What `save()` checks before it writes, made here, outside the transaction (see above).
		await this.assertNotForeignRow(requestApproval, tenantId);
		await this.assertNestedGraphNotForeign([requestApproval], tenantId);
		await this.assertInsideOrganizationBoundary([requestApproval]);

		const lockTenantId = tenantId ?? requestApproval.tenantId;

		return await this.editTransaction(async (transaction) => {
			const locked = await transaction.lockRequest(requestApproval.id, lockTenantId);
			// The scoped read kept the caller inside their organization boundary; the lock reads by id and tenant only.
			if (!locked || !isWithinOrganizationBoundary(locked.organizationId)) {
				throw new NotFoundException('Request Approval not found');
			}

			await transaction.deleteSlots(requestApproval.id);
			const saved = await transaction.saveRequest(requestApproval);
			// Re-opened as one statement of its own: a save writes the columns its copy differs in, and the copy was
			// read before the lock, so an answer committed in between would keep its decision on the request whose
			// slots were just filed again as `REQUESTED`.
			await transaction.writeRequestStatus(requestApproval.id, lockTenantId, RequestApprovalStatusTypesEnum.REQUESTED);
			return saved;
		});
	}

	/**
	 * Runs one edit in one transaction on the ORM the installation runs, and hands it the statements it makes on that
	 * transaction's connection: see {@link updateRequestApproval} and, for why every statement has to go through it,
	 * {@link answerTransaction}.
	 *
	 * @param work The transaction body.
	 * @returns What the body answers.
	 */
	protected async editTransaction<R>(work: (transaction: IRequestApprovalEditTransaction) => Promise<R>): Promise<R> {
		// SQLite has no row locks (TypeORM refuses `setLock` there); its transactions are serialized instead.
		const rowLock = isPostgres() || isMySQL();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmRepository.getEntityManager().transactional(async (em) => {
					const { lockRequest, writeRequestStatus } = this.mikroOrmAnswerTransaction(em, rowLock);
					return await work({
						lockRequest,
						writeRequestStatus,
						deleteSlots: async (requestApprovalId) => {
							// The request's own slots: the request was read in the caller's tenant and is locked.
							const slots = { requestApproval: requestApprovalId } as any;
							await em.nativeDelete(RequestApprovalEmployee, slots);
							await em.nativeDelete(RequestApprovalTeam, slots);
						},
						// The CRUD base's save, which runs on this transaction: inside `transactional`, MikroORM
						// resolves the repository's entity manager to the transaction's fork (its transaction
						// context).
						saveRequest: async (requestApproval) => await this.save(requestApproval)
					});
				});
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository.manager.transaction(async (manager) => {
					const { lockRequest, writeRequestStatus } = this.typeOrmAnswerTransaction(manager, rowLock);
					return await work({
						lockRequest,
						writeRequestStatus,
						deleteSlots: async (requestApprovalId) => {
							// The request's own slots: the request was read in the caller's tenant and is locked.
							await manager.delete(RequestApprovalEmployee, { requestApprovalId });
							await manager.delete(RequestApprovalTeam, { requestApprovalId });
						},
						// What the CRUD base's `save()` hands TypeORM (the payload stamped with the caller's tenant,
						// the slots inserted by the relation's cascade), on the transaction's manager instead of the
						// repository's, whose write of the locked row would wait for this transaction's own lock.
						saveRequest: async (requestApproval) => {
							const tenantId = RequestContext.currentTenantId();
							try {
								return await manager.save(RequestApproval, {
									...requestApproval,
									...(tenantId ? { tenant: { id: tenantId }, tenantId } : {})
								} as RequestApproval);
							} catch (error) {
								console.error('Error saving a request approval edit:', redactDatabaseError(error));
								throw new BadRequestException(toClientSafeError(error));
							}
						}
					});
				});
		}
	}

	/**
	 * Sets a request's status outright, for a platform flow that has already authorized the decision itself (the
	 * order package's `OrderApprovalAdapter.settle`, which settles the order's open requests).
	 *
	 * Not an HTTP path: `PUT /request-approval/{approval,refuse}/:id` used to reach this method for any holder of
	 * `REQUEST_APPROVAL_EDIT`, with the check below commented out; those routes now go through {@link answer}, which
	 * checks who is answering.
	 *
	 * The already-decided check is made on the request read under the answer's row lock, and the status written in
	 * the same transaction, so an approver's answer committed in the meantime is not overwritten: the settle gets a
	 * conflict instead, as it would have had it read the request a moment later.
	 *
	 * @param id The request.
	 * @param status The decision.
	 * @throws ConflictException when the request has already been decided.
	 */
	async updateStatusRequestApprovalByAdmin(id: string, status: number): Promise<RequestApproval> {
		const requestApproval = await this.findOneByIdString(id, {
			relations: {
				approvalPolicy: true
			}
		});
		const tenantId = RequestContext.currentTenantId() ?? requestApproval.tenantId;

		return await this.answerTransaction(async (transaction) => {
			const locked = await transaction.lockRequest(requestApproval.id, tenantId);
			// The organization boundary of the scoped read, again on the locked row (see `answer`).
			if (!locked || !isWithinOrganizationBoundary(locked.organizationId)) {
				throw new NotFoundException('Request Approval not found');
			}

			if (isDecidedRequestApprovalStatus(locked.status)) {
				throw new ConflictException('Request Approval is Conflict');
			}

			await transaction.writeRequestStatus(requestApproval.id, tenantId, status);

			requestApproval.status = status;
			return requestApproval;
		});
	}

	/**
	 * Records the current caller's answer on a request and writes it, without moving the document the request is
	 * about (the `RequestApprovalStatusCommand` handler does that, behind the document's own gate).
	 *
	 * @param id The request.
	 * @param status The decision.
	 * @returns The request, as answered.
	 */
	async updateStatusRequestApprovalByEmployeeOrTeam(id: string, status: number): Promise<RequestApproval> {
		return await this.answer(id, status as RequestApprovalVerdict);
	}

	/**
	 * Applies the current caller's answer to a request approval and writes it, in one transaction.
	 *
	 * The request is first read inside the caller's tenant and organization boundary, which is what decides whether
	 * the caller reaches it at all (404 otherwise). Then, in one transaction:
	 *
	 * 1. the request is read again under a row lock (`SELECT … FOR UPDATE` on PostgreSQL and MySQL), and its approver
	 *    slots after it, so the decision is made on every answer committed before this one; the locked row is held to
	 *    the caller's organization boundary again, as the scoped read was, so a request moved to another organization
	 *    in between is not found (the lock reads it by id and tenant only);
	 * 2. the caller answers as a tenant administrator, or as a designated approver — their own employee slot, or an
	 *    approver team they are an active member of — and anybody else is refused; `min_count` is counted on the
	 *    locked slots (see `request-approval-decision.ts` for the rules);
	 * 3. when the answer settles the request, `settle` moves the document it is about on the same transaction;
	 * 4. the slots the answer was recorded on, and the request's status when it changed, are written.
	 *
	 * Two approvers answering at the same time therefore answer one after the other. Without the lock both read the
	 * request open, and the second write won whatever the first had decided: an approval read before a refusal was
	 * saved overwrote it, and the linked time-off request or equipment sharing followed whichever document write came
	 * last — the opposite of the request's own status when the two orders differed. Two approvals of a request that
	 * needs two each counted one and left it open. Now the second answer sees the first: a request already decided
	 * is a conflict (or, to a tenant administrator, decided the other way), and the second approval counts both.
	 *
	 * On SQLite there are no row locks. TypeORM's transactions there take turns on the database's one connection
	 * (`embedded-transaction-queue.ts`) and MikroORM's pool has one connection, so the transaction is serialized in
	 * the process anyway; a second process writing the same file fails on SQLite's own write lock rather than
	 * overwriting the answer.
	 *
	 * @param id The request.
	 * @param verdict The decision.
	 * @param settle Moves the document a decision that settles the request is about, on the answer's transaction;
	 * omitted, no document moves.
	 * @returns The request, as answered, with its approver slots.
	 * @throws NotFoundException when the request is not in the caller's scope.
	 * @throws ForbiddenException when the caller may not answer it.
	 * @throws ConflictException when it has already been decided.
	 */
	async answer(
		id: ID,
		verdict: RequestApprovalVerdict,
		settle?: (settlement: IRequestApprovalSettlement) => Promise<void>
	): Promise<RequestApproval> {
		const scoped = await this.findOneByIdString(id);
		const tenantId = RequestContext.currentTenantId() ?? scoped.tenantId;

		const user = RequestContext.currentUser();
		const employeeId = user?.employeeId ?? null;
		const isTenantAdmin = RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);

		return await this.answerTransaction(async (transaction) => {
			const requestApproval = await transaction.lockRequest(scoped.id, tenantId);
			// The scoped read kept the caller inside their organization boundary, and the lock reads by id and tenant
			// only: a request an administrator moved to another organization since then is not found either.
			if (!requestApproval || !isWithinOrganizationBoundary(requestApproval.organizationId)) {
				throw new NotFoundException('Request Approval not found');
			}

			const { employeeApprovals, teamApprovals } = await transaction.readSlots(requestApproval.id, tenantId);
			requestApproval.employeeApprovals = employeeApprovals as RequestApprovalEmployee[];
			requestApproval.teamApprovals = teamApprovals as RequestApprovalTeam[];

			const approverTeamIds = teamApprovals.map((slot) => slot.teamId).filter(Boolean);
			const teamIds =
				employeeId && approverTeamIds.length
					? await transaction.readApproverTeams(employeeId, approverTeamIds, tenantId)
					: [];

			// Who the document the request is about was filed by and is for: not its approvers either. A tenant
			// administrator decides any request, so their answer reads nothing more.
			const requestedFor = isTenantAdmin
				? null
				: await this.readLinkedDocumentRequesters(transaction, requestApproval, tenantId);

			const outcome = answerRequestApproval(
				requestApproval,
				verdict,
				{
					userId: user?.id ?? null,
					employeeId,
					teamIds,
					isTenantAdmin
				},
				requestedFor
			);

			// The document first, so its own refusal (403, 409) is raised before the answer is written; the
			// transaction rolls back whatever was written either way.
			if (outcome.settles && settle) {
				await settle({ requestApproval, outcome, transaction });
			}

			const employeeSlotIds = outcome.employeeSlots
				.map((slot) => slot.id)
				.filter((slotId): slotId is ID => !!slotId);
			const teamSlotIds = outcome.teamSlots.map((slot) => slot.id).filter((slotId): slotId is ID => !!slotId);

			// Each slot remembers who answered it: one person counts once toward `min_count`.
			const answeredByUserId = user?.id ?? null;
			if (tenantId && employeeSlotIds.length) {
				await transaction.writeSlots('employee', employeeSlotIds, tenantId, verdict, answeredByUserId);
			}
			if (tenantId && teamSlotIds.length) {
				await transaction.writeSlots('team', teamSlotIds, tenantId, verdict, answeredByUserId);
			}
			if (outcome.status !== outcome.previousStatus) {
				await transaction.writeRequestStatus(requestApproval.id, tenantId, outcome.status);
			}

			return requestApproval;
		});
	}

	/**
	 * Who the document a request is about was filed by and is for, read on the answer's transaction: a time-off
	 * request's or an equipment sharing's `createdByUserId` and employees, and the active members of the teams a
	 * sharing is for. A request about no such document (a
	 * business trip, an order), or naming no row (a `requestId` that is not an identifier, which PostgreSQL would
	 * refuse to compare with a uuid column, aborting the transaction), answers null: its own requester is the one
	 * the request names.
	 *
	 * @param transaction The answer's transaction.
	 * @param requestApproval The request, as the locked read found it.
	 * @param tenantId The caller's tenant.
	 */
	private async readLinkedDocumentRequesters(
		transaction: IRequestApprovalAnswerTransaction,
		requestApproval: RequestApproval,
		tenantId: ID
	): Promise<IRequestApprovalRequestedFor | null> {
		const kind: RequestApprovalLinkedDocumentKind | null =
			requestApproval.requestType === ApprovalPolicyTypesStringEnum.TIME_OFF
				? 'time-off'
				: requestApproval.requestType === ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING
				? 'equipment-sharing'
				: null;
		const requestId = requestApproval.requestId;

		if (!kind || !tenantId || typeof requestId !== 'string' || !isUUID(requestId)) {
			return null;
		}
		return await transaction.readLinkedDocumentRequesters(kind, requestId, tenantId);
	}

	/**
	 * Runs one answer in one transaction on the ORM the installation runs, and hands it the reads and writes it makes
	 * on that transaction's connection.
	 *
	 * Every statement of the answer has to go through what this hands over. On PostgreSQL and MySQL a statement made
	 * through the service's own repository runs on another pooled connection: a read there would not see the lock's
	 * point of view, and a write of the locked request would wait for the lock this transaction holds until the
	 * database gave up. On MikroORM the repositories resolve to the transaction's fork, but its identity map is a copy
	 * of the request's context, so every read here goes to the table instead.
	 *
	 * @param work The transaction body.
	 * @returns What the body answers.
	 */
	protected async answerTransaction<R>(
		work: (transaction: IRequestApprovalAnswerTransaction) => Promise<R>
	): Promise<R> {
		// SQLite has no row locks (TypeORM refuses `setLock` there); its transactions are serialized instead.
		const rowLock = isPostgres() || isMySQL();

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmRepository
					.getEntityManager()
					.transactional(async (em) => await work(this.mikroOrmAnswerTransaction(em, rowLock)));
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository.manager.transaction(
					async (manager) => await work(this.typeOrmAnswerTransaction(manager, rowLock))
				);
		}
	}

	/**
	 * The TypeORM arm of {@link answerTransaction}: everything on the transaction's manager.
	 *
	 * `manager.update` runs TypeORM's update query, which stamps the update date (and increments a `@VersionColumn`
	 * when the entity has one) as `CrudService.update` does.
	 *
	 * @param manager The transaction's manager.
	 * @param rowLock Whether the dialect has row locks.
	 */
	private typeOrmAnswerTransaction(manager: EntityManager, rowLock: boolean): IRequestApprovalAnswerTransaction {
		return {
			lockRequest: async (id, tenantId) => {
				if (!id || !tenantId) {
					return null;
				}
				const query = manager.createQueryBuilder(RequestApproval, 'request_approval').where({ id, tenantId });
				// `pessimistic_write` maps to FOR UPDATE on both dialects. The request row alone: PostgreSQL
				// refuses FOR UPDATE on the nullable side of an outer join, so the slots are read after it.
				return rowLock ? await query.setLock('pessimistic_write').getOne() : await query.getOne();
			},
			readSlots: async (requestApprovalId, tenantId) => ({
				employeeApprovals: await manager.find(RequestApprovalEmployee, {
					where: { requestApprovalId, tenantId }
				}),
				teamApprovals: await manager.find(RequestApprovalTeam, { where: { requestApprovalId, tenantId } })
			}),
			readApproverTeams: async (employeeId, teamIds, tenantId) =>
				(
					await manager.find(OrganizationTeamEmployee, {
						where: { employeeId, organizationTeamId: In(teamIds), tenantId, isActive: true }
					})
				).map((membership) => membership.organizationTeamId),
			writeSlots: async (kind, ids, tenantId, status, answeredByUserId) => {
				const values = { status, ...(answeredByUserId ? { updatedByUserId: answeredByUserId } : {}) };
				if (kind === 'employee') {
					await manager.update(RequestApprovalEmployee, { id: In(ids), tenantId }, values);
				} else {
					await manager.update(RequestApprovalTeam, { id: In(ids), tenantId }, values);
				}
			},
			writeRequestStatus: async (id, tenantId, status) => {
				await manager.update(RequestApproval, { id, tenantId }, { status });
			},
			readLinkedDocument: async (kind, id, tenantId, locked = false) => {
				// The status and organization alone, no eager relation (a leave's `document`): joined, it would put a
				// nullable outer join under the lock, and PostgreSQL refuses FOR UPDATE on that side of one.
				const options = {
					where: { id, tenantId },
					loadEagerRelations: false,
					...(locked && rowLock ? { lock: { mode: 'pessimistic_write' as const } } : {})
				};
				const row =
					kind === 'time-off'
						? await manager.findOne(TimeOffRequest, options)
						: await manager.findOne(EquipmentSharing, options);
				return row ? { id: row.id, organizationId: row.organizationId, status: row.status } : null;
			},
			readLinkedDocumentRequesters: async (kind, id, tenantId) => {
				// The filer, the employees and (a sharing's) teams alone, no other eager relation.
				const row =
					kind === 'time-off'
						? await manager.findOne(TimeOffRequest, {
								where: { id, tenantId },
								relations: { employees: true },
								loadEagerRelations: false
						  })
						: await manager.findOne(EquipmentSharing, {
								where: { id, tenantId },
								relations: { employees: true, teams: true },
								loadEagerRelations: false
						  });
				return requestersOfDocument(
					row,
					await typeOrmActiveTeamMemberIds(manager, teamIdsOfDocument(row), tenantId)
				);
			},
			moveTimeOff: async (id, tenantId, status) => {
				const result = await manager.update(
					TimeOffRequest,
					{ id, tenantId, status: StatusTypesEnum.REQUESTED },
					{ status }
				);
				const moved = result?.affected ?? 0;
				if (moved > 0) {
					// The leave as it stands now, on this transaction (its own row lock is held since the scope check).
					const leave = await manager.findOne(TimeOffRequest, {
						where: { id, tenantId },
						loadEagerRelations: false
					});
					await this.settleMovedTimeOff(typeOrmTimeOffBalanceLedger(manager), leave, status);
				}
				return moved;
			},
			moveEquipmentSharing: async (id, tenantId, status) => {
				await manager.update(EquipmentSharing, { id, tenantId }, { status });
			}
		};
	}

	/**
	 * The MikroORM arm of {@link answerTransaction}: everything on the transaction's fork, and every read from the
	 * table rather than from the identity map the fork inherited (`disableIdentityMap`, which keeps the
	 * transaction, so the lock mode is taken inside it).
	 *
	 * @param em The transaction's entity manager.
	 * @param rowLock Whether the dialect has row locks.
	 */
	private mikroOrmAnswerTransaction(em: MikroOrmEntityManager, rowLock: boolean): IRequestApprovalAnswerTransaction {
		const fromTable = { disableIdentityMap: true };
		const slotsOf = async (entity: typeof RequestApprovalEmployee | typeof RequestApprovalTeam, where: object) =>
			(await em.find(entity as any, where as any, fromTable as any)) as any[];

		return {
			lockRequest: async (id, tenantId) => {
				if (!id || !tenantId) {
					return null;
				}
				const row = await em.findOne(
					RequestApproval,
					{ id, tenantId } as any,
					{
						...fromTable,
						...(rowLock ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {})
					} as any
				);
				if (!row) {
					return null;
				}
				const locked = this.serialize(row as RequestApproval) as RequestApproval;
				// As stored: the `persist: false` organization mirror may be left unhydrated; the relation has its key.
				locked.organizationId =
					(row as any).organizationId ?? (row as any).organization?.id ?? locked.organizationId;
				// The requester the same way: an unhydrated mirror would make the person who raised the request
				// an approver of it.
				locked.createdByUserId =
					(row as any).createdByUserId ?? (row as any).createdByUser?.id ?? locked.createdByUserId;
				return locked;
			},
			readSlots: async (requestApprovalId, tenantId) => ({
				employeeApprovals: (
					await slotsOf(RequestApprovalEmployee, { requestApproval: requestApprovalId, tenantId })
				).map((slot) => ({
					id: slot.id,
					employeeId: slot.employee?.id ?? slot.employeeId,
					status: slot.status,
					updatedByUserId: slot.updatedByUser?.id ?? slot.updatedByUserId ?? null
				})),
				teamApprovals: (
					await slotsOf(RequestApprovalTeam, { requestApproval: requestApprovalId, tenantId })
				).map((slot) => ({
					id: slot.id,
					teamId: slot.team?.id ?? slot.teamId,
					status: slot.status,
					updatedByUserId: slot.updatedByUser?.id ?? slot.updatedByUserId ?? null
				}))
			}),
			readApproverTeams: async (employeeId, teamIds, tenantId) =>
				(
					(await em.find(
						OrganizationTeamEmployee,
						{ employeeId, organizationTeamId: { $in: teamIds }, tenantId, isActive: true } as any,
						fromTable as any
					)) as any[]
				).map((membership) => membership.organizationTeam?.id ?? membership.organizationTeamId),
			writeSlots: async (kind, ids, tenantId, status, answeredByUserId) => {
				const entity = kind === 'employee' ? RequestApprovalEmployee : RequestApprovalTeam;
				const patch = { status, ...(answeredByUserId ? { updatedByUserId: answeredByUserId } : {}) };
				await em.nativeUpdate(
					entity as any,
					{ id: { $in: ids }, tenantId } as any,
					this.mikroOrmRowOf(em, entity, patch) as any
				);
			},
			writeRequestStatus: async (id, tenantId, status) => {
				await em.nativeUpdate(
					RequestApproval,
					{ id, tenantId } as any,
					this.mikroOrmRowOf(em, RequestApproval, { status }) as any
				);
			},
			readLinkedDocument: async (kind, id, tenantId, locked = false) => {
				const entity = kind === 'time-off' ? TimeOffRequest : EquipmentSharing;
				const options = locked && rowLock ? { ...fromTable, lockMode: LockMode.PESSIMISTIC_WRITE } : fromTable;
				const row = (await em.findOne(entity as any, { id, tenantId } as any, options as any)) as any;
				return row
					? { id: row.id, organizationId: row.organization?.id ?? row.organizationId, status: row.status }
					: null;
			},
			readLinkedDocumentRequesters: async (kind, id, tenantId) => {
				const entity = kind === 'time-off' ? TimeOffRequest : EquipmentSharing;
				// A sharing is also for the members of its teams.
				const populate = kind === 'time-off' ? ['employees'] : ['employees', 'teams'];
				const row = await em.findOne(entity as any, { id, tenantId } as any, { ...fromTable, populate } as any);
				return requestersOfDocument(
					row,
					await mikroOrmActiveTeamMemberIds(em, teamIdsOfDocument(row), tenantId)
				);
			},
			moveTimeOff: async (id, tenantId, status) => {
				const moved = await em.nativeUpdate(
					TimeOffRequest,
					{ id, tenantId, status: StatusTypesEnum.REQUESTED } as any,
					this.mikroOrmRowOf(em, TimeOffRequest, { status }) as any
				);
				if (moved > 0) {
					// The leave as it stands now, from the table, on this transaction.
					const row = (await em.findOne(TimeOffRequest, { id, tenantId } as any, fromTable as any)) as any;
					// The `persist: false` mirrors may be left unhydrated; the relations have their keys.
					const leave = row
						? {
								...row,
								tenantId: row.tenantId ?? row.tenant?.id ?? tenantId,
								organizationId: row.organizationId ?? row.organization?.id,
								policyId: row.policyId ?? row.policy?.id
						  }
						: null;
					await this.settleMovedTimeOff(mikroOrmTimeOffBalanceLedger(em), leave, status);
				}
				return moved;
			},
			moveEquipmentSharing: async (id, tenantId, status) => {
				await em.nativeUpdate(
					EquipmentSharing,
					{ id, tenantId } as any,
					this.mikroOrmRowOf(em, EquipmentSharing, { status }) as any
				);
			}
		};
	}

	/**
	 * The leave-balance side of a time-off request an answer moved out of `REQUESTED` (see `moveTimeOff`), on the
	 * answer's transaction: the same decision, through the same service, the time-off route makes, so both approval
	 * paths check and take the same days (ever-co/ever-gauzy#10183, #11601 review).
	 *
	 * @param ledger The answer's transaction, as the balance side reads and writes it.
	 * @param leave The leave as it stands after the move, or null when it is not there.
	 * @param status The status the answer moved it to.
	 * @throws BadRequestException when its policy requires sufficient balance and its balances cannot cover it.
	 */
	private async settleMovedTimeOff(
		ledger: ITimeOffBalanceLedger,
		leave: TimeOffBalanceLeave | null,
		status: StatusTypesEnum
	): Promise<void> {
		if (!leave) {
			return;
		}
		// The compare-and-set moved it from `REQUESTED`: that is the status the decision moves it FROM.
		await this.timeOffBalanceDeductionService?.settle(ledger, { ...leave, status: StatusTypesEnum.REQUESTED }, status);
	}

	/**
	 * The row MikroORM's `nativeUpdate` is handed for one of the answer's writes: what TypeORM's update writes without
	 * being asked, as `CrudService.update` gives MikroORM for the service's own entity (see `mikroOrmUpdateRow`) —
	 * each property's `onUpdate` value (the update date), the user who wrote it, and the version column incremented
	 * in the statement when the entity has one, so a document that opts into optimistic concurrency sees the answer
	 * move it on.
	 *
	 * @param em The transaction's entity manager.
	 * @param entity The entity written.
	 * @param patch The columns the answer writes.
	 * @returns The row to write.
	 */
	private mikroOrmRowOf(em: MikroOrmEntityManager, entity: Function, patch: Record<string, unknown>) {
		const meta = em.getMetadata().find(entity.name);
		if (!meta) {
			return patch;
		}

		const row: Record<string, unknown> = { ...patch };
		for (const property of meta.props) {
			if (
				typeof property.onUpdate === 'function' &&
				property.persist !== false &&
				row[property.name] === undefined
			) {
				row[property.name] = property.onUpdate(row as never, em);
			}
		}

		// The audit stamp, looked up whatever its `persist`: on the platform's entities it is the `updatedByUser`
		// relation's `persist: false` mirror, which `nativeUpdate` writes when it is stated alone (see
		// `mikro-orm-scope-column.helper.ts`).
		if (row['updatedByUserId'] === undefined && meta.properties?.['updatedByUserId']) {
			const userId = RequestContext.currentUserId();
			if (userId) {
				row['updatedByUserId'] = userId;
			}
		}

		// The version column TypeORM's `@VersionColumn` names (its metadata is complete under either ORM), or
		// MikroORM's own version property.
		const connection = this.typeOrmRepository?.manager?.connection;
		const typeOrmVersion = connection?.hasMetadata?.(entity)
			? connection.getMetadata(entity).versionColumn?.propertyName
			: undefined;
		const versionName = typeOrmVersion ?? meta.versionProperty;
		const version = versionName ? meta.properties[versionName] : undefined;
		if (version?.fieldNames?.length && row[version.name] === undefined) {
			row[version.name] = raw('?? + 1', [version.fieldNames[0]]);
		}

		return row;
	}
}
