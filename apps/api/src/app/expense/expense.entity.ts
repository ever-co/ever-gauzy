import {
    Column,
    Entity,
    Index,
    ManyToOne,
    RelationId,
    JoinColumn,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Base } from '../core/entities/base';
import { Expense as IExpense } from '@gauzy/models';
import { Organization } from '../organization';
import { Employee } from '../employee';

@Entity('expense')
export class Expense extends Base implements IExpense {
    @ApiModelProperty({ type: Employee })
    @ManyToOne(type => Employee, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    employee: Employee;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((expense: Expense) => expense.employee)
    readonly employeeId: string;

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

    @ApiModelProperty({ type: String })
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

    @ApiModelProperty({ type: String })
    @Index()
    @IsOptional()
    @Column({ nullable: true })
    categoryId?: string;

    @ApiModelProperty({ type: String })
    @Index()
    @IsOptional()
    @Column({ nullable: true })
    notes?: string;

    @ApiModelProperty({ type: Date })
    @IsDate()
    @IsOptional()
    @Column({ nullable: true })
    valueDate?: Date;
}
