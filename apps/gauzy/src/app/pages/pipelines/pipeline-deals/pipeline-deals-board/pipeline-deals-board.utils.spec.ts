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
	it('settles to whether any tracked move was saved, waiting for the ones still under way', async () => {
		const moves = new DealBoardMoves();
		let finish: (saved: boolean) => void;
		moves.track(Promise.resolve(false));
		moves.track(new Promise<boolean>((done) => (finish = done)));

		const settled = moves.settle();
		let done = false;
		void settled.then(() => (done = true));
		await Promise.resolve();
		expect(done).toBe(false);

		finish(true);
		await expect(settled).resolves.toBe(true);
	});

	it('changes nothing when every move failed, and forgets the moves it settled', async () => {
		const moves = new DealBoardMoves();
		moves.track(Promise.resolve(false));

		await expect(moves.settle()).resolves.toBe(false);

		moves.track(Promise.resolve(true));
		await expect(moves.settle()).resolves.toBe(true);
		await expect(moves.settle()).resolves.toBe(false);
	});
});
