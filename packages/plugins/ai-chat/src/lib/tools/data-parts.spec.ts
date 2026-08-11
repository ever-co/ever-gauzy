import { createDeferredDataPartWriter } from './data-parts';

/**
 * The deferred data-part writer.
 *
 * The ordering problem it exists for is the whole test: tool factories are resolved BEFORE
 * `createUIMessageStream` runs (the tool map is an input to `streamText`), but the stream writer
 * only exists inside that stream's `execute` callback. A naive implementation hands factories
 * `undefined` and every citation part written during the first tool call is lost — silently,
 * because a data part is decoration and nothing fails when it goes missing.
 */
describe('createDeferredDataPartWriter', () => {
	const streamWriter = () => ({ write: jest.fn(), merge: jest.fn(), onError: undefined });

	it('buffers parts written before the stream exists and flushes them in order on bind', () => {
		const writer = createDeferredDataPartWriter();
		writer.write({ type: 'data-a', data: 1 });
		writer.write({ type: 'data-b', data: 2 });

		const sink = streamWriter();
		writer.bind(sink as any);

		expect(sink.write.mock.calls.map(([part]) => part.type)).toEqual(['data-a', 'data-b']);
	});

	it('writes straight through once bound', () => {
		const writer = createDeferredDataPartWriter();
		const sink = streamWriter();
		writer.bind(sink as any);

		writer.write({ type: 'data-a', data: 1 });

		expect(sink.write).toHaveBeenCalledWith({ type: 'data-a', data: 1 });
	});

	it('flushes the buffer exactly once', () => {
		const writer = createDeferredDataPartWriter();
		writer.write({ type: 'data-a', data: 1 });

		const first = streamWriter();
		writer.bind(first as any);
		const second = streamWriter();
		writer.bind(second as any);

		expect(first.write).toHaveBeenCalledTimes(1);
		expect(second.write).not.toHaveBeenCalled();
	});

	/**
	 * The `data-` prefix is what makes the AI SDK route a chunk into `message.parts` on the
	 * client. Anything else is dropped downstream with no diagnostic, so it is refused here.
	 */
	it('refuses a part whose type is not a `data-` chunk', () => {
		const writer = createDeferredDataPartWriter();
		const sink = streamWriter();
		writer.bind(sink as any);

		writer.write({ type: 'text-delta' } as any);
		writer.write(undefined as any);

		expect(sink.write).not.toHaveBeenCalled();
	});

	it('drops parts written after the turn ended instead of throwing into a closed stream', () => {
		const writer = createDeferredDataPartWriter();
		const sink = streamWriter();
		writer.bind(sink as any);
		writer.release();

		writer.write({ type: 'data-a', data: 1 });

		expect(sink.write).not.toHaveBeenCalled();
	});

	it('never lets a failing write escape into the chat turn', () => {
		const writer = createDeferredDataPartWriter();
		const sink = streamWriter();
		sink.write.mockImplementation(() => {
			throw new Error('stream closed');
		});
		writer.bind(sink as any);

		expect(() => writer.write({ type: 'data-a', data: 1 })).not.toThrow();
	});

	it('bounds the pre-bind buffer so a runaway contribution cannot grow it forever', () => {
		const writer = createDeferredDataPartWriter();
		for (let i = 0; i < 200; i++) {
			writer.write({ type: 'data-a', data: i });
		}

		const sink = streamWriter();
		writer.bind(sink as any);

		expect(sink.write).toHaveBeenCalledTimes(64);
	});
});
