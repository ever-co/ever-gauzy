import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Goal as IGoal } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { KeyResult } from '../keyresult/keyresult.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';

@Entity('goal')
export class Goal extends TenantBase implements IGoal {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	@IsOptional()
	description?: string;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	owner: string;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	lead: string;

	@ApiProperty({ type: String })
	@Column()
	deadline: string;

	@ApiProperty({ type: String })
	@Column()
	level: string;

	@ApiProperty({ type: Number })
	@Column()
	progress: number;

	@ApiProperty({ type: String })
	@Column()
	organizationId: string;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;

	@ApiProperty({ type: KeyResult })
	@OneToMany((type) => KeyResult, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResult[];
}
