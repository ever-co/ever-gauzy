import { CreatePluginSubscriptionPlanDTO, IPluginSubscriptionPlan } from '../../../shared';
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
	async execute(
		input: CreatePluginSubscriptionPlanDTO,
		context: SubscriptionPlanOperationContext
	): Promise<IPluginSubscriptionPlan> {
		const { tenantId, organizationId, userId, commandBus, pluginId } = context;

		if (pluginId) {
			input.pluginId = pluginId;
		}

		// The pluginId should already be included in the input DTO
		return commandBus.execute(new CreatePluginSubscriptionPlanCommand(input, tenantId, organizationId, userId));
	}
}
