import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationSetting } from '@gauzy/core';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

// Define Make.com integration setting names
export enum MakeSettingName {
  IS_ENABLED = 'make_webhook_enabled',
  WEBHOOK_URL = 'make_webhook_url'
}

@Injectable()
export class MakeComSettingsService {
  private readonly logger = new Logger(MakeComSettingsService.name);

  constructor(
    @InjectRepository(IntegrationSetting)
    private readonly settingsRepository: Repository<IntegrationSetting>
  ) {}

  /**
   * Get Make.com integration settings for a specific tenant
   */
  async getSettingsForTenant(tenantId: ID, organizationId?: ID): Promise<{
    isEnabled: boolean;
    webhookUrl: string;
  }> {
    try {
      // Get the enabled setting
      const enabledSetting = await this.findSetting(
        tenantId,
        organizationId,
        MakeSettingName.IS_ENABLED
      );

      // Get the webhook URL setting
      const webhookUrlSetting = await this.findSetting(
        tenantId,
        organizationId,
        MakeSettingName.WEBHOOK_URL
      );
      console.log('enabledSetting############', enabledSetting);

      return {
        isEnabled: enabledSetting?.settingsValue === 'true',
        webhookUrl: webhookUrlSetting?.settingsValue || null
      };
    } catch (error) {
      this.logger.warn(`Failed to get Make.com settings: ${error.message}`);
      // Return default values if settings not found
      return {
        isEnabled: false,
        webhookUrl: null
      };
    }
  }

  /**
   * Update Make.com integration settings for a tenant
   */
  async updateSettings(
    tenantId: ID,
    input: UpdateMakeComSettingsDTO,
    organizationId?: ID
  ): Promise<{
    isEnabled: boolean;
    webhookUrl: string;
  }> {
    // Update the enabled setting
    await this.upsertSetting(
      tenantId,
      organizationId,
      MakeSettingName.IS_ENABLED,
      input.isEnabled.toString()
    );

    // Update the webhook URL setting
    await this.upsertSetting(
      tenantId,
      organizationId,
      MakeSettingName.WEBHOOK_URL,
      input.webhookUrl || null
    );

    return {
      isEnabled: input.isEnabled,
      webhookUrl: input.webhookUrl || null
    };
  }

  /**
   * Find a setting by tenant, organization, and name
   */
  private async findSetting(
    tenantId: ID,
    organizationId: ID | null,
    settingsName: MakeSettingName
  ): Promise<IntegrationSetting | null> {
    const query: any = {
      tenantId,
      settingsName
    };

    if (organizationId) {
      query.organizationId = organizationId;
    }

    return this.settingsRepository.findOne({ where: query });
  }

  /**
   * Create or update a setting
   */
  private async upsertSetting(
    tenantId: ID,
    organizationId: ID | null,
    settingsName: MakeSettingName,
    settingsValue: string
  ): Promise<IntegrationSetting> {
    // First try to find the existing setting
    const existingSetting = await this.findSetting(tenantId, organizationId, settingsName);

    if (existingSetting) {
      // Update existing setting
      existingSetting.settingsValue = settingsValue;
      return this.settingsRepository.save(existingSetting);
    } else {
      // Create new setting
      const newSetting = this.settingsRepository.create({
        tenantId,
        organizationId: organizationId || null,
        settingsName,
        settingsValue
      });
      return this.settingsRepository.save(newSetting);
    }
  }
}
