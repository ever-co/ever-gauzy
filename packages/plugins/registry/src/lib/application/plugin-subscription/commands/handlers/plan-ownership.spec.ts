// `@gauzy/core` and the registry domain drag in the whole entity graph: stand-ins are enough for these handlers.
const mockCaller = { userId: 'publisher-1' as string | null };

jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		return new.target ? undefined : () => undefined;
	}
	const target: Record<string, unknown> = {
		RequestContext: { currentUserId: () => mockCaller.userId }
	};
	return new Proxy(target, {
		get: (object, name: string) => (name in object ? object[name] : name === '__esModule' ? true : stub)
	});
});
jest.mock('../../../../domain', () => ({
	PluginService: class PluginService {},
	PluginSubscriptionPlanService: class PluginSubscriptionPlanService {}
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BulkPluginPlanOperationCommandHandler } from './bulk-plugin-plan-operation.handler';
import { CopyPluginPlanCommandHandler } from './copy-plugin-plan.handler';
import { CreatePluginSubscriptionPlanCommandHandler } from './create-plugin-subscription-plan.handler';
import { DeletePluginSubscriptionPlanCommandHandler } from './delete-plugin-subscription-plan.handler';
import { UpdatePluginSubscriptionPlanCommandHandler } from './update-plugin-subscription-plan.handler';

/**
 * The registry's plugins and their plans are shared by every tenant, and `PLUGIN_CONFIGURE` is a default permission
 * of every tenant's admins: only the publisher of a plugin may create, change, copy or delete its plans.
 */
describe('subscription plan ownership', () => {
	/** publisher-1 owns plugin-own; somebody else owns plugin-foreign. */
	const owners: Record<string, string> = { 'plugin-own': 'publisher-1', 'plugin-foreign': 'publisher-2' };
	const plans: Record<string, { id: string; pluginId: string }> = {
		'plan-own': { id: 'plan-own', pluginId: 'plugin-own' },
		'plan-foreign': { id: 'plan-foreign', pluginId: 'plugin-foreign' }
	};

	const build = () => {
		const pluginService = {
			validatePluginOwnership: jest.fn(async (pluginId: string, userId: string) => owners[pluginId] === userId)
		};
		const planService = {
			findOneOrFailByIdString: jest.fn(async (id: string) =>
				plans[id] ? { success: true, record: plans[id] } : { success: false }
			),
			createPlan: jest.fn(),
			updatePlan: jest.fn(),
			deletePlan: jest.fn(),
			copyPlan: jest.fn(),
			bulkOperation: jest.fn()
		};
		return { pluginService, planService };
	};

	beforeEach(() => {
		mockCaller.userId = 'publisher-1';
	});

	describe('create', () => {
		it("adds a plan to the caller's own plugin", async () => {
			const { pluginService, planService } = build();
			const handler = new CreatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await handler.execute({ createDto: { pluginId: 'plugin-own', name: 'Pro' } } as any);

			expect(planService.createPlan).toHaveBeenCalled();
		});

		it("refuses a plan for somebody else's plugin", async () => {
			const { pluginService, planService } = build();
			const handler = new CreatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await expect(
				handler.execute({ createDto: { pluginId: 'plugin-foreign', name: 'Free', price: 0 } } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(planService.createPlan).not.toHaveBeenCalled();
		});

		it('refuses a caller without a user', async () => {
			mockCaller.userId = null;
			const { pluginService, planService } = build();
			const handler = new CreatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await expect(
				handler.execute({ createDto: { pluginId: 'plugin-own', name: 'Pro' } } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe('update', () => {
		it("changes a plan of the caller's own plugin", async () => {
			const { pluginService, planService } = build();
			const handler = new UpdatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await handler.execute({ id: 'plan-own', updateDto: { price: 10 } } as any);

			expect(planService.updatePlan).toHaveBeenCalledWith('plan-own', { price: 10 });
		});

		it("refuses to change a plan of somebody else's plugin", async () => {
			const { pluginService, planService } = build();
			const handler = new UpdatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await expect(
				handler.execute({ id: 'plan-foreign', updateDto: { price: 0 } } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(planService.updatePlan).not.toHaveBeenCalled();
		});

		it("refuses to move the caller's plan to somebody else's plugin", async () => {
			const { pluginService, planService } = build();
			const handler = new UpdatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await expect(
				handler.execute({ id: 'plan-own', updateDto: { pluginId: 'plugin-foreign', price: 0 } } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(planService.updatePlan).not.toHaveBeenCalled();
		});

		it('answers 404 for a plan that does not exist', async () => {
			const { pluginService, planService } = build();
			const handler = new UpdatePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

			await expect(handler.execute({ id: 'plan-missing', updateDto: {} } as any)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	it("refuses to delete a plan of somebody else's plugin", async () => {
		const { pluginService, planService } = build();
		const handler = new DeletePluginSubscriptionPlanCommandHandler(planService as any, pluginService as any);

		await expect(handler.execute({ id: 'plan-foreign' } as any)).rejects.toBeInstanceOf(ForbiddenException);
		expect(planService.deletePlan).not.toHaveBeenCalled();

		await handler.execute({ id: 'plan-own' } as any);
		expect(planService.deletePlan).toHaveBeenCalledWith('plan-own');
	});

	it("refuses to copy a plan of somebody else's plugin", async () => {
		const { pluginService, planService } = build();
		const handler = new CopyPluginPlanCommandHandler(planService as any, pluginService as any);

		await expect(
			handler.execute({ copyDto: { sourcePlanId: 'plan-foreign', newName: 'Free' }, tenantId: 't' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(planService.copyPlan).not.toHaveBeenCalled();
	});

	it("refuses a bulk operation that names one plan of somebody else's plugin", async () => {
		const { pluginService, planService } = build();
		const handler = new BulkPluginPlanOperationCommandHandler(planService as any, pluginService as any);

		await expect(
			handler.execute({ operationDto: { planIds: ['plan-own', 'plan-foreign'], operation: 'delete' } } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(planService.bulkOperation).not.toHaveBeenCalled();

		await handler.execute({ operationDto: { planIds: ['plan-own'], operation: 'deactivate' } } as any);
		expect(planService.bulkOperation).toHaveBeenCalledWith(['plan-own'], 'deactivate');
	});
});
