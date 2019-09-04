import {
    Column,
    Entity,
    Index,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { Base } from '../core/entities/base';
import { EmployeeRecurringExpense as IEmployeeRecurringExpense, CurrenciesEnum } from '@gauzy/models';

@Entity('employee_recurring_expense')
export class EmployeeRecurringExpense extends Base implements IEmployeeRecurringExpense {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    employeeId: string;

    @ApiModelProperty({ type: Number, minimum: 1, maximum: 12 })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    @Max(12)
    @Column()
    month: number;

    @ApiModelProperty({ type: Number, minimum: 1 })
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    @Column()
    year: number;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    categoryName: string;

    @ApiModelProperty({ type: Number })
    @IsNumber()
    @IsNotEmpty()
    @Column()
    value: number;

    @ApiModelProperty({ type: String, enum: CurrenciesEnum })
    @IsEnum(CurrenciesEnum)
    @IsNotEmpty()
    @Index()
    @Column()
    currency: string;
}
