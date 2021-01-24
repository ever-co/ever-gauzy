import {
	Column,
	Entity,
	Index,
	JoinColumn,
	RelationId,
	ManyToOne,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsDate,
	IsEnum,
	IsBoolean
} from 'class-validator';
import { IIncome, CurrenciesEnum } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('income')
export class Income extends TenantOrganizationBaseEntity implements IIncome {
	constructor(input?: DeepPartial<Income>) {
		super(input);
	}

	@ManyToMany(() => Tag, (tag) => tag.income)
	@JoinTable({
		name: 'tag_income'
	})
	tags: Tag[];

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((income: Income) => income.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	amount: number;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	clientId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	clientName: string;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	isBonus: boolean;

	@ApiPropertyOptional({ type: String, maxLength: 256 })
	@IsOptional()
	@Column({ nullable: true })
	reference?: string;
}
