import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, DeleteResult, EntityManager, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IPagination,
	IPayrollItem,
	IPayrollItemCreateInput,
	IPayrollItemFindInput,
	IPayrollRun,
	IPayrollRunCreateInput,
	IPayrollRunFindInput,
	IPayrollRunUpdateInput,
	IPayrollStatistics,
	IPayrollSummary,
	PayrollItemCategoryEnum,
	PayrollItemTypeEnum,
	PayrollRunStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { Employee } from './../core/entities/internal';
import { PayrollItem } from './../payroll-item/payroll-item.entity';
import { TypeOrmPayrollItemRepository } from './../payroll-item/repository/type-orm-payroll-item.repository';
import { PayrollRun } from './payroll-run.entity';
import { MikroOrmPayrollRunRepository } from './repository/mikro-orm-payroll-run.repository';
import { TypeOrmPayrollRunRepository } from './repository/type-orm-payroll-run.repository';

/** The members of a line `updateItem` may change; a member left out is left as it is. */
export type IPayrollItemUpdateInput = Partial<
	Pick<
		IPayrollItemCreateInput,
		'employeeId' | 'type' | 'category' | 'description' | 'amount' | 'quantity' | 'unitPrice' | 'taxable'
	>
>;

/** The largest amount a line may carry: the column is `numeric(14, 2)`. */
const MAX_LINE_AMOUNT = 999999999999;

/** States a run may still be edited or cancelled from. */
const OPEN_STATUSES: PayrollRunStatusEnum[] = [
	PayrollRunStatusEnum.DRAFT,
	PayrollRunStatusEnum.PENDING_APPROVAL,
	PayrollRunStatusEnum.APPROVED,
	PayrollRunStatusEnum.PROCESSING
];

/**
 * Payroll runs and their line items (issue #2453).
 *
 * Two rules hold everywhere in this service:
 *
 *  1. Every lookup is scoped by `tenantId` AND `organizationId`. A payroll run holds what people
 *     are paid; a lookup by id alone would let any authenticated user of any tenant read or move
 *     another company's payroll.
 *  2. Totals are never accepted from a caller. They are recomputed from the run's items, in
 *     integer cents, at the moment the run is processed. Summing `0.1 + 0.2` in binary floating
 *     point does not give `0.3`, and payroll is the last place to discover that.
 */
@Injectable()
export class PayrollRunService extends TenantAwareCrudService<PayrollRun> {
	constructor(
		readonly typeOrmPayrollRunRepository: TypeOrmPayrollRunRepository,
		readonly mikroOrmPayrollRunRepository: MikroOrmPayrollRunRepository,
		private readonly typeOrmPayrollItemRepository: TypeOrmPayrollItemRepository
	) {
		super(typeOrmPayrollRunRepository, mikroOrmPayrollRunRepository);
	}

	/**
	 * Open a new payroll run in `DRAFT`.
	 *
	 * @param input the pay period, pay date, frequency and currency
	 * @returns the created run
	 */
	async createRun(input: IPayrollRunCreateInput): Promise<IPayrollRun> {
		const { periodStart, periodEnd, payDate } = input;

		if (new Date(periodEnd) < new Date(periodStart)) {
			throw new BadRequestException('`periodEnd` cannot be before `periodStart`');
		}

		if (new Date(payDate) < new Date(periodStart)) {
			throw new BadRequestException('`payDate` cannot be before `periodStart`');
		}

		return super.create({
			...input,
			tenantId: RequestContext.currentTenantId() ?? input.tenantId,
			status: PayrollRunStatusEnum.DRAFT,
			totalGross: 0,
			totalDeductions: 0,
			totalNet: 0
		});
	}

	/**
	 * List payroll runs of an organization, newest period first.
	 *
	 * @param filter status, frequency, period range and pagination
	 * @returns the matching runs and the total row count
	 */
	async findAllRuns(filter: IPayrollRunFindInput): Promise<IPagination<IPayrollRun>> {
		const { organizationId, status, frequency, periodStart, periodEnd, page, limit } = filter;
		const tenantId = RequestContext.currentTenantId() ?? filter.tenantId;

		const where: FindOptionsWhere<PayrollRun> = { tenantId, organizationId } as FindOptionsWhere<PayrollRun>;

		if (status) {
			where.status = status;
		}
		if (frequency) {
			where.frequency = frequency;
		}
		// Each bound works on its own; requiring both silently ignored a one-sided filter.
		if (periodStart && periodEnd) {
			where.periodStart = Between(periodStart, periodEnd) as any;
		} else if (periodStart) {
			where.periodStart = MoreThanOrEqual(periodStart) as any;
		} else if (periodEnd) {
			where.periodStart = LessThanOrEqual(periodEnd) as any;
		}

		// `page` is 1-based and `limit` is the page size, matching `IPaginationInput` everywhere
		// else in the codebase; TypeORM wants an offset.
		const take = limit ?? 10;
		const skip = Math.max(0, (page ?? 1) - 1) * take;

		const [items, total] = await this.typeOrmRepository.findAndCount({
			where,
			order: { periodStart: 'DESC' },
			skip,
			take
		});

		return { items, total };
	}

	/**
	 * Read one run with its items.
	 *
	 * @param id the run to read
	 * @param organizationId the organization the run belongs to
	 * @returns the run
	 */
	async findOneRun(id: ID, organizationId: ID): Promise<PayrollRun> {
		const run = await this.typeOrmRepository.findOne({
			where: { id, tenantId: RequestContext.currentTenantId(), organizationId } as FindOptionsWhere<PayrollRun>,
			relations: { items: true }
		});

		if (!run) {
			throw new NotFoundException(`Payroll run with id '${id}' was not found`);
		}

		return run;
	}

	/**
	 * Edit the period, pay date, frequency, currency or notes of a run that has not been paid.
	 *
	 * @param id the run to update
	 * @param organizationId the organization the run belongs to
	 * @param input the fields to change
	 * @returns the updated run
	 */
	async updateRun(id: ID, organizationId: ID, input: IPayrollRunUpdateInput): Promise<IPayrollRun> {
		const run = await this.findOneRun(id, organizationId);

		if (!OPEN_STATUSES.includes(run.status)) {
			throw new BadRequestException(`A payroll run with status ${run.status} can no longer be edited`);
		}

		Object.assign(run, input);

		if (new Date(run.periodEnd) < new Date(run.periodStart)) {
			throw new BadRequestException('`periodEnd` cannot be before `periodStart`');
		}

		return this.typeOrmRepository.save(run);
	}

	/**
	 * Move a run from `DRAFT` to `PENDING_APPROVAL`.
	 *
	 * @param id the run to submit
	 * @param organizationId the organization the run belongs to
	 * @returns the submitted run
	 */
	async submitForApproval(id: ID, organizationId: ID): Promise<IPayrollRun> {
		// Refresh the totals first: the approver has to see what they are signing off.
		const run = await this.findOneRun(id, organizationId);
		await this.recalculateTotals(this.typeOrmRepository.manager, run);

		return this.transition(id, organizationId, [PayrollRunStatusEnum.DRAFT], PayrollRunStatusEnum.PENDING_APPROVAL);
	}

	/**
	 * Move a run from `PENDING_APPROVAL` to `APPROVED`.
	 *
	 * @param id the run to approve
	 * @param organizationId the organization the run belongs to
	 * @returns the approved run
	 */
	async approve(id: ID, organizationId: ID): Promise<IPayrollRun> {
		return this.transition(
			id,
			organizationId,
			[PayrollRunStatusEnum.PENDING_APPROVAL],
			PayrollRunStatusEnum.APPROVED,
			{ approvedAt: new Date(), approvedByUserId: RequestContext.currentUserId() }
		);
	}

	/**
	 * Recompute the totals from the run's items and mark it `PAID`.
	 *
	 * Totals and status move together inside one transaction, so a run can never end up marked
	 * paid with stale totals.
	 *
	 * @param id the run to process
	 * @param organizationId the organization the run belongs to
	 * @returns the processed run
	 */
	async process(id: ID, organizationId: ID): Promise<IPayrollRun> {
		const tenantId = RequestContext.currentTenantId();
		const run = await this.findOneRun(id, organizationId);

		if (run.status !== PayrollRunStatusEnum.APPROVED && run.status !== PayrollRunStatusEnum.PROCESSING) {
			throw new BadRequestException(`Only an approved payroll run can be processed, this one is ${run.status}`);
		}

		await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			// Claim the transition first, so a second concurrent call cannot also pay this run.
			const claimed = await manager.update(
				PayrollRun,
				{
					id,
					tenantId,
					organizationId,
					status: In([PayrollRunStatusEnum.APPROVED, PayrollRunStatusEnum.PROCESSING])
				} as FindOptionsWhere<PayrollRun>,
				{ status: PayrollRunStatusEnum.PAID, paidAt: new Date() }
			);

			if (!claimed.affected) {
				throw new BadRequestException('This payroll run has already been processed');
			}

			const fresh = await manager.findOne(PayrollRun, {
				where: { id, tenantId, organizationId } as FindOptionsWhere<PayrollRun>
			});

			await this.recalculateTotals(manager, fresh);
		});

		return this.findOneRun(id, organizationId);
	}

	/**
	 * Cancel a run that has not been paid. Cancelling an already cancelled run is a no-op.
	 *
	 * @param id the run to cancel
	 * @param organizationId the organization the run belongs to
	 * @returns the cancelled run
	 */
	async cancel(id: ID, organizationId: ID): Promise<IPayrollRun> {
		const run = await this.findOneRun(id, organizationId);

		if (run.status === PayrollRunStatusEnum.CANCELLED) {
			return run;
		}

		if (run.status === PayrollRunStatusEnum.PAID) {
			throw new BadRequestException('A paid payroll run cannot be cancelled');
		}

		run.status = PayrollRunStatusEnum.CANCELLED;

		return this.typeOrmRepository.save(run);
	}

	/**
	 * Add an earning or deduction line to a run that has not been paid.
	 *
	 * @param payrollRunId the run to add the line to
	 * @param input the line to add
	 * @returns the created line
	 */
	async addItem(payrollRunId: ID, input: IPayrollItemCreateInput): Promise<IPayrollItem> {
		const { organizationId, employeeId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const run = await this.findOneRun(payrollRunId, organizationId);

		if (run.status !== PayrollRunStatusEnum.DRAFT) {
			throw new BadRequestException(
				`Line items can only be added while a payroll run is a draft, this one is ${run.status}`
			);
		}

		// The employee must belong to the same organization, or a caller could pay somebody
		// outside their own company out of their own payroll run.
		const employees = await this.typeOrmRepository.manager.count(Employee, {
			where: { id: employeeId, tenantId, organizationId }
		});

		if (employees === 0) {
			throw new NotFoundException(`Employee with id '${employeeId}' was not found in this organization`);
		}

		const item = this.typeOrmPayrollItemRepository.create({
			...input,
			payrollRunId,
			tenantId,
			taxable: input.taxable ?? true
		});

		const saved = await this.typeOrmPayrollItemRepository.save(item);
		await this.recalculateTotals(this.typeOrmRepository.manager, run);

		return saved;
	}

	/**
	 * Edit one line of a draft run, and recompute the run's totals from its lines.
	 *
	 * The same rules `addItem` and `removeItem` hold: the run is read under the caller's tenant and the
	 * organization named, a line may only change while its run is a `DRAFT`, and a line moved to another
	 * employee must move to an employee of the same organization. The totals are then recomputed from the
	 * lines in integer cents, exactly as an added or removed line recomputes them — never accepted from a
	 * caller. The members are checked here as well as by the REST DTO, because the GraphQL input reaches
	 * this method without one.
	 *
	 * @param payrollRunId the run the line belongs to
	 * @param itemId the line to edit
	 * @param organizationId the organization the run belongs to
	 * @param input the members to change
	 * @returns the edited line
	 */
	async updateItem(
		payrollRunId: ID,
		itemId: ID,
		organizationId: ID,
		input: IPayrollItemUpdateInput
	): Promise<IPayrollItem> {
		const tenantId = RequestContext.currentTenantId();
		const run = await this.findOneRun(payrollRunId, organizationId);

		if (run.status !== PayrollRunStatusEnum.DRAFT) {
			throw new BadRequestException(
				`Line items can only be edited while a payroll run is a draft, this one is ${run.status}`
			);
		}

		const item = await this.typeOrmPayrollItemRepository.findOne({
			where: { id: itemId, payrollRunId, tenantId, organizationId } as FindOptionsWhere<PayrollItem>
		});

		if (!item) {
			throw new NotFoundException(`Payroll item with id '${itemId}' was not found in this payroll run`);
		}

		const changes = this.itemChanges(input);

		if (changes.employeeId !== undefined && changes.employeeId !== item.employeeId) {
			// The same check `addItem` makes: a line may not be paid to somebody outside the organization.
			const employees = await this.typeOrmRepository.manager.count(Employee, {
				where: { id: changes.employeeId, tenantId, organizationId }
			});

			if (employees === 0) {
				throw new NotFoundException(
					`Employee with id '${changes.employeeId}' was not found in this organization`
				);
			}
		}

		Object.assign(item, changes);

		const saved = await this.typeOrmPayrollItemRepository.save(item);
		await this.recalculateTotals(this.typeOrmRepository.manager, run);

		return saved;
	}

	/**
	 * Payroll lines of one organization across its runs, newest first — optionally narrowed to one run or
	 * one employee.
	 *
	 * Scoped by the caller's tenant and the organization named, like every read of this service; the
	 * organization is required, so the read can never widen to the whole tenant. Paged at the store with the
	 * same 1-based `page` and `limit` the run list takes (default 10, at most 100).
	 *
	 * @param filter the organization, and optionally the run, the employee, the type, the category and the page
	 * @returns the matching lines and the total row count
	 */
	async findItems(
		filter: IPayrollItemFindInput & { organizationId: ID; tenantId?: ID }
	): Promise<IPagination<IPayrollItem>> {
		const { organizationId, payrollRunId, employeeId, type, category, page, limit } = filter ?? ({} as never);
		const tenantId = RequestContext.currentTenantId() ?? filter?.tenantId;

		if (!tenantId || !organizationId) {
			throw new BadRequestException('Payroll lines are read within one organization');
		}

		const where = { tenantId, organizationId } as FindOptionsWhere<PayrollItem>;

		if (payrollRunId) {
			where.payrollRunId = payrollRunId;
		}
		if (employeeId) {
			where.employeeId = employeeId;
		}
		if (type) {
			where.type = type;
		}
		if (category) {
			where.category = category;
		}

		const take = Math.min(Math.max(1, limit ?? 10), 100);
		const skip = Math.max(0, (page ?? 1) - 1) * take;

		const [items, total] = await this.typeOrmPayrollItemRepository.findAndCount({
			where,
			order: { createdAt: 'DESC' } as never,
			skip,
			take
		});

		return { items, total };
	}

	/**
	 * Remove a line from a run that has not been paid.
	 *
	 * @param payrollRunId the run the line belongs to
	 * @param itemId the line to remove
	 * @param organizationId the organization the run belongs to
	 * @returns the delete result
	 */
	async removeItem(payrollRunId: ID, itemId: ID, organizationId: ID): Promise<DeleteResult> {
		const tenantId = RequestContext.currentTenantId();
		const run = await this.findOneRun(payrollRunId, organizationId);

		if (run.status !== PayrollRunStatusEnum.DRAFT) {
			throw new BadRequestException(
				`Line items can only be removed while a payroll run is a draft, this one is ${run.status}`
			);
		}

		const result = await this.typeOrmPayrollItemRepository.delete({
			id: itemId,
			payrollRunId,
			tenantId,
			organizationId
		} as FindOptionsWhere<PayrollItem>);

		if (!result.affected) {
			throw new NotFoundException(`Payroll item with id '${itemId}' was not found in this payroll run`);
		}

		await this.recalculateTotals(this.typeOrmRepository.manager, run);

		return result;
	}

	/**
	 * Break a run down into what each employee earns, is deducted and takes home.
	 *
	 * @param id the run to summarize
	 * @param organizationId the organization the run belongs to
	 * @returns one summary per employee
	 */
	async getSummaryByRun(id: ID, organizationId: ID): Promise<IPayrollSummary[]> {
		const run = await this.findOneRun(id, organizationId);
		const summaries = new Map<string, IPayrollSummary & { grossCents: number; deductionCents: number }>();

		for (const item of run.items ?? []) {
			if (!item.employeeId) {
				continue;
			}

			if (!summaries.has(item.employeeId)) {
				summaries.set(item.employeeId, {
					employeeId: item.employeeId,
					employee: item.employee,
					periodStart: run.periodStart,
					periodEnd: run.periodEnd,
					grossPay: 0,
					totalDeductions: 0,
					netPay: 0,
					currency: run.currency,
					grossCents: 0,
					deductionCents: 0
				});
			}

			const summary = summaries.get(item.employeeId);
			const cents = Math.round(Number(item.amount) * 100);

			if (item.category === PayrollItemCategoryEnum.EARNING) {
				summary.grossCents += cents;
			} else {
				summary.deductionCents += cents;
			}
		}

		return Array.from(summaries.values()).map(({ grossCents, deductionCents, ...summary }) => ({
			...summary,
			grossPay: grossCents / 100,
			totalDeductions: deductionCents / 100,
			netPay: (grossCents - deductionCents) / 100
		}));
	}

	/**
	 * Totals across every paid run of an organization, grouped by currency.
	 *
	 * Runs are grouped rather than summed together because adding amounts denominated in
	 * different currencies produces a number that means nothing.
	 *
	 * @param organizationId the organization to report on
	 * @returns one set of totals per currency
	 */
	async getStatistics(organizationId: ID): Promise<IPayrollStatistics[]> {
		const tenantId = RequestContext.currentTenantId();
		const runs = await this.typeOrmRepository.find({
			where: { tenantId, organizationId, status: PayrollRunStatusEnum.PAID } as FindOptionsWhere<PayrollRun>,
			relations: { items: true }
		});

		const byCurrency = new Map<
			string,
			IPayrollStatistics & { grossCents: number; deductionCents: number; employees: Set<string> }
		>();

		for (const run of runs) {
			if (!byCurrency.has(run.currency)) {
				byCurrency.set(run.currency, {
					totalRuns: 0,
					totalEmployeesPaid: 0,
					totalGrossPaid: 0,
					totalDeductions: 0,
					totalNetPaid: 0,
					currency: run.currency,
					grossCents: 0,
					deductionCents: 0,
					employees: new Set<string>()
				});
			}

			const stats = byCurrency.get(run.currency);
			stats.totalRuns++;
			stats.grossCents += Math.round(Number(run.totalGross) * 100);
			stats.deductionCents += Math.round(Number(run.totalDeductions) * 100);

			for (const item of run.items ?? []) {
				if (item.employeeId) {
					stats.employees.add(item.employeeId);
				}
			}
		}

		return Array.from(byCurrency.values()).map(({ grossCents, deductionCents, employees, ...stats }) => ({
			...stats,
			totalEmployeesPaid: employees.size,
			totalGrossPaid: grossCents / 100,
			totalDeductions: deductionCents / 100,
			totalNetPaid: (grossCents - deductionCents) / 100
		}));
	}

	/**
	 * The members of a line edit, checked: the vocabulary is the contracts' own, and every amount is a
	 * non-negative number within the column (a GraphQL `Decimal` arrives as text and is read as a number,
	 * which is what the column's transformer stores).
	 */
	private itemChanges(input: IPayrollItemUpdateInput): IPayrollItemUpdateInput {
		const changes: IPayrollItemUpdateInput = {};

		if (input?.employeeId !== undefined && input.employeeId !== null) {
			changes.employeeId = input.employeeId;
		}
		if (input?.type !== undefined && input.type !== null) {
			if (!Object.values(PayrollItemTypeEnum).includes(input.type)) {
				throw new BadRequestException(`'${input.type}' is not a payroll item type`);
			}
			changes.type = input.type;
		}
		if (input?.category !== undefined && input.category !== null) {
			if (!Object.values(PayrollItemCategoryEnum).includes(input.category)) {
				throw new BadRequestException(`'${input.category}' is not a payroll item category`);
			}
			changes.category = input.category;
		}
		if (input?.description !== undefined) {
			changes.description = input.description;
		}
		if (input?.taxable !== undefined && input.taxable !== null) {
			changes.taxable = Boolean(input.taxable);
		}

		for (const member of ['amount', 'quantity', 'unitPrice'] as const) {
			const value = input?.[member];

			if (value === undefined || value === null) {
				continue;
			}

			const number = Number(value);

			if (!Number.isFinite(number) || number < 0 || number > MAX_LINE_AMOUNT) {
				throw new BadRequestException(`'${member}' must be a non-negative amount`);
			}

			changes[member] = number;
		}

		return changes;
	}

	/**
	 * Move a run from one of `from` to `to`, or refuse.
	 */
	private async transition(
		id: ID,
		organizationId: ID,
		from: PayrollRunStatusEnum[],
		to: PayrollRunStatusEnum,
		extra: Partial<PayrollRun> = {}
	): Promise<IPayrollRun> {
		const tenantId = RequestContext.currentTenantId();
		const run = await this.findOneRun(id, organizationId);

		if (!from.includes(run.status)) {
			throw new BadRequestException(
				`A payroll run must be ${from.join(' or ')} to become ${to}, this one is ${run.status}`
			);
		}

		// Claim the transition in a single statement whose WHERE still names the state we read.
		// A plain read-then-save lets two concurrent approvals both observe APPROVED and both
		// write PAID — for payroll, a double payment.
		const claimed = await this.typeOrmRepository.update(
			{ id, tenantId, organizationId, status: In(from) } as FindOptionsWhere<PayrollRun>,
			{ status: to, ...extra } as QueryDeepPartialEntity<PayrollRun>
		);

		if (!claimed.affected) {
			throw new BadRequestException('This payroll run has already moved on to another state');
		}

		return this.findOneRun(id, organizationId);
	}

	/**
	 * Recompute a run's totals from its line items, in integer cents, and persist them.
	 *
	 * Called on every item mutation as well as at process() time, so an approver is never asked
	 * to sign off a run that still reads 0.00.
	 *
	 * @param manager the entity manager to run on (transactional at process() time)
	 * @param run the run to recompute
	 * @returns the run with fresh totals
	 */
	private async recalculateTotals(manager: EntityManager, run: PayrollRun): Promise<PayrollRun> {
		const items = await manager.find(PayrollItem, {
			where: {
				payrollRunId: run.id,
				tenantId: run.tenantId,
				organizationId: run.organizationId
			} as FindOptionsWhere<PayrollItem>
		});

		// Sum in integer cents: binary floating point cannot represent most decimal amounts
		// exactly, and the error compounds over a payroll run's worth of line items.
		let grossCents = 0;
		let deductionCents = 0;

		for (const item of items) {
			const cents = Math.round(Number(item.amount) * 100);

			if (item.category === PayrollItemCategoryEnum.EARNING) {
				grossCents += cents;
			} else {
				deductionCents += cents;
			}
		}

		run.totalGross = grossCents / 100;
		run.totalDeductions = deductionCents / 100;
		run.totalNet = (grossCents - deductionCents) / 100;

		return manager.save(PayrollRun, run);
	}
}
