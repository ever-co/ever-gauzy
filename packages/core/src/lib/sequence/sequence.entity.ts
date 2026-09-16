import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ISequence, SequenceResetPolicy, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmSequenceRepository } from './repository/mikro-orm-sequence.repository';

/**
 * A numbering series for human-facing document numbers.
 *
 * Allocation takes a row lock on the series so that two concurrent writers cannot be handed the same
 * value. A series is scoped to an organization and, optionally, to a channel, which is what lets one
 * organization number its documents per sales surface without the series colliding.
 */
@MultiORMEntity('sequence', { mikroOrmRepository: () => MikroOrmSequenceRepository })
export class Sequence extends TenantOrganizationBaseEntity implements ISequence {
	/**
	 * Series key, upper snake case, for example `ORDER` or `PURCHASE_ORDER`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	key: string;

	/**
	 * Text placed before the number, for example `SO-`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	prefix?: string;

	/**
	 * Minimum number of digits; shorter values are left-padded with zeroes.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 1 })
	padding: number;

	/**
	 * Value handed out by the next allocation.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 1 })
	nextValue: number;

	/**
	 * Increment applied per allocation.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	step: number;

	/**
	 * When the series restarts.
	 */
	@ApiProperty({ type: () => String, enum: SequenceResetPolicy })
	@IsEnum(SequenceResetPolicy)
	@MultiORMColumn({ type: 'varchar', default: SequenceResetPolicy.NEVER })
	resetPolicy: SequenceResetPolicy;

	/**
	 * When the series last restarted, used to decide whether a restart is due.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastResetAt?: Date;

	/**
	 * Free-text note for operators.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	description?: string;

	/**
	 * Channel the series belongs to.
	 *
	 * Stored as a plain identifier rather than a foreign key so that a numbered document can be
	 * created before the sales-surface capability is configured in an installation that has not
	 * adopted it; the relation is introduced together with the sales-channel tables.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	channelId?: ID;
}
