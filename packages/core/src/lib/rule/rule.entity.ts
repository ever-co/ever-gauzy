import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ID, IRule, RuleOperand, RuleOperator, RuleOwnerType, RuleScope, RuleValueType } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmRuleRepository } from './repository/mikro-orm-rule.repository';

/**
 * One condition of a rule set.
 *
 * The table is deliberately generic: price-list eligibility, price conditions, promotion conditions,
 * promotion target selection, shipping eligibility and pricing, tax narrowing, segment membership,
 * payment-provider availability, fulfilment availability, stock-allocation constraints and approval
 * routing all read the same rows through the same evaluator. A capability that needs conditional
 * behaviour contributes a `RuleOwnerType` value and a context mapping — never a condition column on
 * its own table, because that is how two domains end up disagreeing about what "matches" means.
 *
 * `ownerId` is polymorphic by design and carries no foreign key, since the owning row lives in one of
 * fourteen tables. The price of that is paid in the service layer: it validates that the owner type is
 * one the owning capability may use, and deletes a rule set inside the transaction that deletes its
 * owner, because there is no cascade to do it.
 */
@MultiORMEntity('rule', { mikroOrmRepository: () => MikroOrmRuleRepository })
export class Rule extends TenantOrganizationBaseEntity implements IRule {
	/**
	 * What the rule set belongs to.
	 */
	@ApiProperty({ type: () => String, enum: RuleOwnerType })
	@IsEnum(RuleOwnerType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: RuleOwnerType.COLLECTION })
	ownerType: RuleOwnerType;

	/**
	 * Id of the owning row. Polymorphic by design, so it is a plain identifier rather than a relation.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	ownerId: ID;

	/**
	 * Which slice of the evaluation context the attribute is read from.
	 */
	@ApiProperty({ type: () => String, enum: RuleScope })
	@IsEnum(RuleScope)
	@MultiORMColumn({ type: 'varchar', length: 16, default: RuleScope.ORDER })
	scope: RuleScope;

	/**
	 * Dotted path into the evaluation context, for example `customer.groups.code`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 128 })
	attribute: string;

	/**
	 * The comparison the rule performs.
	 */
	@ApiProperty({ type: () => String, enum: RuleOperator })
	@IsEnum(RuleOperator)
	@MultiORMColumn({ type: 'varchar', length: 16, default: RuleOperator.EQ })
	operator: RuleOperator;

	/**
	 * The operand: an array for `IN`, `NOT_IN` and `BETWEEN`, a scalar otherwise, and null only for
	 * `IS_NULL`. The shape is checked when the rule is written, because the evaluator has to be able
	 * to trust it.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<RuleOperand>({ nullable: true })
	value?: RuleOperand;

	/**
	 * How the operand is coerced before it is compared with the attribute.
	 */
	@ApiProperty({ type: () => String, enum: RuleValueType })
	@IsEnum(RuleValueType)
	@MultiORMColumn({ type: 'varchar', length: 16, default: RuleValueType.STRING })
	valueType: RuleValueType;

	/**
	 * Wraps the whole rule in `NOT`, after the operator has been evaluated.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isNegated: boolean;

	/**
	 * Rules sharing this value are AND-ed and the groups are OR-ed. The value need not be contiguous
	 * or start at zero; the evaluator groups by value.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	groupIndex: number;

	/**
	 * Evaluation order within a group, and the tie-break the trace records first.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Administrator-facing label shown in the rule builder.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	description?: string;
}
