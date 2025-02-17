import { IEntitySubscription } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SubscriptionService } from '../../subscription.service';
import { SubscriptionCreateCommand } from '../subscription.create.command';

@CommandHandler(SubscriptionCreateCommand)
export class SubscriptionCreateHandler implements ICommandHandler<SubscriptionCreateCommand> {
	constructor(private readonly subscriptionService: SubscriptionService) {}

	public async execute(command: SubscriptionCreateCommand): Promise<IEntitySubscription> {
		const { input } = command;

		return await this.subscriptionService.create(input);
	}
}
