import { ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, IDashboard, IUser } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	code?: string;

	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isDefault?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User dashboard creator
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Dashboard) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;
}
