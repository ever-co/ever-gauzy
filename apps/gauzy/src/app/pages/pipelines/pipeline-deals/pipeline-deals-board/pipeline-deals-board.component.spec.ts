import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { IDeal, IPipelineStage } from '@gauzy/contracts';
import { DealsService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { PipelineDealsBoardComponent } from './pipeline-deals-board.component';
import { IDealBoardCard, IDealBoardColumn } from './pipeline-deals-board.utils';

const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const TENANT = 'dddddddd-4444-4444-8444-444444444444';

const STAGES = [
	{ id: 'lead', name: 'Lead', index: 1 },
	{ id: 'won', name: 'Won', index: 2 }
] as IPipelineStage[];

const DEALS = [
	{ id: 'a', title: 'A', stageId: 'lead', probability: 2 },
	{ id: 'b', title: 'B', stageId: 'lead', probability: 4 },
	{ id: 'c', title: 'C', stageId: 'won', probability: 5 }
] as IDeal[];

/**
 * The deals board: the columns come from the pipeline's stages and the deals the page read; a card dropped
 * on another column moves at once and is saved at that stage through the deals update endpoint, and goes
 * back where it was if the save fails.
 */
describe('PipelineDealsBoardComponent', () => {
	let dealsService: { updateStage: jest.Mock };
	let errorHandling: { handleError: jest.Mock };
	let canEdit: boolean;

	const board = () => {
		dealsService = { updateStage: jest.fn(async () => ({})) };
		errorHandling = { handleError: jest.fn() };
		const component = new PipelineDealsBoardComponent(
			dealsService as unknown as DealsService,
			{ hasAnyPermission: () => canEdit } as unknown as Store,
			errorHandling as unknown as ErrorHandlingService,
			{ markForCheck: jest.fn() } as unknown as ChangeDetectorRef
		);
		Object.assign(component, { stages: STAGES, deals: DEALS, organizationId: ORGANIZATION, tenantId: TENANT });
		component.ngOnChanges({
			stages: new SimpleChange(undefined, STAGES, true),
			deals: new SimpleChange(undefined, DEALS, true)
		});
		return component;
	};

	/** What a CDK drop of `card` from `from` onto `to`, at `currentIndex`, hands the handler. */
	const dropEvent = (from: IDealBoardColumn, to: IDealBoardColumn, card: IDealBoardCard, currentIndex = 0) =>
		({
			previousContainer: { data: from },
			container: { data: to },
			item: { data: card },
			previousIndex: from.cards.indexOf(card),
			currentIndex
		}) as unknown as CdkDragDrop<IDealBoardColumn, IDealBoardColumn, IDealBoardCard>;

	const ids = (column: IDealBoardColumn) => column.cards.map((card) => card.id);

	beforeEach(() => (canEdit = true));

	it('shows one column per stage with its deals', () => {
		const component = board();

		expect(component.columns.map((column) => column.name)).toEqual(['Lead', 'Won']);
		expect(ids(component.columns[0])).toEqual(['a', 'b']);
		expect(ids(component.columns[1])).toEqual(['c']);
	});

	it('saves a dropped deal at the new stage, through the update endpoint, with only the stage and its scope', async () => {
		const component = board();
		const [lead, won] = component.columns;
		const card = lead.cards[0];
		const moving = jest.fn();
		component.dealMoving.subscribe(moving);

		await component.drop(dropEvent(lead, won, card));

		expect(dealsService.updateStage).toHaveBeenCalledWith('a', 'won', {
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		expect(ids(lead)).toEqual(['b']);
		expect(ids(won)).toEqual(['a', 'c']);
		expect(card.stageId).toBe('won');
		expect(card.saving).toBe(false);
		expect(moving).toHaveBeenCalledWith({ dealId: 'a', stageId: 'won', saved: expect.any(Promise) });
		await expect(moving.mock.calls[0][0].saved).resolves.toBe(true);
	});

	it('moves the card at once and marks it saving while the save is under way', async () => {
		const component = board();
		const [lead, won] = component.columns;
		const card = lead.cards[1];
		let resolve: () => void;
		dealsService.updateStage.mockReturnValue(new Promise<void>((done) => (resolve = done)));

		const moving = jest.fn();
		component.dealMoving.subscribe(moving);

		const pending = component.drop(dropEvent(lead, won, card, 1));

		expect(ids(won)).toEqual(['c', 'b']);
		expect(card.saving).toBe(true);
		// Reported when the save starts, so a host the board is removed from can still wait for it.
		expect(moving).toHaveBeenCalledTimes(1);

		resolve();
		await pending;
		expect(card.saving).toBe(false);
	});

	it('puts the card back where it was and shows the error when the save fails', async () => {
		const component = board();
		const [lead, won] = component.columns;
		const card = lead.cards[1];
		const error = new Error('403');
		dealsService.updateStage.mockRejectedValue(error);
		const moving = jest.fn();
		component.dealMoving.subscribe(moving);

		await component.drop(dropEvent(lead, won, card));

		expect(ids(lead)).toEqual(['a', 'b']);
		expect(ids(won)).toEqual(['c']);
		expect(card.stageId).toBe('lead');
		expect(card.saving).toBe(false);
		expect(errorHandling.handleError).toHaveBeenCalledWith(error);
		await expect(moving.mock.calls[0][0].saved).resolves.toBe(false);
	});

	it('saves nothing for a drop on the column the card came from', async () => {
		const component = board();
		const [lead] = component.columns;

		await component.drop(dropEvent(lead, lead, lead.cards[0], 1));

		expect(dealsService.updateStage).not.toHaveBeenCalled();
		expect(ids(lead)).toEqual(['a', 'b']);
	});

	it('moves nothing for a user who may not edit pipelines', async () => {
		canEdit = false;
		const component = board();
		const [lead, won] = component.columns;

		expect(component.canMove).toBe(false);
		await component.drop(dropEvent(lead, won, lead.cards[0]));

		expect(dealsService.updateStage).not.toHaveBeenCalled();
		expect(ids(lead)).toEqual(['a', 'b']);
	});

	it('ignores a second drop of a card still being saved', async () => {
		const component = board();
		const [lead, won] = component.columns;
		const card = lead.cards[0];
		dealsService.updateStage.mockReturnValue(new Promise(() => undefined));

		void component.drop(dropEvent(lead, won, card));
		await component.drop(dropEvent(won, lead, card));

		expect(dealsService.updateStage).toHaveBeenCalledTimes(1);
		expect(ids(won)).toEqual(['a', 'c']);
	});

	it('leaves rebuilt columns alone when a save started before the rebuild fails', async () => {
		const component = board();
		const [lead, won] = component.columns;
		let reject: (error: unknown) => void;
		dealsService.updateStage.mockReturnValue(new Promise((_, fail) => (reject = fail)));

		const pending = component.drop(dropEvent(lead, won, lead.cards[0]));
		component.ngOnChanges({ deals: new SimpleChange(DEALS, [...DEALS], false) });
		const rebuilt = component.columns.map(ids);
		reject(new Error('500'));
		await pending;

		expect(component.columns.map(ids)).toEqual(rebuilt);
		expect(errorHandling.handleError).toHaveBeenCalled();
	});
});
