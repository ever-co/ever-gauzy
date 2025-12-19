import { ID } from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import {
	CreatePluginSubscriptionPlanDTO,
	IPluginSubscriptionPlan,
	UpdatePluginSubscriptionPlanDTO
} from '../../../shared';

export type PlanOperationDTO = CreatePluginSubscriptionPlanDTO | UpdatePluginSubscriptionPlanDTO;
/**
 * Interface for subscription plan operation strategy
 */
export interface ISubscriptionPlanOperation {
	/**
	 * Execute the subscription plan operation
	 * @param data - The plan data to process
	 * @param context - Additional context needed for the operation
	 * @returns Promise that resolves when operation is complete
	 */
	execute(data: PlanOperationDTO, context: SubscriptionPlanOperationContext): Promise<IPluginSubscriptionPlan>;
}

/**
 * Context data needed for subscription plan operations
 */
export interface SubscriptionPlanOperationContext {
	pluginId: ID;
	tenantId?: ID;
	organizationId?: ID;
	userId?: ID;
	commandBus: CommandBus;
	planId?: ID; // Required for update operations
}
