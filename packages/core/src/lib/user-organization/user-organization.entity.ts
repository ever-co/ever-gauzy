import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ID, IUser, IUserOrganization } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';

@MultiORMEntity('user_organization', { mikroOrmRepository: () => MikroOrmUserOrganizationRepository })
export class UserOrganization extends TenantOrganizationBaseEntity implements IUserOrganization {
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: true })
	isDefault: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@MultiORMManyToOne(() => User, (it) => it.organizations, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: UserOrganization) => it.user)
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId?: ID;
}
