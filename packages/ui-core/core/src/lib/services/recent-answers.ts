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
	private readonly answers = new Map<string, { at: number; answer: Promise<T>; settled: boolean }>();

	/**
	 * @param windowMs - How long an answer is reused once it has arrived, counted from when its request started.
	 * @param now - The clock (injectable for tests).
	 */
	constructor(
		private readonly windowMs: number,
		private readonly now: () => number = () => Date.now()
	) {}

	/**
	 * The recent answer for `key`, or the answer of `load()` — started now and remembered. A request still in
	 * flight is shared however long it takes; an answer that has arrived is reused within the window. A
	 * rejected load is forgotten at once, so the next call asks again.
	 *
	 * @param key - Everything the answer depends on (the user, the token, the parameters).
	 * @param load - Makes the request.
	 */
	get(key: string, load: () => Promise<T>): Promise<T> {
		const at = this.now();
		this.evictExpired(at);

		const recent = this.answers.get(key);
		if (recent && (!recent.settled || at - recent.at < this.windowMs)) {
			return recent.answer;
		}

		const answer = load();
		const entry = { at, answer, settled: false };
		this.answers.set(key, entry);
		answer.then(
			() => {
				entry.settled = true;
			},
			() => {
				if (this.answers.get(key) === entry) {
					this.answers.delete(key);
				}
			}
		);
		return answer;
	}

	/** Drops every remembered answer: the next request of any key is made again. */
	forget(): void {
		this.answers.clear();
	}

	/**
	 * Drops the answers nobody can reuse any more, whatever their key: a token refresh or a sign-in leaves
	 * entries under keys that are never asked for again, and they must not stay for the service's lifetime.
	 */
	private evictExpired(at: number): void {
		for (const [key, entry] of this.answers) {
			if (entry.settled && at - entry.at >= this.windowMs) {
				this.answers.delete(key);
			}
		}
	}
}
