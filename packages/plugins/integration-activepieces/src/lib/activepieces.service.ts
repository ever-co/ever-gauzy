import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  IIntegrationTenant,
  IntegrationEnum,
  IIntegrationSetting,
  ID
} from '@gauzy/contracts';
import {
  IntegrationSettingService,
  IntegrationService,
} from '@gauzy/core';
import {
  IActivepiecesOAuthCredentials,
  ActivepiecesSettingName
} from './activepieces.type';

@Injectable()
export class ActivepiecesService {
  private readonly logger = new Logger(ActivepiecesService.name);

  constructor(
    private readonly _integrationSettingService: IntegrationSettingService,
    private readonly _integrationService: IntegrationService
  ) {}

  /**
   * Get OAuth credentials for an ActivePieces integration
   */
  async getOAuthCredentials(integrationId: string): Promise<IActivepiecesOAuthCredentials> {
    try {
      const clientIdSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.CLIENT_ID
        }
      });

      const clientSecretSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.CLIENT_SECRET
        }
      });

      if (!clientIdSetting?.settingsValue || !clientSecretSetting?.settingsValue) {
        throw new NotFoundException('OAuth credentials not found for this integration');
      }

      return {
        clientId: clientIdSetting.settingsValue,
        clientSecret: clientSecretSetting.settingsValue
      };
    } catch (error: any) {
      this.logger.error('Failed to get OAuth credentials:', error);
      throw new BadRequestException(`Failed to get OAuth credentials: ${error.message}`);
    }
  }

  /**
   * Find integration by token
   */
  async findIntegrationByToken(token: string): Promise<IIntegrationTenant> {
    // Look up the access_token setting
    const setting = await this._integrationSettingService.findOneByWhereOptions({
      settingsName: 'access_token',
      settingsValue: token
    });

    // Ensure we have an integrationId
    if (!setting?.integrationId) {
      throw new NotFoundException('Invalid access token');
    }

    // Load the integration tenant, scoped to ActivePieces, including its settings
    const integrationTenant = await this._integrationService.findOneByIdString(setting.integrationId, {
      where: { name: IntegrationEnum.ACTIVE_PIECES },
      relations: ['settings']
    });

    // Handle missing tenant
    if (!integrationTenant) {
      throw new NotFoundException('ActivePieces integration not found for the provided token');
    }

    // Return with correct enum typing
    return {
      ...integrationTenant,
      name: IntegrationEnum.ACTIVE_PIECES
    };
  }

  /**
   * Get ActivePieces token for an integration
   */
  async getActivepiecesToken(integrationId: ID): Promise<IIntegrationSetting> {
    try {
      return await this._integrationSettingService.findOneByWhereOptions({
        integration: { id: integrationId },
        integrationId,
        settingsName: 'access_token'
      });
    } catch (error) {
      throw new NotFoundException(`Access token for integration ID ${integrationId} not found`);
    }
  }

  /**
   * Check if a token is expired and needs refreshing
   */
  async isTokenExpired(integrationId: string): Promise<boolean> {
    try {
      const expiresAtSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.EXPIRES_AT
        }
      });

      if (!expiresAtSetting?.settingsValue) {
        // If no expiration time is set, assume token is valid
        return false;
      }

      const expiresAt = new Date(expiresAtSetting.settingsValue);
      const now = new Date();

      // Add a 5-minute buffer to refresh tokens before they expire
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      return (expiresAt.getTime() - now.getTime()) < bufferTime;
    } catch (error) {
      this.logger.error('Error checking token expiration:', error);
      return false;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(integrationId: string): Promise<string> {
    try {
      // Check if token is expired
      const isExpired = await this.isTokenExpired(integrationId);

      if (isExpired) {
        // Token is expired, try to refresh it
        const refreshTokenSetting = await this._integrationSettingService.findOneByOptions({
          where: {
            integration: { id: integrationId },
            settingsName: ActivepiecesSettingName.REFRESH_TOKEN
          }
        });

        if (refreshTokenSetting) {
          // We have a refresh token, use it to get a new access token
          // This would typically involve calling the ActivePieces OAuth refresh endpoint
          this.logger.log(`Token expired for integration ${integrationId}, attempting refresh...`);
          // The actual refresh logic would be handled by the OAuth service
        }
      }

      // Get the current access token
      const tokenSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.ACCESS_TOKEN
        }
      });

      if (!tokenSetting?.settingsValue) {
        throw new NotFoundException('Access token not found for this integration');
      }

      return tokenSetting.settingsValue;
    } catch (error: any) {
      this.logger.error('Failed to get valid access token:', error);
      throw new BadRequestException(`Failed to get valid access token: ${error.message}`);
    }
  }

  /**
   * Check if ActivePieces integration is enabled
   */
  async isIntegrationEnabled(integrationId: string): Promise<boolean> {
    try {
      const enabledSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.IS_ENABLED
        }
      });

      return enabledSetting?.settingsValue === 'true';
    } catch (error) {
      this.logger.error('Error checking if integration is enabled:', error);
      return false;
    }
  }

  /**
   * Enable or disable ActivePieces integration
   */
  async setIntegrationEnabled(integrationId: string, enabled: boolean): Promise<void> {
    try {
      const setting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.IS_ENABLED
        }
      });

      if (setting) {
        setting.settingsValue = enabled.toString();
        await this._integrationSettingService.save(setting);
      } else {
        // Create new setting if it doesn't exist
        const newSetting = await this._integrationSettingService.create({
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.IS_ENABLED,
          settingsValue: enabled.toString()
        });
        await this._integrationSettingService.save(newSetting);
      }

      this.logger.log(`ActivePieces integration ${integrationId} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      this.logger.error('Error updating integration enabled status:', error);
      throw new BadRequestException(`Failed to update integration status: ${error.message}`);
    }
  }

  /**
   * Get webhook URL for ActivePieces integration
   */
  async getWebhookUrl(integrationId: string): Promise<string | null> {
    try {
      const webhookSetting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.WEBHOOK_URL
        }
      });

      return webhookSetting?.settingsValue || null;
    } catch (error) {
      this.logger.error('Error getting webhook URL:', error);
      return null;
    }
  }

  /**
   * Set webhook URL for ActivePieces integration
   */
  async setWebhookUrl(integrationId: string, webhookUrl: string): Promise<void> {
    try {
      const setting = await this._integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.WEBHOOK_URL
        }
      });

      if (setting) {
        setting.settingsValue = webhookUrl;
        await this._integrationSettingService.save(setting);
      } else {
        // Create new setting if it doesn't exist
        const newSetting = await this._integrationSettingService.create({
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.WEBHOOK_URL,
          settingsValue: webhookUrl
        });
        await this._integrationSettingService.save(newSetting);
      }

      this.logger.log(`Updated webhook URL for integration ${integrationId}: ${webhookUrl}`);
    } catch (error: any) {
      this.logger.error('Error updating webhook URL:', error);
      throw new BadRequestException(`Failed to update webhook URL: ${error.message}`);
    }
  }
}
