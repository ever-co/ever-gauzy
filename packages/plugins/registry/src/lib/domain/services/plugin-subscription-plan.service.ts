import { ID, PluginSubscriptionType } from '@gauzy/contracts';
import { CrudService } from '@gauzy/core';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindManyOptions, FindOneOptions, MoreThan } from 'typeorm';
import {
	IPluginSubscriptionPlan,
	IPluginSubscriptionPlanCreateInput,
	IPluginSubscriptionPlanFindInput,
	IPluginSubscriptionPlanUpdateInput
} from '../../shared/models/plugin-subscription.model';
import { PluginSubscriptionPlan } from '../entities/plugin-subscription-plan.entity';
import { MikroOrmPluginSubscriptionPlanRepository, TypeOrmPluginSubscriptionPlanRepository } from '../repositories';

@Injectable()
export class PluginSubscriptionPlanService extends CrudService<PluginSubscriptionPlan> {
	constructor(
		public readonly typeOrmPluginSubscriptionPlanRepository: TypeOrmPluginSubscriptionPlanRepository,
		public readonly mikroOrmPluginSubscriptionPlanRepository: MikroOrmPluginSubscriptionPlanRepository
	) {
		super(typeOrmPluginSubscriptionPlanRepository, mikroOrmPluginSubscriptionPlanRepository);
	}

	/**
	 * Create a new plugin subscription plan
	 */
	async createPlan(
		createInput: Partial<IPluginSubscriptionPlanCreateInput> & {
			name: string;
			pluginId: ID;
		}
	): Promise<IPluginSubscriptionPlan> {
		try {
			// Validate that the plan name is unique per plugin
			const existingPlan = await this.findOneOrFailByWhereOptions({
				pluginId: createInput.pluginId,
				name: createInput.name
			});

			if (existingPlan.success) {
				throw new BadRequestException(`A plan with name "${createInput.name}" already exists for this plugin`);
			}
			// Create and save the new plan
			const newPlan = PluginSubscriptionPlan.create(createInput);
			return this.save(newPlan);
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to create subscription plan: ${error.message}`);
		}
	}

	/**
	 * Update an existing plugin subscription plan
	 */
	async updatePlan(id: ID, updateInput: IPluginSubscriptionPlanUpdateInput): Promise<IPluginSubscriptionPlan> {
		try {
			const { success: isExists, record: existingPlan } = await this.findOneOrFailByIdString(id);

			if (!isExists) {
				throw new NotFoundException(`Subscription plan with ID ${id} not found`);
			}

			// If updating name, ensure uniqueness per plugin
			if (updateInput.name && updateInput.name !== existingPlan.name) {
				const { record: duplicatePlan, success } = await this.findOneOrFailByWhereOptions({
					pluginId: existingPlan.pluginId,
					name: updateInput.name
				});

				if (success && duplicatePlan.id !== id) {
					throw new BadRequestException(
						`A plan with name "${updateInput.name}" already exists for this plugin`
					);
				}
			}

			// Update the plan
			await this.update(id, updateInput);
			return await this.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to update subscription plan: ${error.message}`);
		}
	}

	/**
	 * Delete a plugin subscription plan
	 */
	async deletePlan(id: ID): Promise<void> {
		try {
			const plan = await this.findOneByIdString(id);
			if (!plan) {
				throw new NotFoundException(`Subscription plan with ID ${id} not found`);
			}

			// Check if plan has active subscriptions
			// Note: This should be implemented when subscription relationships are available
			// const activeSubscriptions = await this.checkActiveSubscriptions(id);
			// if (activeSubscriptions > 0) {
			//     throw new BadRequestException('Cannot delete plan with active subscriptions');
			// }

			await this.delete(id);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to delete subscription plan: ${error.message}`);
		}
	}

	/**
	 * Check if a plugin has any subscription plans
	 * @param pluginId - The plugin ID
	 * @returns Promise<boolean> indicating if the plugin has any plans
	 */
	async hasPlans(pluginId: ID): Promise<boolean> {
		try {
			const count = await this.count({
				where: { pluginId }
			});
			return count > 0;
		} catch (error) {
			// If there's an error checking, default to false (treat as free plugin)
			console.error(`Error checking if plugin ${pluginId} has plans:`, error);
			return false;
		}
	}

	/**
	 * Get subscription plans by plugin ID
	 */
	async getByPluginId(
		pluginId: ID,
		relations: string[] = [],
		onlyActive: boolean = true
	): Promise<IPluginSubscriptionPlan[]> {
		try {
			const queryOptions: FindManyOptions<PluginSubscriptionPlan> = {
				where: {
					pluginId,
					...(onlyActive && { isActive: true })
				},
				relations,
				order: {
					sortOrder: 'ASC',
					price: 'ASC'
				}
			};

			return await this.find(queryOptions);
		} catch (error) {
			throw new BadRequestException(`Failed to get plans for plugin ${pluginId}: ${error.message}`);
		}
	}

	/**
	 * Get active plans with optional filtering
	 */
	async getActivePlans(
		pluginId?: ID,
		type?: PluginSubscriptionType,
		relations: string[] = []
	): Promise<IPluginSubscriptionPlan[]> {
		try {
			const queryOptions: FindManyOptions<PluginSubscriptionPlan> = {
				where: {
					isActive: true,
					...(pluginId && { pluginId }),
					...(type && { type })
				},
				relations,
				order: {
					sortOrder: 'ASC',
					price: 'ASC'
				}
			};

			return await this.find(queryOptions);
		} catch (error) {
			throw new BadRequestException(`Failed to get active plans: ${error.message}`);
		}
	}

	/**
	 * Copy a subscription plan
	 */
	async copyPlan(
		sourcePlanId: ID,
		newName: string,
		newDescription?: string,
		newPrice?: number,
		tenantId?: ID,
		organizationId?: ID
	): Promise<IPluginSubscriptionPlan> {
		try {
			const sourcePlan = await this.findOneByIdString(sourcePlanId);
			if (!sourcePlan) {
				throw new NotFoundException(`Source plan with ID ${sourcePlanId} not found`);
			}

			// Check if new name already exists for this plugin
			const existingPlan = await this.typeOrmRepository.findOne({
				where: {
					pluginId: sourcePlan.pluginId,
					name: newName
				}
			});

			if (existingPlan) {
				throw new BadRequestException(`A plan with name "${newName}" already exists for this plugin`);
			}

			// Create new plan based on source
			const newPlan = PluginSubscriptionPlan.create({
				...sourcePlan,
				id: undefined, // Remove ID to create new entity
				name: newName,
				description: newDescription || sourcePlan.description,
				price: newPrice !== undefined ? newPrice : sourcePlan.price,
				createdAt: undefined,
				updatedAt: undefined
			});

			return this.save(newPlan);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to copy subscription plan: ${error.message}`);
		}
	}

	/**
	 * Bulk operations on plans
	 */
	async bulkOperation(planIds: string[], operation: 'activate' | 'deactivate' | 'delete'): Promise<void> {
		try {
			if (!planIds || planIds.length === 0) {
				throw new BadRequestException('Plan IDs are required for bulk operations');
			}

			switch (operation) {
				case 'activate':
					await this.typeOrmRepository.update(planIds, { isActive: true });
					break;
				case 'deactivate':
					await this.typeOrmRepository.update(planIds, { isActive: false });
					break;
				case 'delete':
					// Check for active subscriptions before deletion
					// Note: Implement subscription check when relationships are available
					await this.typeOrmRepository.delete(planIds);
					break;
				default:
					throw new BadRequestException(`Invalid operation: ${operation}`);
			}
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to perform bulk operation: ${error.message}`);
		}
	}

	/**
	 * Get plan analytics
	 */
	async getPlanAnalytics(
		planId: ID,
		dateFrom?: Date,
		dateTo?: Date
	): Promise<{
		totalSubscriptions: number;
		activeSubscriptions: number;
		revenue: number;
		conversionRate: number;
	}> {
		try {
			// Note: This is a placeholder implementation
			// Actual implementation should query subscription and billing data
			return {
				totalSubscriptions: 0,
				activeSubscriptions: 0,
				revenue: 0,
				conversionRate: 0
			};
		} catch (error) {
			throw new BadRequestException(`Failed to get plan analytics: ${error.message}`);
		}
	}

	/**
	 * Search plans with filtering
	 */
	async searchPlans(findInput: IPluginSubscriptionPlanFindInput): Promise<IPluginSubscriptionPlan[]> {
		try {
			const queryOptions: FindManyOptions<PluginSubscriptionPlan> = {
				where: {
					...(findInput.pluginId && { pluginId: findInput.pluginId }),
					...(findInput.type && { type: findInput.type }),
					...(findInput.isActive !== undefined && { isActive: findInput.isActive }),
					...(findInput.isPopular !== undefined && { isPopular: findInput.isPopular }),
					...(findInput.isRecommended !== undefined && { isRecommended: findInput.isRecommended }),
					...(findInput.billingPeriod && { billingPeriod: findInput.billingPeriod })
				},
				order: {
					sortOrder: 'ASC',
					price: 'ASC'
				}
			};

			return await this.typeOrmRepository.find(queryOptions);
		} catch (error) {
			throw new BadRequestException(`Failed to search plans: ${error.message}`);
		}
	}

	/**
	 * Get plan by ID with relations
	 */
	async getPlanById(id: ID, relations: string[] = []): Promise<IPluginSubscriptionPlan> {
		try {
			const queryOptions: FindOneOptions<PluginSubscriptionPlan> = {
				where: { id },
				relations
			};

			const plan = await this.typeOrmRepository.findOne(queryOptions);
			if (!plan) {
				throw new NotFoundException(`Subscription plan with ID ${id} not found`);
			}

			return plan;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException(`Failed to get plan: ${error.message}`);
		}
	}

	/**
	 *
	 * @param pluginId - The plugin ID
	 * @returns
	 */
	async isSubscriptionRequired(pluginId: ID): Promise<boolean> {
		try {
			const count = await this.count({
				where: [
					{
						pluginId,
						isActive: true,
						price: MoreThan(0)
					},
					{
						isActive: true,
						plugin: {
							requiresSubscription: true,
							id: pluginId
						}
					}
				]
			});
			return count > 0;
		} catch (error) {
			// If there's an error checking, default to false (treat as free plugin)
			console.error('Error checking if plugin %s requires subscription:', pluginId, error);
			return false;
		}
	}
}
