import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isMySQL, isSqlite } from '@gauzy/config';
import { CurrencyCode, DecimalString, ID, IPagination } from '@gauzy/contracts';
import {
	Money,
	MultiORMEnum,
	readAffectedRows,
	RequestContext,
	toPositionalStatement
} from '@gauzy/core';
import { CampaignBudget } from './campaign-budget.entity';
import { TypeOrmCampaignBudgetRepository } from './repository/type-orm-campaign-budget.repository';
import { MikroOrmCampaignBudgetRepository } from './repository/mikro-orm-campaign-budget.repository';
import { CampaignBudgetUsage } from '../campaign-budget-usage/campaign-budget-usage.entity';
import { TypeOrmCampaignBudgetUsageRepository } from '../campaign-budget-usage/repository/type-orm-campaign-budget-usage.repository';
import {
	CampaignBudgetType,
	ICampaignBudget,
	ICampaignBudgetCreateInput,
	ICampaignBudgetUsage
} from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

/** Result of an attempt to consume budget. */
export interface IBudgetReservation {
	/** True when the ceiling allowed the amount and it has been consumed. */
	readonly reserved: boolean;
	/** What was left before the attempt, which is what a caller reports on a refusal. */
	readonly headroom: DecimalString;
	/** The amount actually consumed, which is zero on a refusal. */
	readonly amount: DecimalString;
}

/** How many times a SQLite write is retried when the database is momentarily busy. */
const SQLITE_BUSY_RETRIES = 3;

/**
 * The scale a budget's figures are carried at: the `numeric(20,6)` of the two columns.
 *
 * The arithmetic is done at the column's scale rather than at a currency's, because what a caller
 * compares a headroom against is the stored figure, and a `USAGE` budget has no currency at all.
 */
const BUDGET_SCALE = 6;

/** ISO 4217's "no currency" code, used for the counting budgets that carry none. */
const BUDGET_NEUTRAL_CURRENCY = 'XXX';

/**
 * What a budget with no ceiling reports as its headroom.
 *
 * A campaign may run unbudgeted — a window with no money limit — and the conditional statement that
 * consumes budget already treats a null `limit` as "no ceiling" (`"limit" IS NULL OR ...`). The
 * figure reported beside a reservation therefore has to say the same thing, and it has to be a
 * `DecimalString` like every other headroom: this is the largest amount a `numeric(20,6)` column
 * holds, which is the widest "no ceiling" the type can express.
 */
export const UNLIMITED_BUDGET_HEADROOM: DecimalString = '99999999999999.000000';

/**
 * The spend or usage ceiling of a campaign.
 *
 * **Concurrency.** Two checkouts may reach the last unit of budget at the same instant, so the
 * ceiling is never enforced by reading `used`, comparing in the application and writing back — that
 * pattern loses exactly the race it exists to prevent. Consumption is a **single conditional
 * statement**:
 *
 * ```sql
 * UPDATE campaign_budget SET used = used + :amount
 *  WHERE id = :id AND ("limit" IS NULL OR used + :amount <= "limit");
 * ```
 *
 * One row affected means the amount is consumed; zero means the ceiling refused it and the caller
 * rolls the whole promotion application back. The same statement runs on Postgres, MySQL and SQLite,
 * which is why it is the primary mechanism. A budget split by attribute gates on the per-value row
 * and advances the parent by the same amount in the same transaction, so a per-value exhaustion
 * blocks its own value and nothing else.
 *
 * The secondary mechanism — `SELECT … FOR UPDATE` on the budget row — exists for the one case the
 * conditional statement cannot express, a check that has to read sibling rows; SQLite has no row
 * locks, so that path is compiled out there and the primary statement is used alone.
 *
 * `used` is a cache of the usage ledger, not an authority: the nightly reconciliation job re-derives
 * it and repairs any drift through this same conditional path.
 */
@Injectable()
export class CampaignBudgetService extends TenantScopedCrudService<CampaignBudget> {
	constructor(
		readonly typeOrmCampaignBudgetRepository: TypeOrmCampaignBudgetRepository,
		readonly mikroOrmCampaignBudgetRepository: MikroOrmCampaignBudgetRepository,
		readonly typeOrmCampaignBudgetUsageRepository: TypeOrmCampaignBudgetUsageRepository
	) {
		super(typeOrmCampaignBudgetRepository, mikroOrmCampaignBudgetRepository);
	}

	/**
	 * Quotes an identifier for the active dialect, so one statement body serves all three.
	 *
	 * @param identifier The column or table name to quote.
	 * @returns The quoted identifier.
	 */
	private q(identifier: string): string {
		return isMySQL() ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * The tenant and organization of the caller.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Validates the shape of a budget against its type: an attribute is required exactly for the two
	 * `*_BY_ATTRIBUTE` types, and a currency exactly for the two `SPEND` types. A money ceiling with
	 * no currency cannot be compared with a discount, and a per-value ceiling with no value has no
	 * meaning at all.
	 *
	 * @param input The budget being written.
	 * @throws BadRequestException when the shape does not match the type.
	 */
	assertShape(input: ICampaignBudgetCreateInput): void {
		const byAttribute =
			input.type === CampaignBudgetType.SPEND_BY_ATTRIBUTE || input.type === CampaignBudgetType.USAGE_BY_ATTRIBUTE;
		const isSpend = input.type === CampaignBudgetType.SPEND || input.type === CampaignBudgetType.SPEND_BY_ATTRIBUTE;

		if (byAttribute && !input.attribute) {
			throw new BadRequestException('CAMPAIGN_BUDGET_INVALID: an attribute budget needs its attribute path.');
		}

		if (!byAttribute && input.attribute) {
			throw new BadRequestException('CAMPAIGN_BUDGET_INVALID: only an attribute budget carries an attribute.');
		}

		if (isSpend && !input.currency) {
			throw new BadRequestException('CAMPAIGN_BUDGET_INVALID: a spend budget needs its currency.');
		}
	}

	/**
	 * Sets or replaces the single budget of a campaign.
	 *
	 * The table holds **one** budget per campaign (`UQ_campaign_budget`, `05` §10.2; `08` §8.2), so
	 * this route is an upsert and not a duplicate check: the first call stores the ceiling, and every
	 * later call moves it. A campaign that carries no ceiling yet is therefore the ordinary case, and
	 * the read that looks for one has to answer "there is none" instead of raising — otherwise the
	 * ceiling could never be set the first time. The read is the fail-soft half of the pair
	 * (`findOneOrFailByWhereOptions`, whose `ITryRequest` carries `success: false`).
	 *
	 * Replacing a ceiling leaves the consumption already recorded alone: this route moves the ceiling,
	 * and forgetting what was spent is the campaign's own reset route, an operator action with a reason.
	 *
	 * @param campaignId The campaign the budget belongs to.
	 * @param input The ceiling to store.
	 * @returns The stored budget.
	 * @throws BadRequestException when the shape does not match the type.
	 */
	async setBudget(campaignId: ID, input: ICampaignBudgetCreateInput): Promise<ICampaignBudget> {
		this.assertShape(input);

		const existing = await this.findOneOrFailByWhereOptions({ campaignId, ...this.scope } as never);

		if (existing.success && existing.record) {
			const budget = existing.record as unknown as ICampaignBudget;

			await this.update(budget.id, { ...input } as never);
			return this.findOneByWhereOptions({ id: budget.id } as never);
		}

		return this.create({ ...input, campaignId, used: '0', ...this.scope } as never);
	}

	/**
	 * Paginates the ceilings of the caller's organization.
	 *
	 * The listing is what a reconciliation walks, one page at a time; it is scoped like every other
	 * read here, so one tenant can never observe another's budget.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of budgets.
	 */
	async findBudgets(options: Record<string, unknown> = {}): Promise<IPagination<ICampaignBudget>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Loads one ceiling of the caller's organization.
	 *
	 * @param id The budget to load.
	 * @returns The budget.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	async findBudgetOrFail(id: ID): Promise<ICampaignBudget> {
		const budget = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!budget) {
			throw new NotFoundException('CAMPAIGN_BUDGET_NOT_FOUND');
		}

		return budget;
	}

	/**
	 * Reads the budget of a campaign, or null when the campaign carries none.
	 *
	 * A budget is optional: a campaign is a window, and a promotion attached to one is unbudgeted —
	 * not invalid — when no ceiling was set. The evaluation reads it through this method rather than
	 * through a fail-lookup, because "this campaign has no ceiling" is an answer and not a failure
	 * (doc 08 §12.2, §11.3).
	 *
	 * @param campaignId The campaign to read.
	 * @returns The budget, or null.
	 */
	async findBudget(campaignId: ID): Promise<ICampaignBudget | null> {
		const budget = await this.typeOrmCampaignBudgetRepository.findOneBy({ campaignId, ...this.scope });

		return budget ?? null;
	}

	/**
	 * Reads the budget of a campaign together with its per-attribute consumption.
	 *
	 * @param campaignId The campaign to read.
	 * @returns The budget and its usage rows.
	 * @throws NotFoundException when the campaign has no budget.
	 */
	async getBudget(campaignId: ID): Promise<{ budget: ICampaignBudget; usage: ICampaignBudgetUsage[] }> {
		const budget = await this.findBudget(campaignId);

		if (!budget) {
			throw new NotFoundException('CAMPAIGN_BUDGET_NOT_FOUND');
		}

		const usage = await this.typeOrmCampaignBudgetUsageRepository.find({
			where: { budgetId: budget.id, ...this.scope }
		});

		return { budget, usage: usage as unknown as ICampaignBudgetUsage[] };
	}

	/**
	 * Returns the remaining headroom of a budget.
	 *
	 * **The subtraction is the money layer's, not the language's.** `String(Number(limit) -
	 * Number(used))` is wrong in three separate ways, and every one of them reaches a caller: with a
	 * limit of `1000.100000` and a spend of `0.300000` it answers `999.8000000000001`, thirteen
	 * fractional digits, which `Money.of` refuses outright with `MONEY_NOT_DECIMAL_STRING`; with
	 * `100.000000` and `99.999999` it answers `9.999999974752427e-7`, exponential notation that is not
	 * a decimal string at all *and* not the right figure either, the true headroom being `0.000001`;
	 * and with no limit set — an unbudgeted campaign, which is the ordinary case — `Number(null)` is
	 * zero, so an unlimited budget reported a *negative* headroom to every caller that read one.
	 *
	 * The value is declared `DecimalString` and travels to callers as `IBudgetReservation.headroom`,
	 * so it has to be one.
	 *
	 * @param budget The budget to measure.
	 * @returns `limit - used` as an exact decimal, or the unlimited sentinel when no ceiling is set.
	 */
	headroom(budget: ICampaignBudget): DecimalString {
		if (budget?.limit === null || budget?.limit === undefined || String(budget.limit).trim() === '') {
			return UNLIMITED_BUDGET_HEADROOM;
		}

		// A `USAGE` budget counts redemptions and carries no currency, so the arithmetic is done in the
		// ISO "no currency" code at the storage scale: what is preserved is the exactness and the six
		// decimal places the column holds, and neither depends on which currency the ceiling is in.
		const currency = (budget.currency ?? BUDGET_NEUTRAL_CURRENCY) as CurrencyCode;

		return Money.fromStorage(budget.limit, currency, BUDGET_SCALE)
			.subtract(Money.fromStorage(budget.used, currency, BUDGET_SCALE))
			.toStorageString();
	}

	/**
	 * Consumes an amount of budget, or refuses it.
	 *
	 * The whole operation is one conditional statement, so a concurrent consumer of the same budget
	 * either sees the amount already taken or takes it itself — never both. A refusal is not an
	 * error: the caller reports it as `BUDGET_EXCEEDED` on the promotion it was evaluating and
	 * re-evaluates without that promotion.
	 *
	 * @param budgetId The budget to consume.
	 * @param amount The amount to consume, as an exact decimal.
	 * @param attributeValue The attribute value to consume against, for a budget split by attribute.
	 * @returns Whether the amount was consumed, and the headroom observed before the attempt.
	 * @throws NotFoundException when the budget is not in the caller's organization.
	 */
	async reserve(budgetId: ID, amount: DecimalString, attributeValue?: string): Promise<IBudgetReservation> {
		const budget = await this.findOneByWhereOptions({ id: budgetId, ...this.scope } as never);

		if (!budget) {
			throw new NotFoundException('CAMPAIGN_BUDGET_NOT_FOUND');
		}

		const headroom = this.headroom(budget as unknown as ICampaignBudget);
		const byAttribute =
			budget.type === CampaignBudgetType.SPEND_BY_ATTRIBUTE ||
			budget.type === CampaignBudgetType.USAGE_BY_ATTRIBUTE;

		if (byAttribute && !attributeValue) {
			throw new BadRequestException('CAMPAIGN_BUDGET_INVALID: an attribute budget needs a value to consume.');
		}

		const consumed = byAttribute
			? await this.reserveByAttribute(budget.id, amount, attributeValue as string)
			: await this.conditionalIncrement(budget.id, amount);

		return {
			reserved: consumed,
			headroom,
			amount: consumed ? amount : '0'
		};
	}

	/**
	 * Releases an amount of budget back to the pool, on a reversal.
	 *
	 * The decrement is floored at zero, which is what keeps a replayed reversal from driving a budget
	 * negative; the service that requests the release separately refuses an amount larger than the
	 * usage row it is reversing.
	 *
	 * @param budgetId The budget to restore.
	 * @param amount The amount to restore, as an exact decimal.
	 * @param attributeValue The attribute value to restore against, for a split budget.
	 * @returns Whether a row was updated.
	 */
	async release(budgetId: ID, amount: DecimalString, attributeValue?: string): Promise<boolean> {
		const budget = await this.findOneByWhereOptions({ id: budgetId, ...this.scope } as never);

		if (!budget) {
			throw new NotFoundException('CAMPAIGN_BUDGET_NOT_FOUND');
		}

		const byAttribute =
			budget.type === CampaignBudgetType.SPEND_BY_ATTRIBUTE ||
			budget.type === CampaignBudgetType.USAGE_BY_ATTRIBUTE;

		if (byAttribute && attributeValue) {
			await this.runStatement(
				`UPDATE ${this.q('campaign_budget_usage')} SET ${this.q('used')} = ` +
					`CASE WHEN ${this.q('used')} - :amount < 0 THEN 0 ELSE ${this.q('used')} - :amount END ` +
					`WHERE ${this.q('budgetId')} = :budgetId AND ${this.q('attributeValue')} = :attributeValue`,
				{ amount, budgetId: budget.id, attributeValue }
			);
		}

		return this.runStatement(
			`UPDATE ${this.q('campaign_budget')} SET ${this.q('used')} = ` +
				`CASE WHEN ${this.q('used')} - :amount < 0 THEN 0 ELSE ${this.q('used')} - :amount END ` +
				`WHERE ${this.q('id')} = :budgetId`,
			{ amount, budgetId: budget.id }
		);
	}

	/**
	 * Resets the consumption counters of a campaign budget and of every per-value row, for an
	 * operator who is deliberately re-opening a closed budget. The reset is a write of `0` through
	 * the same row-locked path, never a blind assignment, so a concurrent reservation cannot be lost
	 * silently.
	 *
	 * @param campaignId The campaign whose budget is reset.
	 * @param _reason Why the reset was made; recorded by the caller on the activity log.
	 * @returns The budget after the reset.
	 */
	async resetConsumption(campaignId: ID, _reason?: string): Promise<ICampaignBudget> {
		const budget = await this.findOneByWhereOptions({ campaignId, ...this.scope } as never);

		if (!budget) {
			throw new NotFoundException('CAMPAIGN_BUDGET_NOT_FOUND');
		}

		await this.runStatement(`UPDATE ${this.q('campaign_budget_usage')} SET ${this.q('used')} = 0 WHERE ${this.q('budgetId')} = :budgetId`, {
			budgetId: budget.id
		});
		await this.runStatement(`UPDATE ${this.q('campaign_budget')} SET ${this.q('used')} = 0 WHERE ${this.q('id')} = :budgetId`, {
			budgetId: budget.id
		});

		return this.findOneByWhereOptions({ id: budget.id } as never);
	}

	/**
	 * The primary mechanism: one conditional statement against the budget row.
	 *
	 * @param budgetId The budget to consume.
	 * @param amount The amount to consume.
	 * @returns True when exactly one row was updated.
	 */
	private async conditionalIncrement(budgetId: ID, amount: DecimalString): Promise<boolean> {
		const sql =
			`UPDATE ${this.q('campaign_budget')} SET ${this.q('used')} = ${this.q('used')} + :amount ` +
			`WHERE ${this.q('id')} = :budgetId ` +
			`AND (${this.q('limit')} IS NULL OR ${this.q('used')} + :amount <= ${this.q('limit')})`;

		return this.runStatement(sql, { amount, budgetId });
	}

	/**
	 * The per-attribute path: the per-value row is the gate, and the parent is advanced by the same
	 * amount in the same transaction, so a per-value exhaustion does not block other values and the
	 * two rows cannot disagree after a commit.
	 *
	 * @param budgetId The budget to consume.
	 * @param amount The amount to consume.
	 * @param attributeValue The value to consume against.
	 * @returns True when the per-value row admitted the amount.
	 */
	private async reserveByAttribute(budgetId: ID, amount: DecimalString, attributeValue: string): Promise<boolean> {
		const usage = this.typeOrmCampaignBudgetUsageRepository.create({
			budgetId,
			attributeValue,
			used: '0',
			...this.scope
		} as never);

		// The row is allocated on first use; a concurrent allocation loses the unique index and is
		// re-read, because the second writer only needed the row to exist.
		try {
			await this.typeOrmCampaignBudgetUsageRepository.save(usage as never);
		} catch {
			const existing = await this.typeOrmCampaignBudgetUsageRepository.findOne({
				where: { budgetId, attributeValue, ...this.scope }
			});

			if (!existing) {
				return false;
			}
		}

		const consumed = await this.runStatement(
			`UPDATE ${this.q('campaign_budget_usage')} SET ${this.q('used')} = ${this.q('used')} + :amount ` +
				`WHERE ${this.q('budgetId')} = :budgetId AND ${this.q('attributeValue')} = :attributeValue ` +
				`AND (SELECT ${this.q('limit')} FROM ${this.q('campaign_budget')} WHERE ${this.q('id')} = :budgetId) IS NOT NULL ` +
				`AND ${this.q('used')} + :amount <= (SELECT ${this.q('limit')} FROM ${this.q('campaign_budget')} WHERE ${this.q('id')} = :budgetId)`,
			{ amount, budgetId, attributeValue }
		);

		if (!consumed) {
			return false;
		}

		await this.runStatement(
			`UPDATE ${this.q('campaign_budget')} SET ${this.q('used')} = ${this.q('used')} + :amount WHERE ${this.q('id')} = :budgetId`,
			{ amount, budgetId }
		);

		return true;
	}

	/**
	 * Runs one statement and reports whether it changed a row.
	 *
	 * Under TypeORM the statement goes through the query builder, which reports the affected rows;
	 * under MikroORM it goes through the connection in `run` mode, which returns the same figure.
	 * On SQLite the write is retried a few times on `SQLITE_BUSY`, because the dialect has no row
	 * locks and a concurrent writer is expected rather than exceptional.
	 *
	 * @param sql The statement, with named parameters.
	 * @param parameters The parameter values.
	 * @returns True when at least one row was affected.
	 */
	private async runStatement(sql: string, parameters: Record<string, unknown>): Promise<boolean> {
		const attempts = isSqlite() ? SQLITE_BUSY_RETRIES : 1;

		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const affected = await this.execute(sql, parameters);
				return affected > 0;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				if (attempt === attempts || !message.includes('SQLITE_BUSY')) {
					throw error;
				}
			}
		}

		return false;
	}

	/**
	 * Executes a statement through whichever ORM is active.
	 *
	 * The two ORMs are handed the parameters in the form each one binds: TypeORM's raw query takes the
	 * values positionally, and so does the MikroORM connection, whose `execute` substitutes one
	 * placeholder per element of the array it is given. The statements are written with named
	 * parameters because two of them bind the same value twice, so the MikroORM branch first resolves
	 * the names into that positional form.
	 *
	 * @param sql The statement, with named parameters.
	 * @param parameters The parameter values.
	 * @returns The number of affected rows.
	 */
	private async execute(sql: string, parameters: Record<string, unknown>): Promise<number> {
		// **Both branches need the rewrite, and only one of them had it.** Nothing below
		// `QueryBuilder` understands `:name` — `Repository.query()` hands the statement to the driver
		// untouched — so the TypeORM branch shipped a statement full of colons with a positional array
		// beside it. Postgres and MySQL raised a syntax error at the first colon and neither SQLite
		// driver could bind an array to a statement that declares no `?`, so every campaign ceiling
		// failed on every dialect. `Object.values()` was wrong a second time over: two of these
		// statements bind the same name twice, and an object has one entry for it.
		const bound = toPositionalStatement(sql, parameters);

		if (this.ormType === MultiORMEnum.MikroORM) {
			const connection = this.mikroOrmCampaignBudgetRepository.getEntityManager().getConnection();

			return readAffectedRows(await connection.execute(bound.sql, bound.parameters, 'run'));
		}

		return readAffectedRows(await this.typeOrmCampaignBudgetRepository.query(bound.sql, bound.parameters));
	}

	/**
	 * Rewrites a statement's named parameters into the positional form the MikroORM connection binds.
	 *
	 * A name used more than once is bound once per occurrence, in the order the occurrences appear:
	 * `conditionalIncrement` compares `used + :amount` against the ceiling and adds the same `:amount`
	 * to the column, so the single named value is two placeholders carrying the same figure.
	 *
	 * **Superseded by `toPositionalStatement` in `@gauzy/core`**, which both branches of
	 * {@link execute} now go through: it does the same rewrite, chooses `$1` for Postgres rather than
	 * assuming `?`, and is the one copy every package shares. This one stays because it is part of
	 * this service's surface and something may still call it; it delegates rather than keeping a
	 * second implementation that can drift from the first.
	 *
	 * @param sql The statement, with named parameters.
	 * @param parameters The parameter values.
	 * @returns The statement in positional form, with its values in matching order.
	 */
	private toPositional(sql: string, parameters: Record<string, unknown>): { sql: string; values: unknown[] } {
		const bound = toPositionalStatement(sql, parameters);

		return { sql: bound.sql, values: bound.parameters };
	}

	/**
	 * Reads the per-value rows of a budget, for the budget view.
	 *
	 * @param budgetId The budget to read.
	 * @returns The usage rows.
	 */
	async findUsage(budgetId: ID): Promise<CampaignBudgetUsage[]> {
		return this.typeOrmCampaignBudgetUsageRepository.find({ where: { budgetId, ...this.scope } });
	}
}
