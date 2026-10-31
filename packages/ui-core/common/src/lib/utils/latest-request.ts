/**
 * Keeps overlapping requests of one kind in order: only the latest one started may apply its answer.
 *
 * A view that reloads on every filter change can have several requests in flight at once, and they do not settle
 * in the order they were sent. Without a guard, a slow answer to a superseded request lands after the newer one,
 * overwrites its data and ends a loading state the newer request still holds. `switchMap` drops superseded answers
 * for an observable pipeline; this does the same for promise-based calls: take a ticket when a request starts, and
 * apply its answer (data, errors, loading state) only while that ticket is still the latest.
 *
 * @example
 * const ticket = this.requests.start();
 * try {
 * 	const rows = await this.service.load(payload);
 * 	if (this.requests.isLatest(ticket)) {
 * 		this.rows = rows;
 * 	}
 * } finally {
 * 	if (this.requests.isLatest(ticket)) {
 * 		this.loading = false;
 * 	}
 * }
 */
export class LatestRequest {
	/** The ticket of the request started last; `0` before the first one. */
	private latest = 0;

	/**
	 * Starts a request: every request started before it is superseded from now on.
	 *
	 * @returns The new request's ticket, to pass to `isLatest` when its answer arrives.
	 */
	start(): number {
		return ++this.latest;
	}

	/**
	 * Whether the request with this ticket is still the latest one started, so its answer may be applied.
	 *
	 * @param ticket - What `start` returned for the request.
	 */
	isLatest(ticket: number): boolean {
		// Tickets start at 1: before the first request there is no latest one
		return ticket > 0 && ticket === this.latest;
	}
}
