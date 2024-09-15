import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ActivityLogActionEnum,
	ActivityLogEntityEnum,
	ActorTypeEnum,
	IActivityLog,
	IActivityLogUpdatedValues,
	ID,
	IUser
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmActivityLogRepository } from './repository/mikro-orm-activity-log.repository';
import { JoinColumn, RelationId } from 'typeorm';

@MultiORMEntity('activity_log', { mikroOrmRepository: () => MikroOrmActivityLogRepository })
export class ActivityLog extends TenantOrganizationBaseEntity implements IActivityLog {
	[EntityRepositoryType]?: MikroOrmActivityLogRepository;

	@ApiProperty({ type: () => String, enum: ActivityLogEntityEnum })
	@IsNotEmpty()
	@IsEnum(ActivityLogEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: ActivityLogEntityEnum;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: string;

	@ApiProperty({ type: () => String, enum: ActivityLogActionEnum })
	@IsNotEmpty()
	@IsEnum(ActivityLogActionEnum)
	@ColumnIndex()
	@MultiORMColumn()
	action: ActivityLogActionEnum;

	@ApiPropertyOptional({ type: () => String, enum: ActorTypeEnum })
	@IsOptional()
	@IsEnum(ActorTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	actorType?: ActorTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	updatedFields?: string[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	previousValues?: IActivityLogUpdatedValues[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	updatedValues?: IActivityLogUpdatedValues[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	previousEntities?: IActivityLogUpdatedValues[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	updatedEntities?: IActivityLogUpdatedValues[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	data?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User performed action
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ActivityLog) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;
}
