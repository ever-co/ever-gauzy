import { CreatePluginSubscriptionPlanDTO, UpdatePluginSubscriptionPlanDTO } from '../../shared/dto';
import { CreateSubscriptionPlan } from './create-subscription-plan.strategy';
import {
	ISubscriptionPlanOperation,
	PlanOperationDTO,
	SubscriptionPlanOperationContext
} from './subscription-plan-operation.strategy';
import { UpdateSubscriptionPlanStrategy } from './update-subscription-plan.strategy';

/**
 * Factory for creating subscription plan operation strategies
 */
export class SubscriptionPlanOperationFactory {
	private static readonly createOperation = new CreateSubscriptionPlan();
	private static readonly updateOperation = new UpdateSubscriptionPlanStrategy();

	/**
	 * Get the appropriate strategy based on whether the plan has an ID
	 * @param planData - The plan data to check
	 * @returns The appropriate strategy for the operation
	 */
	static getOperation(planData: PlanOperationDTO): ISubscriptionPlanOperation {
		// If plan has an ID, use update strategy, otherwise use create strategy
		if (planData instanceof UpdatePluginSubscriptionPlanDTO && planData.id) {
			return this.updateOperation;
		}
		return this.createOperation;
	}

	/**
	 * Execute the appropriate strategy for the given plan data
	 * @param planData - The plan data to process
	 * @param context - The operation context
	 */
	static async execute(
		planData: CreatePluginSubscriptionPlanDTO | UpdatePluginSubscriptionPlanDTO,
		context: SubscriptionPlanOperationContext
	): Promise<void> {
		const strategy = this.getOperation(planData);
		await strategy.execute(planData, context);
	}
}
