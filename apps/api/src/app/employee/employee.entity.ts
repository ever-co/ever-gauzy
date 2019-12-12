import {
	CurrenciesEnum,
	Employee as IEmployee,
	PayPeriodEnum
} from '@gauzy/models';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
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
	@ApiModelProperty({ type: User })
	@OneToOne((type) => User, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	user: User;

	@ApiModelProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.user)
	readonly userId: string;

	@ApiModelProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiModelProperty({ type: String, readOnly: true })
	@RelationId((employee: Employee) => employee.organization)
	readonly orgId: string;

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiModelPropertyOptional({ type: Boolean, default: true })
	@Column({ nullable: true, default: true })
	isActive: boolean;

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	endWork?: Date;

	@ApiModelProperty({ type: String, enum: PayPeriodEnum })
	@IsEnum(PayPeriodEnum)
	@IsOptional()
	@Column({ nullable: true })
	payPeriod?: string;

	@ApiModelProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ type: 'numeric', nullable: true })
	billRateValue?: number;

	@ApiModelProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@Column({ nullable: true })
	billRateCurrency?: string;

	@ApiModelProperty({ type: Number })
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
