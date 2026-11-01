import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
	it('treats a started request as the latest until another one starts', () => {
		const requests = new LatestRequest();

		const first = requests.start();
		expect(requests.isLatest(first)).toBe(true);

		const second = requests.start();
		expect(requests.isLatest(first)).toBe(false);
		expect(requests.isLatest(second)).toBe(true);
	});

	it('knows no ticket it did not hand out', () => {
		const requests = new LatestRequest();
		expect(requests.isLatest(0)).toBe(false);

		requests.start();
		expect(requests.isLatest(2)).toBe(false);
	});

	it('keeps a superseded request superseded, whatever order the answers arrive in', async () => {
		const requests = new LatestRequest();
		const applied: string[] = [];
		let answerSlow: (rows: string) => void;
		const slow = new Promise<string>((resolve) => (answerSlow = resolve));

		const load = async (answer: Promise<string>) => {
			const ticket = requests.start();
			const rows = await answer;
			if (requests.isLatest(ticket)) {
				applied.push(rows);
			}
		};

		const older = load(slow);
		const newer = load(Promise.resolve('newer'));
		await newer;
		answerSlow('older');
		await older;

		expect(applied).toEqual(['newer']);
	});
});
