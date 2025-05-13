import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException
} from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { TypeOrmActivepiecesWebhookSubscriptionRepository } from './repository/type-orm-activepieces-webhook-subscrption.repository';
import { ActivepiecesWebhookSubscription } from './activepieces-webhook-subscription.entity';
import {
  IActivepiecesWebhookData,
  IActivepiecesWebhookSubscriptionCreate
} from './activepieces.type';
import { AxiosError } from 'axios';

@Injectable()
export class ActivepiecesWebhookService {
  private readonly logger = new Logger(ActivepiecesWebhookService.name);

  constructor(
    private readonly activepiecesWebhookSubscriptionRepository: TypeOrmActivepiecesWebhookSubscriptionRepository,
    private readonly _httpService: HttpService
  ) {}

  /**
   * Creates a new ActivePieces webhook subscription
   */
  async createSubscription(input: IActivepiecesWebhookSubscriptionCreate): Promise<ActivepiecesWebhookSubscription> {
    try {
      const { targetUrl, events, organizationId, tenantId, integrationId } = input;

      // Check for existing subscription
      const existingSubscription = await this.activepiecesWebhookSubscriptionRepository.findOne({
        where: {
          targetUrl,
          events,
          organizationId,
          tenantId
        }
      });

      if (existingSubscription) {
        return existingSubscription;
      }

      // Create new subscription
      const newSubscription = this.activepiecesWebhookSubscriptionRepository.create({
        targetUrl,
        events,
        organizationId,
        tenantId,
        integrationId,
        isActive: true
      });

      return await this.activepiecesWebhookSubscriptionRepository.save(newSubscription);
    } catch (error) {
      this.logger.error('Failed to create webhook subscription', error);
      throw new InternalServerErrorException('Failed to create webhook subscription');
    }
  }

  /**
   * Deletes a webhook subscription
   */
  async deleteSubscription(id: ID, tenantId: ID): Promise<void> {
    try {
      const subscription = await this.activepiecesWebhookSubscriptionRepository.findOne({
        where: { id }
      });

      if (!subscription) {
        this.logger.warn(`No webhook subscription found with id ${id}`);
        throw new NotFoundException(`No webhook subscription found with id ${id}`);
      }

      if (subscription.tenantId !== tenantId) {
        this.logger.warn(`Unauthorized deletion attempt: Subscription ID ${id} does not belong to tenant ${tenantId}`);
        throw new ForbiddenException('You do not have permission to delete this webhook subscription.');
      }

      const result = await this.activepiecesWebhookSubscriptionRepository.delete(id);

      if (result.affected === 0) {
        this.logger.warn(`Deletion failed: No subscription deleted for id ${id}`);
        throw new NotFoundException(`No webhook subscription found with id ${id}`);
      }

      this.logger.log(`Successfully deleted webhook subscription with id ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
      throw new InternalServerErrorException('Failed to delete webhook subscription.');
    }
  }

  /**
   * Notifies ActivePieces about an event
   */
  async notifyEvent(eventType: string, data: IActivepiecesWebhookData): Promise<void> {
    const { tenantId, organizationId } = data;

    if (!tenantId || !organizationId) {
      this.logger.warn('Cannot notify webhook: missing tenantId or organizationId', { tenantId, organizationId });
      return;
    }

    // Find all subscriptions for this event and organization
    const subscriptions = await this.activepiecesWebhookSubscriptionRepository.find({
      where: {
        events: eventType,
        tenantId,
        organizationId,
        isActive: true
      }
    });

    if (subscriptions.length === 0) {
      return;
    }

    // Send notifications in parallel
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await firstValueFrom(
            this._httpService.post(subscription.targetUrl, {
              event: eventType,
              data,
              timestamp: new Date().toISOString()
            }).pipe(
              catchError((error) => {
                this.logger.error(
                  `Failed to notify webhook ${subscription.id} at ${subscription.targetUrl}`,
                  error
                );
                throw error;
              })
            )
          );
        } catch (error) {
          // Log error but don't throw to prevent other notifications from failing
          this.logger.error(
            `Webhook notification failed for subscription ${subscription.id}`,
            error
          );
        }
      })
    );
  }

  /**
   * Validate and update webhook subscription status
   */
  async validateWebhook(id: ID): Promise<boolean> {
    try {
      const subscription = await this.activepiecesWebhookSubscriptionRepository.findOne({
        where: { id }
      });

      if (!subscription) {
        return false;
      }

      // Simple ping to validate webhook endpoint
      const response = await firstValueFrom(
        this._httpService.get(subscription.targetUrl + '/health').pipe(
          catchError((error: AxiosError) => {
            // Mark as inactive if validation fails
            this.logger.error(`Webhook validation failed for subscription ${id}`, error.response?.data);
            return this.activepiecesWebhookSubscriptionRepository.update(id, { isActive: false });
          })
        )
      );
    } catch (error) {
      this.logger.error(`Webhook validation failed for subscription ${id}`, error);
    };
    return true;
  }

  /**
   * Get all active subscriptions for a tenant
   */
  async getActiveSubscriptions(tenantId: ID, organizationId?: ID): Promise<ActivepiecesWebhookSubscription[]> {
    const where: any = {
      tenantId,
      active: true
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.activepiecesWebhookSubscriptionRepository.find({ where });
  }
}
