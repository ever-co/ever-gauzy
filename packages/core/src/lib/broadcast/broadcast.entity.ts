import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import {
	BroadcastCategoryEnum,
	BroadcastVisibilityModeEnum,
	IAudienceRules,
	IBroadcast,
	ID,
	IEmployee,
	JsonData
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmBroadcastRepository } from './repository/mikro-orm-broadcast.repository';

@MultiORMEntity('broadcast', { mikroOrmRepository: () => MikroOrmBroadcastRepository })
export class Broadcast extends BasePerEntityType implements IBroadcast {
	[EntityRepositoryType]?: MikroOrmBroadcastRepository;

	/**
	 * The title/summary of the broadcast
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	title: string;

	/**
	 * The rich content body of the broadcast (JSON or text)
	 */
	@ApiProperty({ type: () => Object })
	@IsNotEmpty()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text'
	})
	content: JsonData;

	/**
	 * The category/type of broadcast
	 */
	@ApiProperty({ type: () => String, enum: BroadcastCategoryEnum })
	@IsNotEmpty()
	@IsEnum(BroadcastCategoryEnum)
	@ColumnIndex()
	@MultiORMColumn()
	category: BroadcastCategoryEnum;

	/**
	 * The visibility mode defining who can see the broadcast
	 */
	@ApiProperty({ type: () => String, enum: BroadcastVisibilityModeEnum })
	@IsNotEmpty()
	@IsEnum(BroadcastVisibilityModeEnum)
	@ColumnIndex()
	@MultiORMColumn()
	visibilityMode: BroadcastVisibilityModeEnum;

	/**
	 * The audience rules for restricted visibility (JSON)
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	audienceRules?: IAudienceRules | string;

	/**
	 * The date when the broadcast was published
	 */
	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	publishedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Broadcast author/publisher
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * Broadcast author/publisher ID
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Broadcast) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
