import { Entity, Index, Column, ManyToMany, JoinTable } from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeOffPolicy as ITimeOffPolicy } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { Employee } from '../employee';

@Entity('time-off-policy')
export class TimeOffPolicy extends Base implements ITimeOffPolicy {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
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
