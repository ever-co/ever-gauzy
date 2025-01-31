import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { BaseEntityEnum, IBasePerEntityType, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../entities/internal';
import { MultiORMColumn } from '../decorators';
import { ColumnIndex } from '../decorators/entity/column-index.decorator';

export abstract class BasePerEntityType extends TenantOrganizationBaseEntity implements IBasePerEntityType {
	/**
	 * The type of entity type record from which notification was created
	 */
	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsNotEmpty()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn()
	entity: BaseEntityEnum;

	/**
	 * The ID of entity record from which notification was created
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	entityId: ID;
}
