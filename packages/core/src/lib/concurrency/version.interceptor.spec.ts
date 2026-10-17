import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { VERSIONED_METADATA_KEY } from './version.util';
import { VersionInterceptor } from './version.interceptor';
import type { IVersionedOptions } from './versioned.decorator';

/**
 * The interceptor that publishes the version a response is at.
 *
 * A conditional write is only possible if the caller can learn the version it is conditioning on, so
 * every response from an opted-in route carries the record's version twice: in the body, where a
 * client reads it as a property, and in an `ETag`, where an HTTP client gets it for free and can
 * send it straight back as `If-Match`. The cases below are that publication, the two results it must
 * stay silent on — a body with no version, and a route that never opted in — and the promise the
 * whole wave rests on: on a route that has not opted in, the bytes a caller receives today are the
 * bytes it receives after this landed.
 */

/** The controller and the handler the framework would hand the interceptor. */
class InvoiceController {}

function readInvoice(): void {
	// The handler's body is not what this interceptor is about; only its result is.
}

/** The HTTP surface: one request, one response, with the response's header writes kept. */
function httpSurface(request: any = {}) {
	const written: Record<string, string> = {};
	const response = {
		setHeader: jest.fn((name: string, value: string) => {
			written[name] = value;
		})
	};

	return { context: contextOf('http', [request, response, undefined], request), response, written };
}

/** The GraphQL surface: the root, the arguments, the platform's context and the field info. */
function graphqlSurface(request: any = {}, response: any = undefined) {
	const gqlContext = { req: request, res: response };

	return { context: contextOf('graphql', [{}, {}, gqlContext, undefined], request), gqlContext };
}

/** One execution context, at the four positions the framework uses. */
function contextOf(type: string, positions: any[], request: any): ExecutionContext {
	return {
		getType: () => type,
		getClass: () => InvoiceController,
		getHandler: () => readInvoice,
		getArgs: () => positions,
		getArgByIndex: (index: number) => positions[index],
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => positions[1],
			getNext: () => undefined
		})
	} as unknown as ExecutionContext;
}

/** The interceptor, with the metadata lookup spied rather than resolved through a booted Nest. */
function interceptorFor(options: IVersionedOptions | undefined) {
	const reflector = new Reflector();
	const metadata = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options);

	return { interceptor: new VersionInterceptor(reflector), metadata };
}

/** A handler that answers one result, for a case to run the interceptor's pipeline over. */
const answering = (result: unknown) => ({ handle: () => of(result) }) as unknown as CallHandler;

afterEach(() => {
	jest.restoreAllMocks();
});

describe('publishing the version a response is at', () => {
	it('writes the entity tag the caller sends back as its precondition', async () => {
		const { interceptor } = interceptorFor({});
		const { context, response, written } = httpSurface();
		const body = { id: 'invoice-1', version: 7 };

		const received = await firstValueFrom(interceptor.intercept(context, answering(body)));

		expect(response.setHeader).toHaveBeenCalledWith('ETag', '"7"');
		expect(response.setHeader).toHaveBeenCalledTimes(1);
		// The tag is the quoted form, which is what `parseEntityTag` reads back out of `If-Match`. An
		// unquoted version would be a header a strict client refuses to send.
		expect(written).toEqual({ ETag: '"7"' });
		// Control: the body is untouched, and it is the very object the handler produced — a client reads
		// the version as a property and an HTTP cache reads it from the header, and neither is a copy.
		expect(received).toBe(body);
	});

	it('publishes the version a projected response carries as text', async () => {
		const { interceptor } = interceptorFor({});
		const { context, written } = httpSurface();

		await firstValueFrom(interceptor.intercept(context, answering({ id: 'invoice-1', version: '7' })));

		// A response assembled from SQL carries the column as text. Control: refusing it would publish no
		// version at all, and the client that just read the record would have no precondition to send.
		expect(written).toEqual({ ETag: '"7"' });
	});

	it('writes nothing when the result carries no version, and still answers the caller', async () => {
		const noVersion = [
			// A route that opted in but answered a list, a count, or a projection without the column.
			{ id: 'invoice-1' },
			// The versions that are not versions: the column starts at 1, and a body whose version is a
			// quoted tag has published the transport form into the field.
			{ id: 'invoice-1', version: 0 },
			{ id: 'invoice-1', version: null },
			{ id: 'invoice-1', version: '"7"' },
			{ id: 'invoice-1', version: 'unknown' },
			null,
			undefined
		];

		for (const result of noVersion) {
			const { interceptor } = interceptorFor({});
			const { context, response } = httpSurface();

			const received = await firstValueFrom(interceptor.intercept(context, answering(result)));

			// Control: an `ETag` of `"0"`, `"null"` or `""7""` would be published to a client that then
			// sends it back as `If-Match`, and the guard would answer 400 to a header this platform told
			// it to send. Silence is the only honest answer for a body with no version.
			expect(response.setHeader).not.toHaveBeenCalled();
			expect(received).toEqual(result);
		}
	});

	it('does nothing at all on a route that never opted in', async () => {
		const { interceptor, metadata } = interceptorFor(undefined);
		const { context, response } = httpSurface();
		const stream = of({ id: 'invoice-1', version: 7 });

		const returned = interceptor.intercept(context, { handle: () => stream } as unknown as CallHandler);

		// Control: with no metadata the handler's own observable is returned, so nothing is even mapped
		// over the result. A body that happens to carry a `version` — every entity in the product has
		// entities that do not — is left exactly as the route produced it.
		expect(returned).toBe(stream);
		expect(response.setHeader).not.toHaveBeenCalled();
		expect(metadata).toHaveBeenCalledWith(VERSIONED_METADATA_KEY, [readInvoice, InvoiceController]);
	});

	it('does not fail a request whose surface has no response to write to', async () => {
		const { interceptor } = interceptorFor({});
		const body = { id: 'invoice-1', version: 7 };
		// A GraphQL context with no response attached, and an HTTP response that is not a server response.
		const { context } = graphqlSurface({}, undefined);
		const bare = contextOf('http', [{}, { setHeader: 'not a function' }, undefined], {});

		// Control: the header is a convenience for a caller that caches. Turning "there is nowhere to put
		// it" into a failed request would fail reads on the transports that have no response object.
		expect(await firstValueFrom(interceptor.intercept(context, answering(body)))).toBe(body);
		expect(await firstValueFrom(interceptor.intercept(bare, answering(body)))).toBe(body);
	});

	it('publishes onto the response the GraphQL context carries', async () => {
		const { interceptor } = interceptorFor({});
		const { context, gqlContext } = graphqlSurface({ method: 'POST' }, { setHeader: jest.fn() });

		await firstValueFrom(interceptor.intercept(context, answering({ id: 'invoice-1', version: 3 })));

		// A resolver reaches the HTTP response through the context the platform builds, so a GraphQL
		// client is handed the same precondition a REST client is.
		expect(gqlContext.res.setHeader).toHaveBeenCalledWith('ETag', '"3"');
	});
});
