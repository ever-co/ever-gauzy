import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MakeComIntegrationSetting } from './make-com-settings.entity';
import { UpdateMakeComSettingsDTO } from './dto/update-make-com-settings.dto';
import { ID } from '@gauzy/contracts';

@Injectable()
export class MakeComSettingsService {
  constructor(
    @InjectRepository(MakeComIntegrationSetting)
    private readonly settingsRepository: Repository<MakeComIntegrationSetting>
  ) {}

  /**
   * Get Make.com integration settings for a specific tenant
   */
  async getSettingsForTenant(tenantId: ID): Promise<MakeComIntegrationSetting> {
    let settings = await this.settingsRepository.findOne({
      where: { tenantId }
    });

    // Create default settings if none exist
    if (!settings) {
      settings = this.settingsRepository.create({
        tenantId,
        isEnabled: false
      });
      await this.settingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Update Make.com integration settings for a tenant
   */
  async updateSettings(
    tenantId: ID,
    input: UpdateMakeComSettingsDTO
  ): Promise<MakeComIntegrationSetting> {
    let settings = await this.getSettingsForTenant(tenantId);

    // Update settings with new values
    settings.isEnabled = input.isEnabled;
    if (input.webhookUrl !== undefined) {
      settings.webhookUrl = input.webhookUrl;
    }

    return this.settingsRepository.save(settings);
  }
}
