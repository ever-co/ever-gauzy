import { UpdatePluginSubscriptionPlanDTO } from '../../../shared';
import { UpdatePluginSubscriptionPlanCommand } from '../../plugin-subscription';
import { ISubscriptionPlanOperation, SubscriptionPlanOperationContext } from './subscription-plan-operation.strategy';

/**
 * Strategy for updating existing subscription plans
 */
export class UpdateSubscriptionPlanStrategy implements ISubscriptionPlanOperation {
	/**
	 * Update an existing subscription plan
	 * @param data - The plan data to update (must include id)
	 * @param context - The operation context
	 */
	async execute(data: UpdatePluginSubscriptionPlanDTO, context: SubscriptionPlanOperationContext): Promise<void> {
		const { commandBus } = context;

		if (!data.id) {
			throw new Error('Plan ID is required for update operation');
		}

		await commandBus.execute(new UpdatePluginSubscriptionPlanCommand(data.id, data));
	}
}
