import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IIdempotencyKey, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKeyQueryDTO } from './dto';

/**
 * The stored retry keys, over REST.
 *
 * **This resource is an operator's, and every route on it is a recovery move.** A key is written by
 * the platform and never by a caller: a client presents one in a header and the kernel stores what the
 * first attempt answered. What is left for a person to do is read what a stuck client is holding and,
 * when the client has lost its key, take the row away so the next attempt is a true first attempt.
 * That is the whole surface, and it is why the reads carry `IDEMPOTENCY_KEYS_VIEW` and the removal
 * carries `IDEMPOTENCY_KEYS_DELETE` — the pair the permission catalogue declares under "Platform:
 * channels, regions, rules, numbering, operations, outbox, idempotency".
 *
 * **The response never carries the stored request body.** A key row holds the response the first
 * attempt produced, and that response is the caller's own data — an order, a refund, an instrument —
 * so a caller who may release a key is not thereby given a copy of what the key answered. The
 * exception is the row's own diagnostic columns: the request hash prefix, the status, the resource it
 * points at and the two timestamps are what an operator reads, and they are what a read answers.
 *
 * **The removal is the one route that deletes, and it refuses a live claim.** Releasing a key whose
 * work is still executing would let the retry start a second run of that work, which is the single
 * outcome the key exists to prevent; the refusal is the kernel's own answer and reaches the caller
 * unchanged. The route is `DELETE` rather than a status write because the design is explicit that a
 * released key is removed and not marked: a marked row would still occupy the unique tuple, so the
 * retry the operator is trying to unblock would be refused as a reused key.
 *
 * Three routes and no more. The count and the paginated twin of the list are folded into the list —
 * the connection's own `total` is the count, and `take`/`skip` are the page — and a create and an
 * edit do not exist, because a key is written by the interceptor from a request and never by a
 * caller. `17-graphql-api-specification.md` §3.3 declares this resource's GraphQL counterpart, and the
 * two surfaces answer the same three capabilities.
 */
@ApiTags('Idempotency Key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
@Controller('/idempotency-keys')
export class IdempotencyKeyController {
	constructor(private readonly idempotencyService: IdempotencyService) {}

	/**
	 * Lists the keys of the caller's tenant and organization, newest first.
	 *
	 * @param query The narrowing: one scope, one key, one lifecycle or one resource type.
	 * @returns One page of keys, newest first.
	 */
	@ApiOperation({ summary: 'List stored idempotency keys' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Stored keys retrieved' })
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async list(@Query() query: IdempotencyKeyQueryDTO): Promise<IPagination<IIdempotencyKey>> {
		return await this.idempotencyService.listKeys(query);
	}

	/**
	 * Reads one stored key.
	 *
	 * The read a caller resolves before releasing anything: it answers which operation the row belongs
	 * to, what lifecycle it reached and when it was written, which is what tells an operator whether the
	 * client that is stuck is holding a completed key or a live claim.
	 *
	 * A row of another tenant or another organization answers `404`, because the service scopes the read
	 * from the credential — a caller is never told that a key it may not read exists.
	 *
	 * @param id The row id.
	 * @returns The stored key.
	 */
	@ApiOperation({ summary: 'Read a stored idempotency key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Stored key retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IIdempotencyKey> {
		return await this.idempotencyService.findKeyOrFail(id);
	}

	/**
	 * Releases a key, so the next attempt under it is a true first attempt.
	 *
	 * @param id The row id.
	 * @returns The row that was removed.
	 */
	@ApiOperation({ summary: 'Release a stored idempotency key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The key was released' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'IDEMPOTENCY_IN_PROGRESS' })
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_DELETE)
	@Delete('/:id')
	@HttpCode(HttpStatus.OK)
	async release(@Param('id', UUIDValidationPipe) id: ID): Promise<IIdempotencyKey> {
		return await this.idempotencyService.release(id);
	}
}
