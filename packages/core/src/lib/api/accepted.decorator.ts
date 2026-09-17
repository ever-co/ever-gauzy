import { applyDecorators, HttpStatus, MethodDecorator, SetMetadata, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import {
	ACCEPTED_OPERATION_METADATA,
	ASYNC_OPERATION_STATUSES,
	IAcceptedOperationOptions
} from './async-operation';
import { AcceptedOperationInterceptor, IDEMPOTENCY_KEY_HEADER } from './accepted-operation.interceptor';

/**
 * Declares that a route accepts long-running work instead of performing it.
 *
 * One decorator carries the whole convention: the handler returns an operation reference, and the
 * mounted interceptor answers `202` with a `Location`, a `Retry-After`, the accepted body and — by
 * default — a requirement that the request carried an idempotency key. A route that declares nothing
 * is untouched, so the convention is adopted one route at a time.
 *
 * ```ts
 * @AcceptedOperation({ type: 'CHECKOUT_COMPLETE' })
 * @Post('/:id/complete')
 * public async complete(@Param('id') id: string): Promise<OperationRef> {
 * 	const { operation } = await this.operations.start({ type: 'CHECKOUT_COMPLETE', input: { id } });
 * 	return operationRefOf(operation);
 * }
 * ```
 *
 * The published API document gains the `202` and the two headers from the same declaration, so a
 * generated client is told about the convention rather than discovering it at runtime.
 *
 * @param options The route's declaration: the operation type it starts, and how the handle is
 * located and polled.
 * @returns The composite method decorator.
 */
export const AcceptedOperation = (options: IAcceptedOperationOptions): MethodDecorator =>
	applyDecorators(
		SetMetadata(ACCEPTED_OPERATION_METADATA, options),
		UseInterceptors(AcceptedOperationInterceptor),
		ApiHeader({
			name: IDEMPOTENCY_KEY_HEADER,
			required: options.requireIdempotencyKey !== false,
			description:
				'A client-generated key that makes a retry resolve to the operation the first call started.'
		}),
		ApiResponse({
			status: HttpStatus.ACCEPTED,
			description: 'The operation was accepted; it is readable at the location this response names.',
			schema: {
				type: 'object',
				required: ['operationId', 'type', 'status', 'location'],
				properties: {
					operationId: { type: 'string', format: 'uuid' },
					type: { type: 'string', example: options.type },
					status: { type: 'string', enum: [...ASYNC_OPERATION_STATUSES] },
					location: { type: 'string', example: '/api/operations/2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48' }
				}
			},
			headers: {
				Location: {
					description: 'Where the operation is readable.',
					schema: { type: 'string' }
				},
				'Retry-After': {
					description: 'How long to wait before polling, in seconds.',
					schema: { type: 'integer', example: options.retryAfterSeconds ?? 1 }
				}
			}
		})
	);
