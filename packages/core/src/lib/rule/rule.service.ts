import { BadRequestException, Injectable } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import {
	ID,
	IRule,
	IRuleCreateInput,
	IRuleEvaluationResult,
	RuleEvaluationContext,
	RuleOwnerType,
	RuleScope,
	RuleValueType
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { Rule } from './rule.entity';
import { evaluateRuleSet } from './rule.evaluator';
import { IRuleValidationProblem, validateRuleDefinition, validateRuleSet } from './rule.validator';
import { TypeOrmRuleRepository } from './repository/type-orm-rule.repository';
import { MikroOrmRuleRepository } from './repository/mikro-orm-rule.repository';

/**
 * Reads, writes and evaluates rule sets.
 *
 * The service is thin on purpose. Everything that decides *whether* a rule matches lives in
 * `evaluateRuleSet`, which is a pure function, because a seed script and a migration run outside Nest
 * and must reach the same verdict as the API; what lives here is the part that needs a database and a
 * request context — loading an owner's rules, refusing a rule whose shape the evaluator cannot trust,
 * and keeping a rule set and its owner in step, since polymorphism means nothing cascades.
 */
@Injectable()
export class RuleService extends CrudService<Rule> {
	constructor(
		readonly typeOrmRuleRepository: TypeOrmRuleRepository,
		readonly mikroOrmRuleRepository: MikroOrmRuleRepository
	) {
		super(typeOrmRuleRepository, mikroOrmRuleRepository);
	}

	/**
	 * Reads the rules of one owner, in the order the evaluator applies them.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @returns The rules, lowest group index and lowest priority first.
	 */
	async findByOwner(ownerType: RuleOwnerType, ownerId: ID): Promise<Rule[]> {
		return this.typeOrmRuleRepository.find({
			where: { ownerType, ownerId, ...this.scopeWhere() } as any,
			order: { groupIndex: 'ASC', priority: 'ASC' } as any
		});
	}

	/**
	 * Evaluates the rules of one owner against a context.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @param context The context the owner's scope selects.
	 * @returns Whether the owner's rule set matched, and the trace that explains it.
	 */
	async evaluate(
		ownerType: RuleOwnerType,
		ownerId: ID,
		context: RuleEvaluationContext
	): Promise<IRuleEvaluationResult> {
		return this.evaluateRules(await this.findByOwner(ownerType, ownerId), context);
	}

	/**
	 * Evaluates a rule set that has already been read.
	 *
	 * @param rules The rules.
	 * @param context The context the rules' scope selects.
	 * @param options.includeInactive Whether to evaluate deactivated rules.
	 * @returns Whether the set matched, and the trace that explains it.
	 */
	evaluateRules(
		rules: readonly IRule[] | null | undefined,
		context: RuleEvaluationContext,
		options: { includeInactive?: boolean } = {}
	): IRuleEvaluationResult {
		return evaluateRuleSet(rules, context, options);
	}

	/**
	 * Creates one rule after checking its shape.
	 *
	 * @param input The rule to create.
	 * @returns The stored rule.
	 * @throws BadRequestException when the rule cannot be evaluated as written.
	 */
	async createForOwner(input: IRuleCreateInput): Promise<Rule> {
		this.assertWritable({ ...input, scope: input.scope ?? RuleScope.ORDER, valueType: input.valueType ?? RuleValueType.STRING });

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const created = this.typeOrmRuleRepository.create({
			...input,
			scope: input.scope ?? RuleScope.ORDER,
			valueType: input.valueType ?? RuleValueType.STRING,
			isNegated: input.isNegated ?? false,
			groupIndex: input.groupIndex ?? 0,
			priority: input.priority ?? 0,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		} as Partial<Rule>);

		return this.typeOrmRuleRepository.save(created);
	}

	/**
	 * Replaces the whole rule set of one owner.
	 *
	 * Editing a condition is expressed as replacing the set, not as mutating one row: the group indices
	 * and priorities of the other rows are part of the same expression, and a partial update would let
	 * a set exist for a moment that means something its author never wrote. The delete and the inserts
	 * run in one transaction for the same reason.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @param inputs The rules the owner should end up with.
	 * @returns The stored rules.
	 * @throws BadRequestException when any rule cannot be evaluated as written.
	 */
	async replaceOwnerRules(
		ownerType: RuleOwnerType,
		ownerId: ID,
		inputs: readonly IRuleCreateInput[]
	): Promise<Rule[]> {
		const normalized = inputs.map((input) => ({
			...input,
			ownerType,
			ownerId,
			scope: input.scope ?? RuleScope.ORDER,
			valueType: input.valueType ?? RuleValueType.STRING,
			isNegated: input.isNegated ?? false,
			groupIndex: input.groupIndex ?? 0,
			priority: input.priority ?? 0
		}));

		const problems = validateRuleSet(normalized as IRule[]);

		if (problems.length > 0) {
			throw new BadRequestException(this.describe(problems));
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return this.typeOrmRuleRepository.manager.transaction(async (manager) => {
			await manager.delete(Rule, { ownerType, ownerId, ...this.scopeWhere() } as any);

			const created = normalized.map((input) =>
				manager.create(Rule, {
					...input,
					...(tenantId ? { tenantId } : {}),
					...(organizationId ? { organizationId } : {})
				} as Partial<Rule>)
			);

			return manager.save(Rule, created);
		});
	}

	/**
	 * Removes the rule set of one owner.
	 *
	 * There is no foreign key from a rule to its owner, so nothing cascades: deleting an owner without
	 * calling this leaves rows pointing at a row that no longer exists. The owner's own delete path
	 * calls it inside the same transaction.
	 *
	 * @param ownerType The owner type.
	 * @param ownerId The owning row.
	 * @returns The delete result.
	 */
	async deleteByOwner(ownerType: RuleOwnerType, ownerId: ID): Promise<DeleteResult> {
		return this.typeOrmRuleRepository.softDelete({ ownerType, ownerId, ...this.scopeWhere() } as any);
	}

	/**
	 * Checks a rule and refuses it when the evaluator could not trust it.
	 *
	 * @param rule The rule to check.
	 * @throws BadRequestException listing every problem found.
	 */
	assertWritable(rule: Partial<IRule>): void {
		const problems = validateRuleDefinition(rule);

		if (problems.length > 0) {
			throw new BadRequestException(this.describe(problems));
		}
	}

	/**
	 * @param problems The problems found.
	 * @returns A message naming every code, so a caller can act on the first one it recognises.
	 */
	private describe(problems: readonly IRuleValidationProblem[]): string {
		return problems.map((problem) => `${problem.code}: ${problem.message}`).join(' ');
	}

	/**
	 * @returns The tenant and organization a read or write is scoped to.
	 *
	 * A rule of a tenant is invisible to another tenant, and a request that carries no tenant — a seed
	 * run — is scoped by nothing at all rather than by a null tenant, which would match only the rows
	 * that belong to nobody.
	 */
	private scopeWhere(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}
}
