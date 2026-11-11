/**
 * The frames one live session receives, as the async iterator a GraphQL subscription returns.
 *
 * The server pushes; the subscription pulls. Frames that arrive between two pulls wait, up to `maxBuffered`: past
 * that, `push` refuses and the service ends the session (`overloaded`), so a client that stopped reading reconnects
 * and resyncs instead of growing the process. Ending is either side's: the server ends it with a last frame (the
 * reason it closed), the client by returning the iterator (it unsubscribed, or its socket went away), which calls
 * `onReturn` once.
 */
export class LiveFrameStream<T> implements AsyncIterableIterator<T> {
	private readonly buffered: T[] = [];
	private readonly waiting: Array<(result: IteratorResult<T>) => void> = [];
	private finished = false;
	private returned = false;

	/**
	 * @param maxBuffered How many frames may wait for a pull.
	 * @param onReturn Called once when the client ends the stream.
	 */
	constructor(
		private readonly maxBuffered: number,
		private readonly onReturn: () => void
	) {}

	/** Whether the stream has ended (either side). */
	get ended(): boolean {
		return this.finished;
	}

	/**
	 * Hands a frame to the subscriber.
	 *
	 * @param frame The frame.
	 * @returns False when the stream has ended or the subscriber is this far behind.
	 */
	push(frame: T): boolean {
		if (this.finished) {
			return false;
		}
		const reader = this.waiting.shift();
		if (reader) {
			reader({ value: frame, done: false });
			return true;
		}
		if (this.buffered.length >= this.maxBuffered) {
			return false;
		}
		this.buffered.push(frame);
		return true;
	}

	/**
	 * Ends the stream from the server's side, after a last frame when one is given. What was buffered is dropped:
	 * the last frame says why the session ended, and the client resyncs when it opens another.
	 *
	 * @param last The frame the subscriber reads last.
	 */
	end(last?: T): void {
		if (this.finished) {
			return;
		}
		this.finished = true;
		this.buffered.length = 0;
		if (last !== undefined) {
			const reader = this.waiting.shift();
			if (reader) {
				reader({ value: last, done: false });
			} else {
				this.buffered.push(last);
			}
		}
		for (const reader of this.waiting.splice(0)) {
			reader({ value: undefined, done: true });
		}
	}

	next(): Promise<IteratorResult<T>> {
		if (this.buffered.length > 0) {
			return Promise.resolve({ value: this.buffered.shift() as T, done: false });
		}
		if (this.finished) {
			return Promise.resolve({ value: undefined, done: true });
		}
		return new Promise((resolve) => this.waiting.push(resolve));
	}

	return(): Promise<IteratorResult<T>> {
		this.finished = true;
		this.buffered.length = 0;
		for (const reader of this.waiting.splice(0)) {
			reader({ value: undefined, done: true });
		}
		if (!this.returned) {
			this.returned = true;
			this.onReturn();
		}
		return Promise.resolve({ value: undefined, done: true });
	}

	throw(error?: unknown): Promise<IteratorResult<T>> {
		void this.return();
		return Promise.reject(error);
	}

	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		return this;
	}
}
