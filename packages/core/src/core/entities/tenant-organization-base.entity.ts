import { ApiProperty } from '@nestjs/swagger';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IsOptional, IsString } from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { Organization, TenantBaseEntity } from '../entities/internal';
import { MultiORMManyToOne } from '../decorators/entity/relations';
import { MultiORMColumn } from '../decorators';

export abstract class TenantOrganizationBaseEntity extends TenantBaseEntity implements IBasePerTenantAndOrganizationEntityModel {

	@ApiProperty({ type: () => Organization })
	@MultiORMManyToOne(() => Organization, {
		nullable: true,
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	@IsOptional()
	organization?: IOrganization;

	@ApiProperty({ type: () => String })
	@RelationId((it: TenantOrganizationBaseEntity) => it.organization)
	@IsString()
	@IsOptional()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: IOrganization['id'];
}
