import { CreatePluginSubscriptionPlanDTO } from '../../../shared';
import { CreatePluginSubscriptionPlanCommand } from '../../plugin-subscription';
import { ISubscriptionPlanOperation, SubscriptionPlanOperationContext } from './subscription-plan-operation.strategy';

/**
 * Strategy for creating new subscription plans
 */
export class CreateSubscriptionPlan implements ISubscriptionPlanOperation {
	/**
	 * Create a new subscription plan
	 * @param input - The plan data to create
	 * @param context - The operation context containing pluginId, tenantId, etc.
	 */
	async execute(input: CreatePluginSubscriptionPlanDTO, context: SubscriptionPlanOperationContext): Promise<void> {
		const { tenantId, organizationId, userId, commandBus } = context;

		// The pluginId should already be included in the input DTO
		await commandBus.execute(new CreatePluginSubscriptionPlanCommand(input, tenantId, organizationId, userId));
	}
}
