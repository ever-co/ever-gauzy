import {
    Entity,
    Column,
    JoinColumn,
    OneToOne,
    RelationId,
    ManyToOne,
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { Employee as IEmployee } from '@gauzy/models';
import { IsDate, IsOptional } from 'class-validator';
import { User } from '../user';
import { Organization } from '../organization';

@Entity('employee')
export class Employee extends Base implements IEmployee {
    @ApiModelProperty({ type: User })
    @OneToOne(type => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    user: User;

    @ApiModelProperty({ type: String, readOnly: true })
    @RelationId((employee: Employee) => employee.user)
    readonly userId: string;

    @ApiModelProperty({ type: Organization })
    @ManyToOne(type => Organization, { nullable: false, onDelete: 'CASCADE' })
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
}
