import {
	CurrenciesEnum,
	Employee as IEmployee,
	PayPeriodEnum
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';
import {
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToOne,
	RelationId
} from 'typeorm';
import { Base } from '../core/entities/base';
import { Organization } from '../organization';
import { OrganizationTeams } from '../organization-teams/organization-teams.entity';
import { User } from '../user';

@Entity('employee')
export class Employee extends Base implements IEmployee {
	@ApiProperty({ type: User })
	@OneToOne((type) => User, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.user)
	readonly userId: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.organization)
	readonly orgId: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endWork?: Date;

	@ApiProperty({ type: String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	billRateValue?: number;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@Column({ nullable: true })
	billRateCurrency?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	reWeeklyLimit?: number;

	@ManyToMany((type) => OrganizationTeams) // , orgTeams => orgTeams.members
	@JoinTable({
		name: 'organization_team_employee'
	})
	teams?: OrganizationTeams[];
}
