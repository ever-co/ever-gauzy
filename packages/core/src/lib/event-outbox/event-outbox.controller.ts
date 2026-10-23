import { Controller, Get, HttpStatus, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IEventDelivery, IEventOutbox, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { EventOutboxService } from './event-outbox.service';
import { EventOutboxDetailQueryDTO, EventOutboxQueryDTO } from './dto';

/**
 * One outbox row as the detail read answers it: the row, and the delivery records of that row when
 * they were asked for.
 */
export type ExpandedEventOutbox = IEventOutbox & { deliveries?: IEventDelivery[] };

/**
 * The transactional outbox over REST.
 *
 * **Two reads and no writes, and that is the resource rather than an omission.** An outbox row is
 * written by the domain service that changed the state the event describes — inside that service's
 * own transaction, which is what makes an event impossible to lose — so there is no route here that
 * creates, edits or removes one: a client that could append an event directly would be able to
 * announce a fact that never happened. `06-api-specification.md` §7 says the same thing from the
 * other side, forbidding direct writes to `event_outbox` other than replay and redelivery, and the
 * two moves this kernel does offer are made on a consumer's record rather than on the event, so they
 * live on `/events/deliveries`.
 *
 * **The permission is the catalogue's own for inspecting this machinery.** `EVENT_OUTBOX_VIEW` is
 * declared by `role-permission.model.ts` as "inspect the transactional outbox and its per-consumer
 * deliveries" and `appendix-b-permissions-and-features.md` §2.1 assigns it to exactly these reads, so
 * this class states it rather than a broader administrative permission that would grant the same
 * access to everything else of the organization. It is also the permission the GraphQL fields carry,
 * field for field.
 *
 * **Every read is scoped by the service, not by the caller.** The listing and the node read both go
 * through `EventOutboxService`, which narrows to the caller's tenant — and to the caller's
 * organization or a row that names none — so a diagnostic surface cannot become a way to read
 * another tenant's events.
 */
@ApiTags('Event Outbox')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
@Controller('/events/outbox')
export class EventOutboxController {
	constructor(private readonly eventOutboxService: EventOutboxService) {}

	/**
	 * Lists the outbox rows of the caller's tenant, the row whose turn comes first at the head.
	 *
	 * @param query The narrowing, the page to read, and the bracketed spelling of the narrowing.
	 * @returns One page of rows, with the filtered total.
	 */
	@ApiOperation({ summary: 'List outbox rows' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Outbox rows retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED, VALIDATION_FAILED' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: EventOutboxQueryDTO): Promise<IPagination<IEventOutbox>> {
		const rows = await this.eventOutboxService.listOutboxRows(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Reads one outbox row, optionally with the records of what each consumer did with it.
	 *
	 * @param id The row to read.
	 * @param query Which relations to attach.
	 * @returns The row, and its deliveries when they were asked for.
	 */
	@ApiOperation({ summary: 'Find an outbox row by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Outbox row retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query?: EventOutboxDetailQueryDTO
	): Promise<ExpandedEventOutbox> {
		const row = await this.eventOutboxService.findOutboxRow(id);

		if (!row) {
			// A row of another tenant is answered exactly as a row that does not exist: the two are the
			// same fact to a caller that may not read one of them.
			throw new NotFoundException(`${ApiErrorCode.RESOURCE_NOT_FOUND}: outbox row '${String(id)}' could not be found.`);
		}

		if (!query?.expand?.includes('deliveries')) {
			return row;
		}

		// The deliveries of a row are the records that name the row's **event id**, not its primary
		// key: the delivery table has no foreign key to the outbox, deliberately, because a record
		// outlives the event it is about — and it is the event id the consumer, the webhook signature
		// and the replay all carry. The read is the same scoped listing the delivery resource serves,
		// narrowed by that event, so the two routes answer the same rows.
		return { ...row, deliveries: await this.eventOutboxService.listDeliveryRows({ eventId: row.eventId }) };
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * A member that was not stated is left out rather than written as `undefined`: a repository handed
	 * an explicit `undefined` asks for the rows whose column *is* null, which is a different question
	 * from "do not narrow on this column".
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: EventOutboxQueryDTO): {
		status?: IEventOutbox['status'];
		eventName?: string;
		aggregateId?: ID;
	} {
		const stated: { status?: IEventOutbox['status']; eventName?: string; aggregateId?: ID } = {};

		for (const member of ['status', 'eventName', 'aggregateId'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null && value !== '') {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
