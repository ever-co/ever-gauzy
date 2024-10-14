import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { EntityEnum, ID, IEmployee, IFavorite } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmFavoriteRepository } from './repository/mikro-orm-favorite.repository';

@MultiORMEntity('favorite', { mikroOrmRepository: () => MikroOrmFavoriteRepository })
export class Favorite extends TenantOrganizationBaseEntity implements IFavorite {
	[EntityRepositoryType]?: MikroOrmFavoriteRepository;

	// Indicate the entity type
	@ApiProperty({ type: () => String, enum: EntityEnum })
	@IsNotEmpty()
	@IsEnum(EntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: EntityEnum;

	// Indicate the ID of entity record marked as favorite
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Favorite) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
