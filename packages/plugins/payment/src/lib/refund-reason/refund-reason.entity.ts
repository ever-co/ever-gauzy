import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { MikroOrmRefundReasonRepository } from './repository/mikro-orm-refund-reason.repository';
import { IRefundReason } from '../payment.types';

/**
 * A governed refund reason, so refund reporting is groupable instead of being a wall of free text.
 *
 * **At most two levels deep.** A tree that can go arbitrarily deep is a taxonomy nobody maintains,
 * and the second level — "damaged" under "item problem" — is as far as a refund conversation
 * actually goes; the service refuses a third, so a report can group at either level without asking
 * how deep the answer is.
 *
 * A reason a refund cites is **deactivated rather than deleted**, because the reporting that cites it
 * has to keep resolving; `isActive` comes from the platform base entity, and a soft delete is what a
 * reason that is genuinely finished with gets.
 */
@MultiORMEntity('refund_reason', { mikroOrmRepository: () => MikroOrmRefundReasonRepository })
export class RefundReason extends TenantOrganizationBaseEntity implements IRefundReason {
	/**
	 * Stable code used by reports and by the API. Unique per organization.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Human-readable label shown wherever a reason is chosen.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	label: string;

	/**
	 * When the reason applies, in the operator's words.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * The reason this one refines. Null on a top-level reason, and the second level is the last.
	 */
	@MultiORMManyToOne(() => RefundReason, (reason) => reason.children, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	parent?: IRefundReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: RefundReason) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The reasons that refine this one. One level only: a child of a child is refused by the service.
	 */
	@MultiORMOneToMany(() => RefundReason, (reason) => reason.parent)
	children?: IRefundReason[];
}
