import {
    Column,
    Entity,
    Index,
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max, IsDate, IsOptional } from 'class-validator';
import { Base } from '../core/entities/base';
import { EmployeeSettings as IEmployeeSettings } from '@gauzy/models';

@Entity('employee_settings')
export class EmployeeSettings extends Base implements IEmployeeSettings {
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
    settingType: string;

    @ApiModelProperty({ type: Number })
    @IsNumber()
    @IsNotEmpty()
    @Column()
    value: number;

    @ApiModelPropertyOptional({ type: Date })
    @IsDate()
    @IsOptional()
    @Column({ nullable: true })
    valueDate?: Date;
}
