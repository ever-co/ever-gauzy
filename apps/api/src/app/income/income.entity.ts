import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    UpdateDateColumn,
    JoinColumn,
    RelationId,
    ManyToOne,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Base } from '../core/entities/base';
import { Income as IIncome } from '@gauzy/models';
import { Employee } from '../employee';
import { Organization } from '../organization';

@Entity('income')
export class Income extends Base implements IIncome {
    @ApiModelProperty({ type: Employee })
    @ManyToOne(type => Employee, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    employee: Employee;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((income: Income) => income.employee)
    readonly employeeId: string;

    @ApiModelProperty({ type: Organization })
    @ManyToOne(type => Organization, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    organization: Organization;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((income: Income) => income.organization)
    readonly orgId: string;

    @ApiModelProperty({ type: Number })
    @IsNumber()
    @IsNotEmpty()
    @Index()
    @Column()
    amount: number;

    @ApiModelProperty({ type: String })
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

    @ApiModelProperty({ type: Date })
    @IsDate()
    @IsOptional()
    @Column({ nullable: true })
    valueDate?: Date;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt?: Date;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt?: Date;
}
