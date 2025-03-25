import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZapierWebhookSubscription } from './repository/zapier-repository.entity';

@Injectable()
export class ZapierWebhookService {
    constructor(
        @InjectRepository(ZapierWebhookSubscription)
        private readonly subscriptionRepository: Repository<ZapierWebhookSubscription>
    ) {}

    async createSubscription(input: { targetUrl: string; event: string; integrationId?: string; tenantId?: string; organizationId?: string }): Promise<ZapierWebhookSubscription> {
        const subscription = this.subscriptionRepository.create(input);
        return await this.subscriptionRepository.save(subscription);
    }

    async findSubscriptions(options: { event?: string; integrationId?: string }): Promise<ZapierWebhookSubscription[]> {
        return await this.subscriptionRepository.find({ where: options });
    }

    async deleteSubscription(id: string): Promise<void> {
        await this.subscriptionRepository.delete(id);
    }
}
