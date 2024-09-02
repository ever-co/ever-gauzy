import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { IBasePerTenantEntityModel, ID, ITenant } from '@gauzy/contracts';
import { BaseEntity, Tenant } from '../entities/internal';
import { MultiORMManyToOne } from '../decorators/entity/relations';
import { MultiORMColumn } from '../decorators';
import { ColumnIndex } from '../decorators/entity/column-index.decorator';

export abstract class TenantBaseEntity extends BaseEntity implements IBasePerTenantEntityModel {
	@ApiPropertyOptional({ type: () => Tenant })
	@IsOptional()
	@MultiORMManyToOne(() => Tenant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	tenant?: ITenant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((t: TenantBaseEntity) => t.tenant)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	tenantId?: ID;
}
