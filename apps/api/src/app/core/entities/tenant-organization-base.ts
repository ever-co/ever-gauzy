import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Base } from './base';
import { Organization } from '../../organization/organization.entity';
import { IsOptional, IsString } from 'class-validator';

export abstract class TenantOrganizationBase extends Base {
  @ApiProperty({ type: Organization })
  @ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  @IsOptional()
  organization?: Organization;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId(
    (it: TenantOrganizationBase) =>
      it.organization
  )
  @IsString()
  @IsOptional()
  @Column({ nullable: true })
  organizationId: string;

  @ApiProperty({ type: Tenant })
  @ManyToOne((type) => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn()
  tenant: Tenant;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId(
    (it: TenantOrganizationBase) =>
      it.tenant
  )
  @IsString()
  @Column()
  tenantId: string;
}
