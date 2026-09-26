import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IPagination,
	IPayrollItem,
	IPayrollItemCreateInput,
	IPayrollRun,
	IPayrollRunCreateInput,
	IPayrollRunUpdateInput,
	IPayrollStatistics,
	IPayrollSummary,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { PayrollRunService } from './payroll-run.service';

/** The members `CreatePayrollRunInput` declares in the schema. */
export interface ICreatePayrollRunInput {
	organizationId: Id;
	periodStart: Date;
	periodEnd: Date;
	payDate: Date;
	frequency: string;
	currency: string;
	notes?: string;
}

/** The members `UpdatePayrollRunInput` declares in the schema. */
export interface IUpdatePayrollRunInput {
	id: Id;
	organizationId: Id;
	periodStart?: Date;
	periodEnd?: Date;
	payDate?: Date;
	frequency?: string;
	currency?: string;
	notes?: string;
}

/** The members `CreatePayrollItemInput` declares in the schema. */
export interface ICreatePayrollItemInput extends Omit<IPayrollItemCreateInput, 'type' | 'category'> {
	type: string;
	category: string;
}

/**
 * The fields a payroll run list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `PayrollRunFilter` and `PayrollRunSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `organizationId` is in neither, and that is deliberate: the delivered read declares its organization as
 * a required member and checks it against the caller's own memberships, so the organization is an
 * argument of the connection rather than a condition a caller may omit. `status` and `frequency` are
 * here as strings — the vocabulary belongs to the platform's contract package — and the period window is
 * here as `periodStart`, which is the one column the delivered range is applied to.
 */
const PAYROLL_RUN_FILTERABLE = {
	id: 'ID',
	status: 'STRING',
	frequency: 'STRING',
	currency: 'STRING',
	periodStart: 'DATE',
	periodEnd: 'DATE',
	payDate: 'DATE',
	notes: 'STRING',
	approvedByUserId: 'ID',
	totalGross: 'DECIMAL',
	totalDeductions: 'DECIMAL',
	totalNet: 'DECIMAL',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PAYROLL_RUN_SORTABLE = [
	'periodStart',
	'periodEnd',
	'payDate',
	'createdAt',
	'updatedAt',
	'status',
	'currency'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This is one of the places where the connection *reproduces* the delivered read rather than deciding for
 * it: the list read orders by the start of the pay period, descending, so a client that states no sort is
 * answered in the order the REST route would have answered it. The identifier is added after it because
 * that order is not total — two runs opened for the same period have no order between them — and a cursor
 * walk needs one.
 */
const PAYROLL_RUN_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'periodStart', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The payroll runs over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `PayrollRunService` method the `/api/payroll-run` route behind it
 * calls, with the same payload and the same request facts.
 *
 * **The guard chain is the controller's and the permission is each route's own.** The class carries what
 * the controller class carries — both guards — and every field then states the permission its own route
 * runs under: `ORG_PAYROLL_VIEW` for the four reads, `ORG_PAYROLL_APPROVE` for the two operations that
 * move money, `ORG_PAYROLL_EDIT` for the rest. That three-way split is the delivered resource's own, and
 * collapsing it here would let a caller approve a run it may only prepare.
 *
 * **The delivered writes are the service's, and nothing about them is restated.** Which transitions a
 * run will accept, that a paid run cannot be edited or cancelled, that a line may only be added to a
 * draft and to an employee of the same organization, and that the totals are recomputed in integer cents
 * rather than accepted from a caller — every one of those is a statement the service makes, and a second
 * copy of it here would be a second place for it to drift.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('PayrollRun')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
export class PayrollRunResolver {
	constructor(private readonly payrollRunService: PayrollRunService) {}

	/**
	 * The runs of one organization, in the delivered read's own order.
	 */
	@Query('payrollRuns')
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	async payrollRuns(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IPayrollRun>> {
		// The same read the list route performs, through the same service method. The delivered read pages
		// at the store — it applies a page size of its own when the caller states none — so the page size
		// the caller stated here is passed through as that size, and a caller that states none is answered
		// the delivered default. The connection then narrows and orders the rows that read answered, which
		// is why its `totalCount` counts the rows it holds rather than the whole table.
		const take = limit ?? first ?? last;
		const { items }: IPagination<IPayrollRun> = await this.payrollRunService.findAllRuns({
			organizationId,
			...(take === undefined ? {} : { limit: take })
		});

		return buildConnection<IPayrollRun>({
			rows: items ?? [],
			filterable: PAYROLL_RUN_FILTERABLE,
			sortable: PAYROLL_RUN_SORTABLE,
			defaultSort: PAYROLL_RUN_DEFAULT_SORT,
			request: { filter, sort, page, first, last, after, before, limit, offset }
		});
	}

	/**
	 * One run with its lines, or null when there is none.
	 *
	 * The read is the one the delivered node route performs, through the same service method, so the
	 * scoping is the service's: the run is read under the organization the caller names and under the
	 * caller's own tenant. A run that is not there answers `null` rather than a refusal, which is the same
	 * fact the REST route's `404` states in the other protocol's vocabulary.
	 */
	@Query('payrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	async payrollRun(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollRun | null> {
		try {
			return await this.payrollRunService.findOneRun(id, organizationId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Total pay across every paid run of one organization, grouped by currency.
	 *
	 * The same service call the delivered statistics route makes. The grouping, the cents arithmetic and
	 * the choice to count paid runs alone are the service's statements, and the type the field answers
	 * carries the members it returns and none of the accumulators it strips.
	 */
	@Query('payrollRunStatistics')
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	async payrollRunStatistics(
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollStatistics[]> {
		return await this.payrollRunService.getStatistics(organizationId);
	}

	/**
	 * What each employee earned, was deducted and takes home in one run.
	 *
	 * The same service call the delivered summary route makes. The breakdown is computed from the run's
	 * own lines in integer cents, which is what makes it a read of its own rather than a narrowing of the
	 * list: there is no summary row to filter.
	 */
	@Query('payrollRunSummary')
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	async payrollRunSummary(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollSummary[]> {
		return await this.payrollRunService.getSummaryByRun(id, organizationId);
	}

	/**
	 * Opens a run in `DRAFT`.
	 *
	 * The same service method the delivered create route calls. `status` and the three totals are outside
	 * the input for the reason the delivered body states: the status moves only through the workflow
	 * below, and the totals are derived from the lines rather than accepted from a caller.
	 */
	@Mutation('createPayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async createPayrollRun(@Args('input') input: ICreatePayrollRunInput): Promise<IPayrollRun> {
		return await this.payrollRunService.createRun(input as unknown as IPayrollRunCreateInput);
	}

	/**
	 * Edits a run that has not been paid.
	 *
	 * The same service method the delivered edit route calls, with the same three arguments: the
	 * identifier, the organization the run is read under, and the members to change. A member the caller
	 * leaves out is left as it is, because the service assigns the stated members onto the row it read.
	 */
	@Mutation('updatePayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async updatePayrollRun(@Args('input') input: IUpdatePayrollRunInput): Promise<IPayrollRun> {
		const { id, organizationId, ...values } = input;

		return await this.payrollRunService.updateRun(
			id,
			organizationId,
			values as unknown as IPayrollRunUpdateInput
		);
	}

	/**
	 * Moves a draft run to `PENDING_APPROVAL`, with its totals refreshed first.
	 */
	@Mutation('submitPayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async submitPayrollRun(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollRun> {
		return await this.payrollRunService.submitForApproval(id, organizationId);
	}

	/**
	 * Approves a run that is pending approval.
	 *
	 * The operation the separate approve grant exists for: the delivered route states a permission of its
	 * own rather than inheriting the controller's edit one, and so does this field.
	 */
	@Mutation('approvePayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_APPROVE)
	async approvePayrollRun(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollRun> {
		return await this.payrollRunService.approve(id, organizationId);
	}

	/**
	 * Recomputes the totals from the lines and marks the run paid.
	 *
	 * Guarded by the approve permission, as the delivered route is: this is the operation that says money
	 * has left, not an edit of the run's facts.
	 */
	@Mutation('processPayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_APPROVE)
	async processPayrollRun(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollRun> {
		return await this.payrollRunService.process(id, organizationId);
	}

	/**
	 * Cancels a run that has not been paid.
	 */
	@Mutation('cancelPayrollRun')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async cancelPayrollRun(
		@Args('id', { type: () => ID }) id: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<IPayrollRun> {
		return await this.payrollRunService.cancel(id, organizationId);
	}

	/**
	 * Adds one earning or deduction line to a draft run.
	 *
	 * The same service method the delivered route calls, with the run taken from the path rather than from
	 * the body: a caller states which run it is writing into by naming it, and never by carrying an
	 * identifier the service would have to trust.
	 */
	@Mutation('addPayrollRunItem')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async addPayrollRunItem(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: ICreatePayrollItemInput
	): Promise<IPayrollItem> {
		return await this.payrollRunService.addItem(id, input as unknown as IPayrollItemCreateInput);
	}

	/**
	 * Removes a line from a draft run.
	 *
	 * The delivered route answers the store's deletion result, which is not a row and not what a GraphQL
	 * field named `removePayrollRunItem` may return; the field answers the fact of the removal instead.
	 */
	@Mutation('removePayrollRunItem')
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	async removePayrollRunItem(
		@Args('id', { type: () => ID }) id: Id,
		@Args('itemId', { type: () => ID }) itemId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<boolean> {
		await this.payrollRunService.removeItem(id, itemId, organizationId);

		return true;
	}
}
