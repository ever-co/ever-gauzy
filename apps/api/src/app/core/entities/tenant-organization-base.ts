import { ApiProperty } from '@nestjs/swagger';
import { Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { Organization } from '../../organization/organization.entity';
import { IsOptional, IsString } from 'class-validator';
import { TenantBase } from './tenant-base';

export abstract class TenantOrganizationBase extends TenantBase {
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
}
