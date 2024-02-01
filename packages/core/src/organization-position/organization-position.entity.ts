import { Column, Index, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationPosition, ITag } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationPositionRepository } from './repository/mikro-orm-organization-position.repository';

@MultiORMEntity('organization_position', { mikroOrmRepository: () => MikroOrmOrganizationPositionRepository })
export class OrganizationPosition extends TenantOrganizationBaseEntity implements IOrganizationPosition {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.organizationPositions, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_position'
	})
	tags?: ITag[];
}
