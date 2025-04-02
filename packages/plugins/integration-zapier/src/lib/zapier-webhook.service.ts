import { Injectable, Logger, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZapierWebhookSubscriptionRepository } from './repository/zapier-repository.entity';

@Injectable()
export class ZapierWebhookService {

    private readonly logger = new Logger(ZapierWebhookService.name)
    constructor(
        @InjectRepository(ZapierWebhookSubscriptionRepository)
        private readonly subscriptionRepository: Repository<ZapierWebhookSubscriptionRepository>,
    ) {}

    async createSubscription(input: {
        targetUrl: string;
        event: string;
        integrationId?: string;
        tenantId?: string;
        organizationId?: string
    }): Promise<ZapierWebhookSubscriptionRepository> {
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
                return;
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
            throw new Error('Failed to delete webhook subscription');
        }
    }
}
