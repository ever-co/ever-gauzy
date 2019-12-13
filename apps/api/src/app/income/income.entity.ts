import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsDate,
	IsEnum
} from 'class-validator';
import { Base } from '../core/entities/base';
import { Income as IIncome, CurrenciesEnum } from '@gauzy/models';
import { Employee } from '../employee';
import { Organization } from '../organization';

@Entity('income')
export class Income extends Base implements IIncome {
	@ApiModelProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: Employee;

	@ApiModelProperty({ type: String, readOnly: true })
	@RelationId((income: Income) => income.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiModelProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiModelProperty({ type: String, readOnly: true })
	@RelationId((income: Income) => income.organization)
	readonly orgId: string;

	@ApiModelProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	amount: number;

	@ApiModelPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	clientId?: string;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	clientName: string;

	@ApiModelProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiModelPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiModelPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;
}
