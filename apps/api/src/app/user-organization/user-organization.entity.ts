import {
	Entity,
	Index,
	Column,
	ManyToOne,
	ManyToMany,
	JoinColumn,
	RelationId,
	OneToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { UserOrganization as IUserOrganization } from '@gauzy/models';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { User } from '../user';

@Entity('user_organization')
export class UserOrganization extends Base implements IUserOrganization {
	@ApiModelProperty({ type: User })
	@OneToOne((type) => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	user?: User;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	@RelationId((userOrganization: UserOrganization) => userOrganization.user)
	userId: string;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	orgId: string;

	@ApiModelProperty({ type: Boolean, default: true })
	@Index()
	@Column({ default: true })
	isDefault: boolean;

	@ApiModelProperty({ type: Boolean, default: true })
	@Index()
	@Column({ default: true })
	isActive: boolean;
}
