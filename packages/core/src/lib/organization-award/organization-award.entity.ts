import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IOrganizationAward } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationAwardRepository } from './repository/mikro-orm-organization-award.repository';

@MultiORMEntity('organization_award', { mikroOrmRepository: () => MikroOrmOrganizationAwardRepository })
export class OrganizationAward extends TenantOrganizationBaseEntity implements IOrganizationAward {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	year: string;
}
