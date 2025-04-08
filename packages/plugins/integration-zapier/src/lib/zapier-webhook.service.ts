import { Injectable, Logger, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';
import { TypeOrmZapierWebhookSubscriptionRepository } from './repository/type-orm-zapier.repository';

@Injectable()
export class ZapierWebhookService {
    private readonly logger = new Logger(ZapierWebhookService.name);

    constructor(
        private readonly subscriptionRepository: TypeOrmZapierWebhookSubscriptionRepository,
    ) { }

    async createSubscription(input: {
        targetUrl: string;
        event: string;
        integrationId?: ID;
        tenantId?: ID;
        organizationId?: ID
    }): Promise<ZapierWebhookSubscription> {
        try {
            // Check if subscription already exists to avoid duplicates
            const existing = await this.subscriptionRepository.findOne({
                where: {
                    targetUrl: input.targetUrl,
                    event: input.event,
                    integrationId: input.integrationId,
                    tenantId: input.tenantId,
                    organizationId: input.organizationId
                }
            });

            if (existing) {
                return existing;
            }

            const subscription = this.subscriptionRepository.create(input);
            return await this.subscriptionRepository.save(subscription);
        } catch (error) {
            this.logger.error('Failed to create webhook subscription', error);
            throw new InternalServerErrorException('Failed to create webhook subscription');
        }
    }

    async deleteSubscription(id: string, tenantId: string): Promise<void> {
        try {
            // First find the subscription to verify ownership
            const subscription = await this.subscriptionRepository.findOne({
                where: { id }
            });

            if (!subscription) {
                this.logger.warn(`No webhook subscription found with id ${id}`);
                throw new NotFoundException(`No webhook subscription found with id ${id}`);
            }

            // Verify tenant ownership
            if (subscription.tenantId !== tenantId) {
                this.logger.warn(`Attempted to delete webhook subscription ${id} from different tenant ${tenantId}`);
                throw new ForbiddenException('You do not have permission to delete this webhook subscription');
            }

            // Delete the subscription if ownership is verified
            const result = await this.subscriptionRepository.delete(id);
            if (result.affected === 0) {
                throw new NotFoundException('No webhook subscription found');
            }
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
            throw new InternalServerErrorException('Failed to delete webhook subscription');
        }
    }

    /**
     * Notify subscribers about timer status change
     *
     * @param payload The data to send to webhooks
     */
    async notifyTimerStatusChanged(timerData: any): Promise<void> {
        try {
          // Find all webhook subscriptions for timer status events
          const subscriptions = await this.subscriptionRepository.find({
            where: {
              event: 'timer.status.changed',
              tenantId: timerData.tenantId,
              organizationId: timerData.organizationId
            }
          });

          if (!subscriptions || subscriptions.length === 0) {
            return;
          }

          // Notify each subscriber
          for (const subscription of subscriptions) {
            try {
              await this._httpService.post(subscription.targetUrl, {
                event: 'timer.status.changed',
                data: timerData
              }).pipe(
                catchError(error => {
                  this.logger.error(
                    `Failed to notify webhook ${subscription.id} at ${subscription.targetUrl}`,
                    error
                  );
                  return of(null);
                })
              ).toPromise();
            } catch (error) {
              this.logger.error(`Error notifying webhook ${subscription.id}`, error);
              // Continue with other webhooks even if this one fails
            }
          }
        } catch (error) {
          this.logger.error('Failed to process timer status change webhooks', error);
        }
      }
}
