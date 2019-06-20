import {
    CreateDateColumn,
    Entity,
    UpdateDateColumn,
    Index,
    Column,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Employee as IEmployee } from '@gauzy/models';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('employee')
export class Employee extends Base implements IEmployee {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    userId: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    orgId: string;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt?: Date;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt?: Date;
}
