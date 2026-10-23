import { RecentAnswers } from './recent-answers';

describe('RecentAnswers', () => {
	let clock: number;
	let answers: RecentAnswers<string>;
	let load: jest.Mock<Promise<string>, []>;

	const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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

	it('keeps sharing a request still in flight after the window has passed', async () => {
		let release: (value: string) => void = () => undefined;
		load.mockImplementationOnce(() => new Promise<string>((resolve) => (release = resolve)));

		const slow = answers.get('k', load);
		clock += 60_000;
		expect(answers.get('k', load)).toBe(slow);
		expect(load).toHaveBeenCalledTimes(1);

		release('late answer');
		expect(await slow).toBe('late answer');
	});

	it('asks again once the window has passed, and for another key', async () => {
		await answers.get('k', load);
		clock += 5_000;
		await answers.get('k', load);
		await answers.get('other', load);
		expect(load).toHaveBeenCalledTimes(3);
	});

	it('drops expired answers of every key, so old tokens do not pile up', async () => {
		await answers.get('token-a', load);
		await answers.get('token-b', load);
		await tick();
		expect((answers as any).answers.size).toBe(2);

		clock += 5_000;
		await answers.get('token-c', load);
		expect([...(answers as any).answers.keys()]).toEqual(['token-c']);
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
