import { UpdatePluginSubscriptionPlanDTO } from '../../../shared';
import { UpdatePluginSubscriptionPlanCommand } from '../../plugin-subscription';
import { ISubscriptionPlanOperation, SubscriptionPlanOperationContext } from './subscription-plan-operation.strategy';

/**
 * Strategy for updating existing subscription plans
 */
export class UpdateSubscriptionPlanStrategy implements ISubscriptionPlanOperation {
	/**
	 * Update an existing subscription plan
	 * @param data - The plan data to update
	 * @param context - The operation context (should include planId for updates)
	 */
	async execute(data: UpdatePluginSubscriptionPlanDTO, context: SubscriptionPlanOperationContext): Promise<void> {
		const { commandBus, planId = data.id } = context;

		if (!planId) {
			throw new Error('Plan ID is required for update operation');
		}

		await commandBus.execute(new UpdatePluginSubscriptionPlanCommand(planId, data));
	}
}
