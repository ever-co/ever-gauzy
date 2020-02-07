import {
	Entity,
	Index,
	Column,
	ManyToMany,
	JoinTable,
	RelationId,
	ManyToOne,
	JoinColumn
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeOffPolicy as ITimeOffPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { Employee } from '../employee';
import { Organization } from '../organization';

@Entity('time-off-policy')
export class TimeOffPolicy extends Base implements ITimeOffPolicy {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((policy: TimeOffPolicy) => policy.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column()
	requiresApproval: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column()
	paid: boolean;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'time-off-policy_employee'
	})
	employees?: Employee[];
}
