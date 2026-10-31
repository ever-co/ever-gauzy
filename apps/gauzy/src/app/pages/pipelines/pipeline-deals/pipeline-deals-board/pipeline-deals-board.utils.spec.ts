import { IDeal, IPipelineStage } from '@gauzy/contracts';
import { DealBoardMoves, toDealBoardCard, toDealBoardColumns } from './pipeline-deals-board.utils';

const stage = (id: string, index: number, name = id): IPipelineStage => ({ id, index, name }) as IPipelineStage;
const deal = (id: string, stageId: string, extra: Partial<IDeal> = {}): IDeal =>
	({ id, title: `Deal ${id}`, stageId, probability: 3, ...extra }) as IDeal;

describe('toDealBoardColumns', () => {
	it('makes one column per stage, in the stages’ own order', () => {
		const columns = toDealBoardColumns([stage('won', 3), stage('lead', 1), stage('offer', 2)], []);

		expect(columns.map((column) => column.stageId)).toEqual(['lead', 'offer', 'won']);
		expect(columns.every((column) => column.cards.length === 0)).toBe(true);
	});

	it('puts each deal in its stage’s column, in the order the deals came', () => {
		const columns = toDealBoardColumns(
			[stage('lead', 1), stage('won', 2)],
			[deal('a', 'won'), deal('b', 'lead'), deal('c', 'won')]
		);

		expect(columns[0].cards.map((card) => card.id)).toEqual(['b']);
		expect(columns[1].cards.map((card) => card.id)).toEqual(['a', 'c']);
	});

	it('leaves off a deal whose stage is not one of the pipeline’s', () => {
		const columns = toDealBoardColumns([stage('lead', 1)], [deal('a', 'lead'), deal('b', 'elsewhere')]);

		expect(columns).toHaveLength(1);
		expect(columns[0].cards.map((card) => card.id)).toEqual(['a']);
	});

	it('gives a deal at a stage added since the page loaded the column of the stage it was read with', () => {
		const columns = toDealBoardColumns(
			[stage('lead', 1), stage('won', 3)],
			[deal('a', 'offer', { stage: stage('offer', 2) }), deal('b', 'offer', { stage: stage('offer', 2) })]
		);

		expect(columns.map((column) => column.stageId)).toEqual(['lead', 'offer', 'won']);
		expect(columns[1].cards.map((card) => card.id)).toEqual(['a', 'b']);
	});

	it('has no columns without stages', () => {
		expect(toDealBoardColumns(undefined, [deal('a', 'lead')])).toEqual([]);
		expect(toDealBoardColumns([], null)).toEqual([]);
	});
});

describe('toDealBoardCard', () => {
	it('names the deal, its client, its creator and its probability', () => {
		const card = toDealBoardCard(
			deal('a', 'lead', {
				probability: 5,
				client: { name: 'Acme' } as IDeal['client'],
				createdByUser: {
					firstName: 'Ada',
					lastName: 'Lovelace',
					imageUrl: 'https://img/ada.png'
				} as IDeal['createdByUser']
			})
		);

		expect(card).toMatchObject({
			id: 'a',
			title: 'Deal a',
			stageId: 'lead',
			probability: 5,
			clientName: 'Acme',
			createdByName: 'Ada Lovelace',
			createdByImageUrl: 'https://img/ada.png'
		});
		expect(card.probabilityBadge).toEqual({
			level: 'high',
			className: 'badge-success',
			labelKey: 'PIPELINE_DEALS_PAGE.HIGH'
		});
	});

	it('falls back to the creator’s email, and leaves out what the deal does not have', () => {
		const card = toDealBoardCard(
			deal('a', 'lead', { probability: null, createdByUser: { email: 'ada@ever.co' } as IDeal['createdByUser'] })
		);

		expect(card.createdByName).toBe('ada@ever.co');
		expect(card.clientName).toBeUndefined();
		expect(card.createdByImageUrl).toBeUndefined();
		expect(card.probability).toBeNull();
		expect(card.probabilityBadge.level).toBe('unknown');
	});
});

describe('DealBoardMoves', () => {
	/** Lets every promise that has settled run its callbacks. */
	const flush = () => new Promise<void>((done) => setTimeout(done));

	it('holds the board until the moves still under way settle and the deals are read again', async () => {
		const moves = new DealBoardMoves();
		let finishSave: (saved: boolean) => void;
		let finishRead: () => void;
		const reread = jest.fn(() => new Promise<void>((done) => (finishRead = done)));
		moves.track(Promise.resolve(false));
		moves.track(new Promise<boolean>((done) => (finishSave = done)));

		const settled = moves.settle(reread);
		await flush();
		expect(moves.held).toBe(true);
		expect(reread).not.toHaveBeenCalled();

		finishSave(true);
		await flush();
		expect(reread).toHaveBeenCalledTimes(1);
		expect(moves.held).toBe(true);

		finishRead();
		await settled;
		expect(moves.held).toBe(false);
	});

	it('reads nothing again when every move failed, and forgets the moves it settled', async () => {
		const moves = new DealBoardMoves();
		const reread = jest.fn(() => Promise.resolve());
		moves.track(Promise.resolve(false));

		await moves.settle(reread);
		expect(reread).not.toHaveBeenCalled();
		expect(moves.held).toBe(false);

		moves.track(Promise.resolve(true));
		await moves.settle(reread);
		await moves.settle(reread);
		expect(reread).toHaveBeenCalledTimes(1);
	});

	it('never holds the board when no move was tracked', async () => {
		const moves = new DealBoardMoves();
		const reread = jest.fn(() => Promise.resolve());

		const settled = moves.settle(reread);
		expect(moves.held).toBe(false);
		await settled;
		expect(reread).not.toHaveBeenCalled();
	});

	it('lets the board show again even if reading the deals fails', async () => {
		const moves = new DealBoardMoves();
		moves.track(Promise.resolve(true));

		await expect(moves.settle(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
		expect(moves.held).toBe(false);
	});
});
