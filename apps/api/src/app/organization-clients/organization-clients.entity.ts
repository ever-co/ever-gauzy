import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsNumber } from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationClients as IOrganizationClients } from '@gauzy/models'
import { OrganizationProjects } from '../organization-projects';

@Entity('organization_clients')
export class OrganizationClients extends Base implements IOrganizationClients {
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

    @ApiModelProperty({ type: String })
    @IsEmail()
    @IsNotEmpty()
    @Column()
    primaryEmail: string;

    @ApiModelPropertyOptional({ type: String, isArray: true })
    emailAddresses?: string[];

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    primaryPhone: string;

    @ApiModelPropertyOptional({ type: String, isArray: true })
    phones?: string[];

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    country: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    street: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Column()
    city: string;

    @ApiModelPropertyOptional({ type: Number })
    @IsNumber()
    @IsOptional()
    @Column({ nullable: true })
    zipCode?: number;

    @ApiModelPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    @Column({ nullable: true })
    state?: string;

    @ApiModelPropertyOptional({ type: OrganizationProjects, isArray: true })
    @OneToMany(_ => OrganizationProjects, projects => projects.client)
    projects?: OrganizationProjects[];

    @ApiModelPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    @Column({ nullable: true })
    notes?: string;
}
