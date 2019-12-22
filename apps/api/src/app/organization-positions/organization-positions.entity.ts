import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationPositions as IOrganizationPositions } from '@gauzy/models'

@Entity('organization_positions')
export class OrganizationPositions extends Base implements IOrganizationPositions {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;

    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    organizationId: string;
}
