import { ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { IDashboard } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { MikroOrmDashboardRepository } from './repository/mikro-orm-dashboard.repository';

@MultiORMEntity('dashboard', { mikroOrmRepository: () => MikroOrmDashboardRepository })
export class Dashboard extends TenantOrganizationBaseEntity implements IDashboard {
	[EntityRepositoryType]?: MikroOrmDashboardRepository;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	resolved?: boolean;
}
