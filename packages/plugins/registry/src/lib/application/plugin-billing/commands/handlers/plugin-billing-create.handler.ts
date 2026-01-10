import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
	PluginBilling,
	PluginBillingCreatedEvent,
	PluginBillingFactory,
	PluginBillingService
} from '../../../../domain';
import { PluginBillingCreateCommand } from '../plugin-billing-create.command';

/**
 * Handler for creating plugin billing records
 * Implements CQRS pattern for separation of concerns
 */
@CommandHandler(PluginBillingCreateCommand)
export class PluginBillingCreateHandler implements ICommandHandler<PluginBillingCreateCommand> {
	private readonly logger = new Logger(PluginBillingCreateHandler.name);

	constructor(
		private readonly pluginBillingService: PluginBillingService,
		private readonly pluginBillingFactory: PluginBillingFactory,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Executes the billing creation command
	 * @param command - The billing creation command
	 * @returns The created billing record
	 */
	async execute(command: PluginBillingCreateCommand): Promise<PluginBilling> {
		const { input } = command;

		try {
			this.logger.log(`Creating billing record for subscription: ${input.subscriptionId}`);
			this.logger.debug(`Billing input: ${JSON.stringify(input)}`);

			// Validate billing input
			await this.validateBillingInput(input);

			// Use factory to create billing entity with business logic
			const billingData = await this.pluginBillingFactory.createFromInput(input);
			this.logger.debug(`Billing data after factory: ${JSON.stringify(billingData)}`);

			// Persist the billing record
			const billing = await this.pluginBillingService.create(billingData);

			this.logger.log(`Billing record created successfully: ${billing.id}`);

			// Publish domain event for billing creation
			await this.eventBus.publish(new PluginBillingCreatedEvent(billing));

			return billing;
		} catch (error) {
			this.logger.error(`Failed to create billing record: ${error.message}`, error.stack);
			throw new BadRequestException(`Failed to create billing record: ${error.message}`);
		}
	}

	/**
	 * Validates the billing input
	 * @param input - The billing creation input
	 */
	private async validateBillingInput(input: any): Promise<void> {
		if (!input.subscriptionId) {
			throw new BadRequestException('Subscription ID is required for billing creation');
		}

		if (!input.amount || input.amount <= 0) {
			throw new BadRequestException('Billing amount must be greater than zero');
		}

		if (!input.billingDate) {
			throw new BadRequestException('Billing date is required');
		}

		if (!input.dueDate) {
			throw new BadRequestException('Due date is required');
		}

		if (new Date(input.dueDate) < new Date(input.billingDate)) {
			throw new BadRequestException('Due date must be after billing date');
		}
	}
}
