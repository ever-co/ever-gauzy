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
import { OrganizationVendors as IOrganizationVendors } from '@gauzy/models'

@Entity('organization_vendors')
export class OrganizationVendors extends Base implements IOrganizationVendors {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    organizationId: string;
}
