import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IOrderReturnReason } from '../returns.types';
import { MikroOrmOrderReturnReasonRepository } from './repository/mikro-orm-order-return-reason.repository';

/**
 * A governed reason code for returns.
 *
 * The set is operator-maintained rather than fixed in code because "why did this come back" is a
 * reporting question, and every tenant answers it differently. It is at most two levels deep — a
 * reason and its variants — which is the depth a return form can present without becoming a
 * taxonomy. A reason that the code itself acts on is the `OrderClaimReason` enum instead.
 *
 * Once a reason has been used it is deactivated rather than deleted, so the returns that reference it
 * keep explaining themselves.
 */
@MultiORMEntity('order_return_reason', { mikroOrmRepository: () => MikroOrmOrderReturnReasonRepository })
export class OrderReturnReason extends TenantOrganizationBaseEntity implements IOrderReturnReason {
	/**
	 * Stable code the tenant's own systems can key on, unique inside the organization.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	code: string;

	/**
	 * What the reason is called wherever a return is displayed.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255 })
	label: string;

	/**
	 * Longer explanation shown to the operator choosing the reason.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Parent reason, when this row is a variant of a broader one.
	 */
	@ApiPropertyOptional({ type: () => OrderReturnReason })
	@IsOptional()
	@MultiORMManyToOne(() => OrderReturnReason, (it) => it.children, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	parent?: IOrderReturnReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: OrderReturnReason) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Variants of this reason.
	 */
	@ApiPropertyOptional({ type: () => OrderReturnReason, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => OrderReturnReason, (it) => it.parent)
	children?: IOrderReturnReason[];
}
