import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { RolesEnum, IRolePermission, IRole, IUser } from '@gauzy/contracts';
import { RolePermission, TenantBaseEntity, User } from '../core/entities/internal';

@Entity('role')
export class Role extends TenantBaseEntity implements IRole {
	@ApiProperty({ type: () => String, enum: RolesEnum })
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isSystem?: boolean;

	@ApiProperty({ type: () => RolePermission, isArray: true })
	@OneToMany(() => RolePermission, (rolePermission) => rolePermission.role, {
		cascade: true
	})
	rolePermissions?: IRolePermission[];

	/**
	 * Role Users
	 */
	@ApiProperty({ type: () => User, isArray: true })
	@Exclude()
	@OneToMany(() => User, (user) => user.role)
	users?: IUser[];
}
