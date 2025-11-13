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
		const { pluginId, tenantId, organizationId, userId, commandBus } = context;

		const data: CreatePluginSubscriptionPlanDTO = {
			...input,
			pluginId
		};

		await commandBus.execute(new CreatePluginSubscriptionPlanCommand(data, tenantId, organizationId, userId));
	}
}
