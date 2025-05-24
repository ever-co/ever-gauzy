import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { AxiosError } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import {
  IntegrationEnum,
  IIntegrationEntitySetting,
  IntegrationEntity,
} from '@gauzy/contracts';
import {
  IntegrationService,
  IntegrationSettingService,
  IntegrationTenantUpdateOrCreateCommand,
  RequestContext,
  DEFAULT_ENTITY_SETTINGS,
  PROJECT_TIED_ENTITIES
} from '@gauzy/core';
import { ACTIVEPIECES_API_URL } from './activepieces.config';
import { IActivepiecesOAuthTokens, ActivepiecesSettingName } from './activepieces.type';
import { randomBytes } from 'node:crypto';
import { ActivepiecesService } from './activepieces.service';

@Injectable()
export class ActivepiecesOAuthService {
  private readonly logger = new Logger(ActivepiecesOAuthService.name);
  private pendingStates = new Map<string, { timestamp: number }>();

  constructor(
    private readonly httpService: HttpService,
    private readonly _config: ConfigService,
    private readonly commandBus: CommandBus,
    @Inject(forwardRef(() => ActivepiecesService))
    private readonly activepiecesService: ActivepiecesService,
    private readonly integrationService: IntegrationService,
    private readonly integrationSettingService: IntegrationSettingService
  ) {}

  /**
   * Generate the authorization URL for the ActivePieces OAuth flow.
   *
   * @param {string} [stateOverride] - Optional override for the state parameter.
   * @returns {string} The authorization URL to redirect the user to.
   */
  getAuthorizationUrl(stateOverride?: string): string {
    const clientId = this._config.get<string>('activepieces.clientId');
    if (!clientId) {
      throw new BadRequestException('ActivePieces client ID is not configured');
    }

    const redirectUri = this._config.get<string>('activepieces.redirectUri');
    if (!redirectUri) {
      throw new BadRequestException('ActivePieces redirect URI is not configured');
    }

    // Generate a random state parameter
    const state = stateOverride || this.generateRandomState();

    // Store the state in memory for verification
    this.storeStateForVerification(state);

    // Build the authorization URL with required parameters
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read write flows:manage',
      state
    });

    return `${ACTIVEPIECES_API_URL}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate a random state parameter to prevent CSRF attacks.
   *
   * @returns {string} A random string to use as the state parameter.
   */
  private generateRandomState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Store the state parameter for later verification.
   * TODO: Implement a more robust storage mechanism using Redis for scalability.
   *
   * @param {string} state - The state parameter to store.
   */
  private storeStateForVerification(state: string): void {
    this.pendingStates.set(state, { timestamp: Date.now() });
    this.cleanupExpiredStates();
  }

  /**
   * Clean up expired state parameters to prevent memory leaks.
   */
  private cleanupExpiredStates(): void {
    if (!this.pendingStates) return;

    const now = Date.now();
    const expirationTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    for (const [state, { timestamp }] of this.pendingStates.entries()) {
      if (now - timestamp > expirationTime) {
        this.pendingStates.delete(state);
      }
    }
  }

  /**
   * Exchange the authorization code for access and refresh tokens.
   *
   * @param {string} code - The authorization code received from ActivePieces.
   * @param {string} state - The state parameter for CSRF protection.
   * @returns {Promise<IActivepiecesOAuthTokens>} The token response.
   */
  async exchangeCodeForToken(code: string, state: string): Promise<IActivepiecesOAuthTokens> {
    try {
      // Verify state parameter to prevent CSRF attacks
      if (!this.verifyState(state)) {
        throw new BadRequestException('Invalid state parameter - possible CSRF attack');
      }

      const tenantId = RequestContext.currentTenantId();

      if (!tenantId) {
        throw new BadRequestException('Tenant ID not found in request context');
      }

      const clientId = this._config.get<string>('activepieces.clientId');
      const clientSecret = this._config.get<string>('activepieces.clientSecret');
      const redirectUri = this._config.get<string>('activepieces.redirectUri');

      if (!clientId || !clientSecret || !redirectUri) {
        throw new BadRequestException('ActivePieces OAuth credentials are not fully configured');
      }

      // Prepare the request body for token exchange
      const tokenRequestParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      });

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Exchange authorization code for tokens
      const tokenResponse = await firstValueFrom(
        this.httpService.post(`${ACTIVEPIECES_API_URL}/oauth/token`, tokenRequestParams, { headers }).pipe(
          catchError((error: AxiosError) => {
            this.logger.error('Error while exchanging code for token:', error.response?.data);
            throw new HttpException(
              `Failed to exchange authorization code: ${error.message}`,
              error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
          })
        )
      );

      // Save the tokens in the database
      await this.saveIntegrationSettings(tokenResponse.data, tenantId);
      return tokenResponse.data;
    } catch (error: any) {
      this.logger.error('Failed to exchange code for token:', error);
      throw new BadRequestException(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  /**
   * Verify the state parameter to prevent CSRF attacks.
   *
   * @param {string} state - The state parameter to verify.
   * @returns {boolean} True if the state parameter is valid, false otherwise.
   */
  verifyState(state: string): boolean {
    const pendingState = this.pendingStates.get(state);

    if (!pendingState) {
      this.logger.warn(`State ${state} not found in pending states`);
      return false;
    }

    const now = Date.now();
    const expirationTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (now - pendingState.timestamp > expirationTime) {
      this.logger.warn(`State ${state} has expired`);
      this.pendingStates.delete(state);
      return false;
    }

    // Valid and used - remove it to prevent reuse
    this.pendingStates.delete(state);
    return true;
  }

  /**
   * Save the OAuth tokens as integration settings.
   *
   * @param {IActivepiecesOAuthTokens} tokenData - The token data from ActivePieces.
   * @param {string} [organizationId] - The organization ID.
   * @returns {Promise<void>}
   */
  private async saveIntegrationSettings(tokenData: IActivepiecesOAuthTokens, organizationId?: string): Promise<void> {
    const tenantId = RequestContext.currentTenantId() || undefined;

    try {
      // Find existing ActivePieces integration or create it if it doesn't exist
      const integration = await this.integrationService.findOneByOptions({
        where: { provider: IntegrationEnum.ACTIVE_PIECES }
      }) || undefined;

      const tiedEntities = PROJECT_TIED_ENTITIES.map((entity) => ({
        ...entity,
        organizationId,
        tenantId
      }));

      // Prepare entity settings
      const entitySettings = DEFAULT_ENTITY_SETTINGS.map((settingEntity) => {
        if (settingEntity.entity === IntegrationEntity.PROJECT) {
          return {
            ...settingEntity,
            tiedEntities
          };
        }
        return {
          ...settingEntity,
          organizationId,
          tenantId
        };
      }) as IIntegrationEntitySetting[];

      // Calculate token expiration time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Define the settings to save
      const settings = [
        {
          settingsName: ActivepiecesSettingName.ACCESS_TOKEN,
          settingsValue: tokenData.access_token,
          tenantId: tenantId || undefined,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.REFRESH_TOKEN,
          settingsValue: tokenData.refresh_token,
          tenantId,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.TOKEN_TYPE,
          settingsValue: tokenData.token_type,
          tenantId,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.EXPIRES_IN,
          settingsValue: tokenData.expires_in.toString(),
          tenantId,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.EXPIRES_AT,
          settingsValue: expiresAt,
          tenantId,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.IS_ENABLED,
          settingsValue: 'true',
          tenantId,
          organizationId
        },
        {
          settingsName: ActivepiecesSettingName.WEBHOOK_URL,
          settingsValue: '',
          tenantId,
          organizationId
        }
      ];

      // Update or create the integration tenant with new settings
      await this.commandBus.execute(
        new IntegrationTenantUpdateOrCreateCommand(
          {
            name: IntegrationEnum.ACTIVE_PIECES,
            integration: { provider: IntegrationEnum.ACTIVE_PIECES },
            tenantId,
            organizationId
          },
          {
            name: IntegrationEnum.ACTIVE_PIECES,
            integration,
            tenantId,
            organizationId,
            entitySettings,
            settings
          }
        )
      );

      this.logger.log(`Successfully saved ${IntegrationEnum.ACTIVE_PIECES} OAuth tokens for tenant ${tenantId}`);
    } catch (error: any) {
      this.logger.error(`Failed to save ${IntegrationEnum.ACTIVE_PIECES} OAuth tokens:`, error);
      throw new BadRequestException(`Failed to save integration settings: ${error.message}`);
    }
  }

  /**
   * Refresh the access token for the ActivePieces integration.
   *
   * @param {string} integrationId - The ID of the integration to refresh the token for.
   * @returns {Promise<void>} A promise that resolves when the token has been refreshed.
   */
  async refreshToken(integrationId: string): Promise<void> {
    try {
      // Find the integration setting for refresh token
      const refreshTokenSetting = await this.integrationSettingService.findOneByOptions({
        where: {
          integration: { id: integrationId },
          settingsName: ActivepiecesSettingName.REFRESH_TOKEN
        }
      });

      if (!refreshTokenSetting) {
        throw new NotFoundException('Refresh token not found for this integration');
      }

      // Get OAuth credentials from the database
      const { clientId, clientSecret } = await this.activepiecesService.getOAuthCredentials(integrationId);

      // Create the form data for the token request
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('refresh_token', refreshTokenSetting.settingsValue);
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);

      // Send the token request
      const response = await firstValueFrom(
        this.httpService
          .post(`${ACTIVEPIECES_API_URL}/oauth/token`, formData, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          })
          .pipe(
            catchError((error: AxiosError) => {
              this.logger.error('Failed to refresh ActivePieces token:', error.response?.data);
              throw new Error(`Failed to refresh token: ${error.message}`);
            })
          )
      );

      // Extract the new tokens
      const { access_token, refresh_token, expires_in } = response.data;

      // Calculate the expiry time
      const expiresAt = new Date(Date.now() + Number(expires_in) * 1000);

      // Get the tenant and organization IDs from the existing settings
      const { tenantId, organizationId } = refreshTokenSetting;

      const settingsToUpdate = [
        {
          settingsName: ActivepiecesSettingName.ACCESS_TOKEN,
          settingsValue: access_token,
          tenantId,
          organizationId,
          integration: { name: IntegrationEnum.ACTIVE_PIECES }
        },
        {
          settingsName: ActivepiecesSettingName.REFRESH_TOKEN,
          settingsValue: refresh_token,
          tenantId,
          organizationId,
          integration: { name: IntegrationEnum.ACTIVE_PIECES }
        },
        {
          settingsName: ActivepiecesSettingName.EXPIRES_AT,
          settingsValue: expiresAt.toISOString(),
          tenantId,
          organizationId,
          integration: { name: IntegrationEnum.ACTIVE_PIECES }
        }
      ];

      await this.integrationSettingService.bulkUpdateOrCreate(integrationId, settingsToUpdate);

      this.logger.log(`Successfully refreshed token for integration: ${integrationId}`);
    } catch (error) {
      this.logger.error('Error refreshing ActivePieces token:', error);
      throw error;
    }
  }

  /**
   * Get the access token for an ActivePieces integration.
   *
   * @param {string} integrationId - The ID of the integration.
   * @returns {Promise<string>} The access token.
   */
  async getAccessToken(integrationId: string): Promise<string> {
    try {
      const setting = await this.integrationSettingService.findOneByWhereOptions({
        integration: { id: integrationId },
        integrationId,
        settingsName: ActivepiecesSettingName.ACCESS_TOKEN
      });

      if (!setting || !setting.settingsValue) {
        throw new BadRequestException('Access token not found for this integration');
      }

      return setting.settingsValue;
    } catch (error: any) {
      throw new BadRequestException(`Failed to get access token: ${error.message}`);
    }
  }
}
