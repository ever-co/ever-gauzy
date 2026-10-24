import { of } from 'rxjs';
import { GoalsComponent } from './goals.component';

/**
 * Owner decision 2(a) (2026-10-23): the server applies a filed progress update to its key result and goal, so the
 * goals page re-reads after a report instead of writing the key result and the goal back with
 * `PUT /key-results/:id` and `PUT /goals/:id`, which need `GOALS_EDIT` and refused an employee reporting their own key
 * result. Editing a key result or a goal still writes them (those are `GOALS_EDIT` edits, and unchanged).
 *
 * Only the methods are exercised, on a bare instance: no template or DI is needed.
 */
describe('GoalsComponent — after a progress report', () => {
	const keyResult = { id: 'kr-1', progress: 50, weight: '1', goal: { id: 'goal-1' }, updates: [] };

	const build = (dialogAnswer: unknown) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const component: any = Object.create(GoalsComponent.prototype);
		const goalService = { update: jest.fn() };
		const keyResultService = { update: jest.fn() };
		Object.assign(component, {
			goals: [{ id: 'goal-1', progress: 0, keyResults: [keyResult] }],
			selectedKeyResult: { index: 0, data: keyResult, isSelected: true },
			dialogService: { open: jest.fn(() => ({ onClose: of(dialogAnswer) })) },
			goalService,
			keyResultService,
			toastrService: { success: jest.fn(), danger: jest.fn() },
			getTranslation: (key: string) => key,
			loadPage: jest.fn()
		});
		return { component, goalService, keyResultService };
	};

	it('re-reads the page when the key result details close, without writing the goal back', async () => {
		const { component, goalService, keyResultService } = build({ ...keyResult, progress: 75 });

		await component.openKeyResultDetails();

		expect(goalService.update).not.toHaveBeenCalled();
		expect(keyResultService.update).not.toHaveBeenCalled();
		expect(component.loadPage).toHaveBeenCalled();
	});

	it('re-reads the page after the update dialog files a report, writing neither key result nor goal', async () => {
		const { component, goalService, keyResultService } = build({ ...keyResult, progress: 75 });

		await component.keyResultUpdate(0, keyResult);

		expect(keyResultService.update).not.toHaveBeenCalled();
		expect(goalService.update).not.toHaveBeenCalled();
		expect(component.loadPage).toHaveBeenCalled();
	});
});
