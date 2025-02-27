import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ActorTypeEnum, BaseEntityEnum, ID, IEmployee, IMention } from '@gauzy/contracts';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ActorTypeTransformer } from '../shared/pipes';
import { MikroOrmMentionRepository } from './repository/mikro-orm-mention.repository';

@MultiORMEntity('mention', { mikroOrmRepository: () => MikroOrmMentionRepository })
export class Mention extends BasePerEntityType implements IMention {
	[EntityRepositoryType]?: MikroOrmMentionRepository;

	// Indicate the actor type
	@ApiPropertyOptional({ enum: ActorTypeEnum })
	@IsOptional()
	@IsEnum(ActorTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int', nullable: true, transformer: new ActorTypeTransformer() })
	actorType?: ActorTypeEnum; // Will be stored as 0 or 1 in DB

	/**
	 * The parent entity ID
	 *
	 * E.g : If the user was mentioned is in a comment, we need this for subscription and notifications purpose (It could be the `task ID` concerned by comment, then the user will be subscribed to that task instead of to a comment itself because in this case, `entityId` will store the comment ID)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentEntityId?: ID;

	/**
	 * The type of the parent entity (optional)
	 */
	@ApiPropertyOptional({ type: () => String, enum: BaseEntityEnum })
	@IsOptional()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	parentEntityType?: BaseEntityEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employee whom to be mentioned
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	mentionedEmployee?: IEmployee;

	/**
	 * The ID of the employee who is mentioned
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: Mention) => it.mentionedEmployee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	mentionedEmployeeId?: ID;

	/**
	 * The employee who mentioned the other employee
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => Employee, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'CASCADE' // Database cascade action on delete.
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The ID of the employee who mentioned another employee
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Mention) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
