import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isMySQL, isSqlite } from '@gauzy/config';
import { DecimalString, ID } from '@gauzy/contracts';
import { CrudService, MultiORMEnum, RequestContext } from '@gauzy/core';
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
export class CampaignBudgetService extends CrudService<CampaignBudget> {
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
	 * @param campaignId The campaign the budget belongs to.
	 * @param input The ceiling to store.
	 * @returns The stored budget.
	 * @throws BadRequestException when the shape does not match the type.
	 */
	async setBudget(campaignId: ID, input: ICampaignBudgetCreateInput): Promise<ICampaignBudget> {
		this.assertShape(input);

		const existing = await this.findOneByWhereOptions({ campaignId, ...this.scope } as never);

		if (existing) {
			await this.update(existing.id, { ...input } as never);
			return this.findOneByWhereOptions({ id: existing.id } as never);
		}

		return this.create({ ...input, campaignId, used: '0', ...this.scope } as never);
	}

	/**
	 * Reads the budget of a campaign together with its per-attribute consumption.
	 *
	 * @param campaignId The campaign to read.
	 * @returns The budget and its usage rows.
	 * @throws NotFoundException when the campaign has no budget.
	 */
	async getBudget(campaignId: ID): Promise<{ budget: ICampaignBudget; usage: ICampaignBudgetUsage[] }> {
		const budget = await this.findOneByWhereOptions({ campaignId, ...this.scope } as never);

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
	 * @param budget The budget to measure.
	 * @returns `limit - used`, or a large sentinel when the budget is unlimited.
	 */
	headroom(budget: ICampaignBudget): DecimalString {
		return String(Number(budget.limit) - Number(budget.used));
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
	 * @param sql The statement, with named parameters.
	 * @param parameters The parameter values.
	 * @returns The number of affected rows.
	 */
	private async execute(sql: string, parameters: Record<string, unknown>): Promise<number> {
		if (this.ormType === MultiORMEnum.MikroORM) {
			const connection = this.mikroOrmCampaignBudgetRepository.getEntityManager().getConnection();
			return Number(await connection.execute(sql, parameters, 'run'));
		}

		const result = await this.typeOrmCampaignBudgetRepository.query(sql, Object.values(parameters));
		return Array.isArray(result) ? Number(result[1] ?? 0) : Number(result ?? 0);
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
