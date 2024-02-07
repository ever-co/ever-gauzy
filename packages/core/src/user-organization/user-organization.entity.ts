import {
	Index,
	JoinColumn,
	RelationId
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IUser, IUserOrganization } from '@gauzy/contracts';
import { IsUUID } from 'class-validator';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmUserOrganizationRepository } from './repository/mikro-orm-user-organization.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('user_organization', { mikroOrmRepository: () => MikroOrmUserOrganizationRepository })
export class UserOrganization extends TenantOrganizationBaseEntity implements IUserOrganization {

	@ApiProperty({ type: () => Boolean, default: true })
	@Index()
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
	@Index()
	@MultiORMColumn({ relationId: true })
	userId: IUser['id'];
}
