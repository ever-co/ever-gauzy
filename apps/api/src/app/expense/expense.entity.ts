import {
    Column,
    Entity,
    Index,
    ManyToOne,
    RelationId,
    JoinColumn,
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDate, IsEnum } from 'class-validator';
import { Base } from '../core/entities/base';
import { Expense as IExpense, CurrenciesEnum } from '@gauzy/models';
import { Organization } from '../organization';
import { Employee } from '../employee';

@Entity('expense')
export class Expense extends Base implements IExpense {
    @ApiModelProperty({ type: Employee })
    @ManyToOne(type => Employee, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn()
    employee?: Employee;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((expense: Expense) => expense.employee)
    @Column({ nullable: true })
    readonly employeeId?: string;

    @ApiModelProperty({ type: Organization })
    @ManyToOne(type => Organization, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    organization: Organization;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((expense: Expense) => expense.organization)
    readonly orgId: string;

    @ApiModelProperty({ type: Number })
    @IsNumber()
    @IsNotEmpty()
    @Index()
    @Column()
    amount: number;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    vendorName: string;

    @ApiModelPropertyOptional({ type: String })
    @Index()
    @IsOptional()
    @Column({ nullable: true })
    vendorId?: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    categoryName: string;

    @ApiModelPropertyOptional({ type: String })
    @Index()
    @IsOptional()
    @Column({ nullable: true })
    categoryId?: string;

    @ApiModelPropertyOptional({ type: String })
    @Index()
    @IsOptional()
    @Column({ nullable: true })
    notes?: string;

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
}
