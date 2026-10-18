/**
 * Reuses the answer to a request that was made moments ago with the same parameters.
 *
 * The app asks for the same things from several places as it starts: `AppInitService.init()` loads the
 * signed-in user and the role's permissions, the pages entry point loads both again, a route resolver
 * asks for the user once more. The second and third answers were always the first one again, paid for in
 * full (`/role-permissions/me` alone is ~164 KB). Within a short window an identical request — in flight
 * or just answered — is served the same promise; a mutation calls {@link forget} so the next read is fresh.
 */
export class RecentAnswers<T> {
	private readonly answers = new Map<string, { at: number; answer: Promise<T> }>();

	/**
	 * @param windowMs - How long an answer is reused, counted from when its request started.
	 * @param now - The clock (injectable for tests).
	 */
	constructor(
		private readonly windowMs: number,
		private readonly now: () => number = () => Date.now()
	) {}

	/**
	 * The recent answer for `key`, or the answer of `load()` — started now and remembered. A rejected
	 * load is forgotten at once, so the next call asks again.
	 *
	 * @param key - Everything the answer depends on (the user, the token, the parameters).
	 * @param load - Makes the request.
	 */
	get(key: string, load: () => Promise<T>): Promise<T> {
		const recent = this.answers.get(key);
		const at = this.now();

		if (recent && at - recent.at < this.windowMs) {
			return recent.answer;
		}

		const answer = load();
		this.answers.set(key, { at, answer });
		answer.catch(() => {
			if (this.answers.get(key)?.answer === answer) {
				this.answers.delete(key);
			}
		});
		return answer;
	}

	/** Drops every remembered answer: the next request of any key is made again. */
	forget(): void {
		this.answers.clear();
	}
}
