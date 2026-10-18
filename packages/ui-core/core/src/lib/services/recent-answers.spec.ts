import { RecentAnswers } from './recent-answers';

describe('RecentAnswers', () => {
	let clock: number;
	let answers: RecentAnswers<string>;
	let load: jest.Mock<Promise<string>, []>;

	beforeEach(() => {
		clock = 1_000;
		answers = new RecentAnswers<string>(5_000, () => clock);
		load = jest.fn(async () => 'answer');
	});

	it('serves an identical request within the window from the first answer, in flight or done', async () => {
		const first = answers.get('k', load);
		const second = answers.get('k', load);
		expect(second).toBe(first);

		await first;
		clock += 4_999;
		expect(await answers.get('k', load)).toBe('answer');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('asks again once the window has passed, and for another key', async () => {
		await answers.get('k', load);
		clock += 5_000;
		await answers.get('k', load);
		await answers.get('other', load);
		expect(load).toHaveBeenCalledTimes(3);
	});

	it('forgets a rejected load, so the next request is made again', async () => {
		load.mockRejectedValueOnce(new Error('offline'));
		await expect(answers.get('k', load)).rejects.toThrow('offline');
		expect(await answers.get('k', load)).toBe('answer');
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('forget() makes the next request fresh', async () => {
		await answers.get('k', load);
		answers.forget();
		await answers.get('k', load);
		expect(load).toHaveBeenCalledTimes(2);
	});
});
