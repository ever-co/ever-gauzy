import { Injectable, Logger } from '@nestjs/common';
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
            throw new Error('Failed to create webhook subscription');
        }
    }

    async findSubscriptions(options: { event?: string; integrationId?: string }): Promise<ZapierWebhookSubscriptionRepository[]> {
        try {
            return await this.subscriptionRepository.find({ where: options });
        } catch (error) {
            this.logger.error('Failed to find webhook subscriptions', error);
            throw new Error('Failed to find webhook subscriptions');
        }
    }

    async deleteSubscription(id: string): Promise<void> {
        try {
            const result = await this.subscriptionRepository.delete(id);
            if (result.affected === 0) {
                this.logger.warn(`No webhook subscription found with id ${id}`);
            }
        } catch (error) {
            this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
            throw new Error('Failed to delete webhook subscription');
        }
    }
}
