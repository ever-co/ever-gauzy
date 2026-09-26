import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AdjustmentType, IAdjustmentReason } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmAdjustmentReasonRepository } from './repository/mikro-orm-adjustment-reason.repository';

/**
 * A governed reason code for a manual money movement.
 *
 * A manual adjustment is money leaving or entering the business without a document behind it, so it
 * must always be attributable to a reason an administrator maintains. This table is what makes a code
 * legitimate, narrows which adjustment types may cite it, and records whether citing it needs an
 * approval — which is how "goodwill up to a limit, approved above it" is expressed as data rather than
 * as a code path.
 *
 * `code` is unique per organization and immutable once an adjustment cites it: the adjustment stores
 * the code as text, so renaming the code here would orphan the history that refers to it.
 */
@MultiORMEntity('adjustment_reason', { mikroOrmRepository: () => MikroOrmAdjustmentReasonRepository })
export class AdjustmentReason extends TenantOrganizationBaseEntity implements IAdjustmentReason {
	/**
	 * Upper snake case code, unique per organization, for example `GOODWILL` or `PRICE_MATCH`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(2)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Administrator-facing name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	label: string;

	/**
	 * Longer explanation of when the reason applies.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * Narrows which adjustment types may cite the reason. `MANUAL` applies to any type.
	 */
	@ApiProperty({ type: () => String, enum: AdjustmentType, default: AdjustmentType.MANUAL })
	@IsEnum(AdjustmentType)
	@MultiORMColumn({ type: 'varchar', length: 32, default: AdjustmentType.MANUAL })
	appliesTo: AdjustmentType;

	/**
	 * When true, an adjustment citing the code must be approved before it is applied.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	requiresApproval: boolean;

	/**
	 * A seeded code, which a tenant may deactivate but not delete: the reason is part of the platform's
	 * vocabulary for explaining money, not one tenant's private note.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSystem: boolean;

	/**
	 * Display order among the reasons of one organization.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;

	/**
	 * Free-form payload.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
