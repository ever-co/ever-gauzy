import {
	Entity,
	Index,
	Column,
	JoinColumn,
	RelationId,
	ManyToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { UserOrganization as IUserOrganization } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { User } from '../user/user.entity';
import { Organization } from '../organization/organization.entity';

@Entity('user_organization')
export class UserOrganization extends Base implements IUserOrganization {
	@ApiProperty({ type: User })
	@ManyToOne((type) => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	user?: User;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	@RelationId((userOrganization: UserOrganization) => userOrganization.user)
	userId: string;

	@ApiProperty({ type: Organization })
	@ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	@RelationId(
		(userOrganization: UserOrganization) => userOrganization.organization
	)
	organizationId: string;

	@ApiProperty({ type: Boolean, default: true })
	@Index()
	@Column({ default: true })
	isDefault: boolean;

	@ApiProperty({ type: Boolean, default: true })
	@Index()
	@Column({ default: true })
	isActive: boolean;
}
