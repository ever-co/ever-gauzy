import { ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsOptional, IsUUID } from 'class-validator';
import { IOrganization, IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';
import { MultiORMManyToOne } from '../decorators/entity/relations';
import { MultiORMColumn } from '../decorators';
import { ColumnIndex } from '../decorators/entity/column-index.decorator';

export abstract class TenantOrganizationBaseEntity
	extends TenantBaseEntity
	implements IBasePerTenantAndOrganizationEntityModel
{
	@MultiORMManyToOne(() => Organization, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on update. */
		onUpdate: 'CASCADE',

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organization?: IOrganization;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: ID;
}
