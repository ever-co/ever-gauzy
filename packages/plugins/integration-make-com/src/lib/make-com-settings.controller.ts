import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantPermissionGuard, Permissions } from '@gauzy/core';
import { ITenant, PermissionsEnum } from '@gauzy/contracts';
import { TenantDecorator } from '@gauzy/core';
import { MakeComSettingsService } from './make-com-settings.service';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';

@ApiTags('Make.com Integration')
@UseGuards(TenantPermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('integration/make-com')
export class MakeComSettingsController {
  constructor(
    private readonly settingsService: MakeComSettingsService
  ) {}

  @ApiOperation({ summary: 'Get Make.com integration settings for tenant' })
  @ApiResponse({
    status: 200,
    description: 'Retrieved tenant Make.com settings',
  })
  @Get()
  async getSettings(@TenantDecorator() tenant: ITenant) {
    return this.settingsService.getSettingsForTenant(tenant.id);
  }

  @ApiOperation({ summary: 'Update Make.com integration settings for tenant' })
  @ApiResponse({
    status: 200,
    description: 'Make.com settings updated successfully',
  })
  @Post()
  async updateSettings(
    @Body() input: UpdateMakeComSettingsDTO,
    @TenantDecorator() tenant: ITenant
  ) {
    return this.settingsService.updateSettings(tenant.id, input);
  }
}
