import { Index, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationPosition, ITag } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationPositionRepository } from './repository/mikro-orm-organization-position.repository';
import { MultiORMManyToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_position', { mikroOrmRepository: () => MikroOrmOrganizationPositionRepository })
export class OrganizationPosition extends TenantOrganizationBaseEntity implements IOrganizationPosition {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationPositions, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_position',
	})
	@JoinTable({
		name: 'tag_organization_position'
	})
	tags?: ITag[];
}
