import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENT_METADATA_KEY, clampRetentionSeconds } from './idempotency.policy';
import type { IIdempotentOptions } from './idempotency.interceptor';

/**
 * Declares that a route is safe to retry under a client-supplied key.
 *
 * The decorator only records what the operation is; the interceptor that acts on it is registered
 * once for the whole application, so adopting the convention on a route is one line and needs no
 * module change. A route without it is untouched: no header is read, no hash is computed and no row
 * is written.
 *
 * ```ts
 * @Idempotent({ scope: 'role.create', required: true, resourceType: 'role' })
 * @Post()
 * async create(@Body() entity: CreateRoleDTO) { … }
 * ```
 *
 * The scope is part of the key's identity, not a filter applied afterwards: two operations may
 * legitimately be called with the same client key, and neither may replay the other's response.
 */
export function Idempotent(options: IIdempotentOptions): MethodDecorator & ClassDecorator {
	const ttlSeconds = clampRetentionSeconds(options.ttlSeconds);

	return SetMetadata(IDEMPOTENT_METADATA_KEY, {
		...options,
		...(ttlSeconds ? { ttlSeconds } : {})
	});
}
