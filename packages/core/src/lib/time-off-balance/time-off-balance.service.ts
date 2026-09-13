import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
	ID,
	IPagination,
	ITimeOffBalance,
	ITimeOffBalanceAdjustInput,
	ITimeOffBalanceAllocateInput,
	ITimeOffBalanceCarryForwardInput,
	ITimeOffBalanceFindInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { Employee, TimeOffPolicy } from './../core/entities/internal';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TimeOffBalance } from './time-off-balance.entity';
import { MikroOrmTimeOffBalanceRepository } from './repository/mikro-orm-time-off-balance.repository';
import { TypeOrmTimeOffBalanceRepository } from './repository/type-orm-time-off-balance.repository';

/**
 * Leave balances per employee, per policy, per year (issue #314).
 *
 * `deduct` and `reverse` are written as single conditional UPDATE statements rather than
 * read-modify-write pairs. Two approvals landing at the same moment on a read-modify-write would
 * each read the same `taken`, and one of the two deductions would silently vanish — an employee
 * could take more leave than they have. The UPDATE carries its own balance check in the WHERE
 * clause, so the database decides, and a zero row count means "not enough left".
 */
@Injectable()
export class TimeOffBalanceService extends TenantAwareCrudService<TimeOffBalance> {
	constructor(
		readonly typeOrmTimeOffBalanceRepository: TypeOrmTimeOffBalanceRepository,
		readonly mikroOrmTimeOffBalanceRepository: MikroOrmTimeOffBalanceRepository
	) {
		super(typeOrmTimeOffBalanceRepository, mikroOrmTimeOffBalanceRepository);
	}

	/**
	 * List balances, optionally narrowed by employee, policy and year.
	 *
	 * A caller without `CHANGE_SELECTED_EMPLOYEE` only ever sees their own balances, whatever
	 * `employeeId` they ask for — leave entitlement is personal data, and every employee holds
	 * `TIME_OFF_VIEW` by default.
	 *
	 * @param input the filters to apply
	 * @returns the matching balances
	 */
	async findAllByFilter(
		input: ITimeOffBalanceFindInput & { page?: number; limit?: number }
	): Promise<IPagination<ITimeOffBalance>> {
		const { policyId, year, organizationId, page, limit } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const employeeId = this.resolveVisibleEmployeeId(input.employeeId);

		const where: Record<string, unknown> = { tenantId, organizationId };

		if (employeeId) {
			where['employeeId'] = employeeId;
		}
		if (policyId) {
			where['policyId'] = policyId;
		}
		if (year) {
			where['year'] = year;
		}

		const take = Math.min(limit ?? 50, 200);
		const skip = Math.max(0, (page ?? 1) - 1) * take;

		const [items, total] = await this.typeOrmRepository.findAndCount({
			where: where as any,
			relations: { policy: true },
			order: { year: 'DESC' },
			skip,
			take
		});

		return { items, total };
	}

	/**
	 * The current employee's own balances. Backs `GET /time-off-balance/me`, which the MCP
	 * server's `get_my_time_off_balance` tool already calls.
	 *
	 * @param input the policy and year to filter by
	 * @returns the caller's balances
	 */
	async findMine(
		input: ITimeOffBalanceFindInput & { page?: number; limit?: number }
	): Promise<IPagination<ITimeOffBalance>> {
		const employeeId = RequestContext.currentEmployeeId();

		if (!employeeId) {
			throw new ForbiddenException('Only an employee has a leave balance');
		}

		return this.findAllByFilter({ ...input, employeeId });
	}

	/**
	 * Set the accrued days of one employee/policy/year balance, creating the row if it is the
	 * first allocation, and recompute `remaining`.
	 *
	 * This replaces `accrued` rather than adding to it, so re-running an allocation for a period
	 * is idempotent instead of compounding.
	 *
	 * @param input employee, policy, year and the accrued days
	 * @returns the updated balance
	 */
	async allocate(input: ITimeOffBalanceAllocateInput): Promise<ITimeOffBalance> {
		const { employeeId, policyId, year, accrued, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		await this.assertEmployeeAndPolicyExist(employeeId, policyId, tenantId, organizationId);

		const balance = await this.findOrCreate({ employeeId, policyId, year, tenantId, organizationId });

		balance.accrued = accrued;
		balance.remaining = this.computeRemaining({ ...balance, accrued });

		return this.typeOrmRepository.save(balance);
	}

	/**
	 * Take days off the balance when a time off request is approved.
	 *
	 * @param input employee, policy, year and how many days to deduct
	 * @returns the balance after the deduction
	 */
	async deduct(input: ITimeOffBalanceAdjustInput): Promise<ITimeOffBalance> {
		const { employeeId, policyId, year, days, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		const updated = await this.applyDelta(employeeId, policyId, year, days, organizationId, tenantId, true);

		if (updated === 0) {
			// Either the balance does not exist, or it does not have enough days left. `getOrFail`
			// separates the two so the caller gets the accurate error.
			await this.getOrFail(employeeId, policyId, year, organizationId, tenantId);
			throw new BadRequestException('Insufficient leave balance for the requested number of days');
		}

		return this.getOrFail(employeeId, policyId, year, organizationId, tenantId);
	}

	/**
	 * Give days back when an approved request is cancelled or denied after the fact.
	 *
	 * @param input employee, policy, year and how many days to restore
	 * @returns the balance after the reversal
	 */
	async reverse(input: ITimeOffBalanceAdjustInput): Promise<ITimeOffBalance> {
		const { employeeId, policyId, year, days, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		await this.applyDelta(employeeId, policyId, year, days, organizationId, tenantId, false);

		return this.getOrFail(employeeId, policyId, year, organizationId, tenantId);
	}

	/**
	 * Roll each employee's unused days of one policy from one year into the next.
	 *
	 * The days are moved, not copied: the source year records them in `carriedOut` and stops
	 * counting them as remaining, so the same day is never available in two years at once.
	 * Re-running it is safe — both sides are *set* to the computed value rather than added to.
	 *
	 * @param input policy, source year, target year and an optional cap
	 * @returns how many employee balances were rolled over
	 */
	async carryForward(input: ITimeOffBalanceCarryForwardInput): Promise<{ carried: number }> {
		const { policyId, fromYear, toYear, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		if (toYear <= fromYear) {
			throw new BadRequestException('`toYear` must be later than `fromYear`');
		}

		const policy = await this.typeOrmRepository.manager.findOne(TimeOffPolicy, {
			where: { id: policyId, tenantId, organizationId }
		});

		if (!policy) {
			throw new NotFoundException(`Time off policy with id '${policyId}' was not found in this organization`);
		}

		if (policy.allowCarryForward === false) {
			throw new BadRequestException('This policy does not allow unused days to be carried forward');
		}

		// An explicit cap in the request wins; otherwise the policy's own cap applies. `0` and
		// unset both mean "no cap".
		const cap = input.maxCarryForwardDays ?? policy.maxCarryForwardDays ?? 0;

		const sources = await this.typeOrmRepository.find({
			where: { policyId, year: fromYear, tenantId, organizationId } as any
		});

		let carried = 0;

		await this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			for (const source of sources) {
				// Add back what a previous run already moved, so a re-run recomputes rather than
				// shrinking the balance a second time.
				const available = Math.max(0, Number(source.remaining ?? 0) + Number(source.carriedOut ?? 0));
				const days = cap > 0 ? Math.min(available, cap) : available;

				const destination = await this.findOrCreate(
					{ employeeId: source.employeeId, policyId, year: toYear, tenantId, organizationId },
					manager
				);

				destination.carriedForward = days;
				destination.remaining = this.computeRemaining({ ...destination, carriedForward: days });
				await manager.save(TimeOffBalance, destination);

				source.carriedOut = days;
				source.remaining = this.computeRemaining({ ...source, carriedOut: days });
				await manager.save(TimeOffBalance, source);

				carried++;
			}
		});

		return { carried };
	}

	/**
	 * `accrued + carriedForward - taken - carriedOut`, never below zero.
	 */
	private computeRemaining(balance: Partial<TimeOffBalance>): number {
		const remaining =
			Number(balance.accrued ?? 0) +
			Number(balance.carriedForward ?? 0) -
			Number(balance.taken ?? 0) -
			Number(balance.carriedOut ?? 0);

		return Math.max(0, Math.round(remaining * 100) / 100);
	}

	/**
	 * The employee whose balances the caller is allowed to see.
	 *
	 * Holders of `CHANGE_SELECTED_EMPLOYEE` may look at anybody (or at everybody, by passing no
	 * `employeeId`); everybody else is pinned to their own record.
	 */
	private resolveVisibleEmployeeId(requested?: ID): ID | undefined {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, false)) {
			return requested;
		}

		const employeeId = RequestContext.currentEmployeeId();

		if (!employeeId) {
			throw new ForbiddenException('You are not allowed to view leave balances of other employees');
		}

		return employeeId;
	}

	/**
	 * Fetch a balance row, or create a zeroed one if this is the first time it is needed.
	 *
	 * The insert can lose a race against a concurrent caller; the unique index on
	 * `(tenantId, organizationId, employeeId, policyId, year)` turns that into an error rather
	 * than a duplicate row, and the loser simply re-reads the winner's row.
	 *
	 * @param key employee, policy, year, tenant and organization
	 * @param manager an optional transactional entity manager
	 * @returns the existing or newly created balance
	 */
	private async findOrCreate(
		key: { employeeId: ID; policyId: ID; year: number; tenantId: ID; organizationId: ID },
		manager?: EntityManager
	): Promise<TimeOffBalance> {
		const repository = manager ? manager.getRepository(TimeOffBalance) : this.typeOrmRepository;
		const existing = await repository.findOne({ where: key as any });

		if (existing) {
			return existing;
		}

		try {
			return await repository.save(
				repository.create({ ...key, accrued: 0, taken: 0, carriedForward: 0, carriedOut: 0, remaining: 0 })
			);
		} catch (error) {
			const raced = await repository.findOne({ where: key as any });

			if (!raced) {
				throw error;
			}

			return raced;
		}
	}

	/**
	 * Apply a signed change to `taken` in one statement, so concurrent approvals cannot lose an
	 * update. When `spending` is true the statement only matches if enough days are left.
	 *
	 * @returns the number of rows the statement changed (0 or 1)
	 */
	private async applyDelta(
		employeeId: ID,
		policyId: ID,
		year: number,
		days: number,
		organizationId: ID,
		tenantId: ID,
		spending: boolean
	): Promise<number> {
		if (!(days > 0)) {
			// A negative or zero delta would invert the arithmetic and hand out leave for free.
			throw new BadRequestException('The number of days must be greater than zero');
		}

		// A reversal clamps at zero so a double cancellation can never push `taken` negative.
		const takenExpression = spending
			? p(`"taken" + :days`)
			: p(`CASE WHEN "taken" - :days < 0 THEN 0 ELSE "taken" - :days END`);

		// Explicit, parameterised conditions rather than an object literal: an UPDATE builder's
		// object form is easy to get subtly wrong, and this leaves no doubt about what is scoped.
		const builder = this.typeOrmRepository
			.createQueryBuilder()
			.update(TimeOffBalance)
			.set({
				taken: () => takenExpression,
				remaining: () => p(`"accrued" + "carriedForward" - (${takenExpression}) - "carriedOut"`)
			})
			.where(
				p(
					`"employeeId" = :employeeId AND "policyId" = :policyId AND "year" = :year AND "tenantId" = :tenantId AND "organizationId" = :organizationId AND "deletedAt" IS NULL`
				),
				{ employeeId, policyId, year, tenantId, organizationId }
			)
			.setParameter('days', days);

		if (spending) {
			builder.andWhere(p(`"accrued" + "carriedForward" - "taken" - "carriedOut" >= :days`));
		}

		const result = await builder.execute();

		return result.affected ?? 0;
	}

	/**
	 * Read one balance or fail if it does not exist.
	 */
	private async getOrFail(
		employeeId: ID,
		policyId: ID,
		year: number,
		organizationId: ID,
		tenantId: ID
	): Promise<TimeOffBalance> {
		const balance = await this.typeOrmRepository.findOne({
			where: { employeeId, policyId, year, tenantId, organizationId } as any
		});

		if (!balance) {
			throw new NotFoundException(
				'No leave balance exists for this employee, policy and year — allocate one first'
			);
		}

		return balance;
	}

	/**
	 * Refuse to touch an employee or a policy from another tenant or organization.
	 */
	private async assertEmployeeAndPolicyExist(
		employeeId: ID,
		policyId: ID,
		tenantId: ID,
		organizationId: ID
	): Promise<void> {
		const manager = this.typeOrmRepository.manager;

		const [employees, policies] = await Promise.all([
			manager.count(Employee, { where: { id: employeeId, tenantId, organizationId } }),
			manager.count(TimeOffPolicy, { where: { id: policyId, tenantId, organizationId } })
		]);

		if (employees === 0) {
			throw new NotFoundException(`Employee with id '${employeeId}' was not found in this organization`);
		}

		if (policies === 0) {
			throw new NotFoundException(`Time off policy with id '${policyId}' was not found in this organization`);
		}
	}
}
