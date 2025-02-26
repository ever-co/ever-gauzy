import { Entity, Column, Index } from 'typeorm';
import { IIntegrationSetting, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional, IsUUID } from 'class-validator';
import { TenantBaseEntity } from '@gauzy/core';

@Entity('make_com_integration_setting')
@Index(['tenantId'], { unique: true })
export class MakeComIntegrationSetting extends TenantBaseEntity
implements IIntegrationSetting {
  settingsName: string;
  settingsValue: string;
  organizationId?: string;
  organization?: IOrganization;
  integration?: IIntegrationTenant;
  integrationId?: string;
  @ApiProperty({ type: () => Boolean, default: false })
  @IsBoolean()
  @Column({ default: false })
  isEnabled: boolean;

  @ApiProperty({ type: () => String })
  @IsString()
  @IsOptional()
  @Column({ nullable: true })
  webhookUrl?: string;
}
