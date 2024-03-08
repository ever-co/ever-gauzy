import { ApiPropertyOptional } from '@nestjs/swagger';
import { Index, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';
import { MultiORMManyToOne } from '../decorators/entity/relations';
import { MultiORMColumn } from '../decorators';

export abstract class TenantOrganizationBaseEntity extends TenantBaseEntity implements IBasePerTenantAndOrganizationEntityModel {

	@ApiPropertyOptional({ type: () => Organization })
	@IsOptional()
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
	@IsString()
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: IOrganization['id'];
}
