import { CampaignBudgetController } from './campaign-budget/campaign-budget.controller';
import { PromotionActionController } from './promotion-action/promotion-action.controller';

/**
 * R2-G28: the one-row routes of a campaign's ceiling and of a promotion's action reach the checked service methods,
 * not the inherited create/update that wrote the body as stated.
 */
describe('the campaign-budget and promotion-action write routes (R2-G28)', () => {
	const CAMPAIGN = '00000000-0000-4000-8000-000000000090';

	it('POST /campaign-budgets sets the ceiling through setBudget, on the campaign the body names', async () => {
		const service = { setBudget: jest.fn(async () => ({ id: 'budget-1' })), create: jest.fn() };
		const body = { campaignId: CAMPAIGN, type: 'SPEND', limit: '100', currency: 'USD' };

		await new CampaignBudgetController(service as never).create(body as never);

		expect(service.setBudget).toHaveBeenCalledWith(CAMPAIGN, body);
		expect(service.create).not.toHaveBeenCalled();
	});

	it('PUT /campaign-budgets/:id changes the ceiling through updateBudget', async () => {
		const service = { updateBudget: jest.fn(async () => ({ affected: 1 })), update: jest.fn() };

		await new CampaignBudgetController(service as never).update('budget-1', { limit: '5' } as never);

		expect(service.updateBudget).toHaveBeenCalledWith('budget-1', { limit: '5' });
		expect(service.update).not.toHaveBeenCalled();
	});

	it('POST and PUT /promotion-actions go through createAction and updateAction', async () => {
		const service = {
			createAction: jest.fn(async () => ({ id: 'act-1' })),
			updateAction: jest.fn(async () => ({ affected: 1 })),
			create: jest.fn(),
			update: jest.fn()
		};
		const controller = new PromotionActionController(service as never);

		await controller.create({ promotionId: 'promo-1', type: 'PERCENTAGE', value: '10' } as never);
		await controller.update('act-1', { value: '20' } as never);

		expect(service.createAction).toHaveBeenCalledWith({ promotionId: 'promo-1', type: 'PERCENTAGE', value: '10' });
		expect(service.updateAction).toHaveBeenCalledWith('act-1', { value: '20' });
		expect(service.create).not.toHaveBeenCalled();
		expect(service.update).not.toHaveBeenCalled();
	});
});
