import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationDepartment as IOrganizationDepartment } from '@gauzy/models'

@Entity('organization-department')
export class OrganizationDepartment extends Base implements IOrganizationDepartment {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;

    @ApiModelProperty({ type: Organization })
    @ManyToOne(type => Organization, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn()
    organization: Organization;
}
