import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventOutboxStatus, ID, IEventDelivery, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { Permissions } from '../shared/decorators';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { EventOutboxService } from './event-outbox.service';
import { EventDeliveryQueryDTO, MarkEventDeliveryDeadDTO } from './dto';

/**
 * The per-consumer delivery records over REST.
 *
 * **A record is one `(event, consumer)` pair and it is the reliability machinery's truth table.** It
 * is written before a consumer is invoked and completed after it returns, which is what turns
 * at-least-once dispatch into an at-most-once effect: a consumer that already acknowledged an event
 * has a `PUBLISHED` row, and a consumer that crashed has a `PENDING` one the retry scan picks up.
 * Reading that table is how an operator answers "which consumer stopped applying events", and the two
 * writes below are the only two moves the platform offers on it — a record is never created, edited
 * or deleted through this resource, because a hand-written record would be a claim about a consumer
 * that never ran.
 *
 * **The two moves are separate routes, and each answers the record as it stands afterwards.** A
 * replay resets the record so the retry scan re-drives it; a dead-letter stops it. They are not one
 * route with a status member, because they are not two values of one act: one asks the machinery to
 * try again and one asks it to stop, and the permission is the same for both because the catalogue
 * grants them together (`EVENT_OUTBOX_RETRY`, "re-publish a failed event or redeliver it to one
 * consumer").
 *
 * **The reads carry the inspect permission and the moves carry the retry one**, which is exactly the
 * split `appendix-b-permissions-and-features.md` §2.1 declares: looking at this table is granted to
 * any role, and changing the machinery is granted to an administrator.
 */
@ApiTags('Event Delivery')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
@Controller('/events/deliveries')
export class EventDeliveryController {
	constructor(private readonly eventOutboxService: EventOutboxService) {}

	/**
	 * Lists the delivery records of the caller's tenant, newest first.
	 *
	 * @param query The narrowing, the page to read, and the bracketed spelling of the narrowing.
	 * @returns One page of records, with the filtered total.
	 */
	@ApiOperation({ summary: 'List delivery records' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery records retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED, VALIDATION_FAILED' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: EventDeliveryQueryDTO): Promise<IPagination<IEventDelivery>> {
		const rows = await this.eventOutboxService.listDeliveryRows(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Reads one delivery record.
	 *
	 * @param id The record to read.
	 * @returns The record.
	 */
	@ApiOperation({ summary: 'Find a delivery record by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery record retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IEventDelivery> {
		const delivery = await this.eventOutboxService.findDeliveryRow(id);

		if (!delivery) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: delivery '${String(id)}' could not be found.`
			);
		}

		return delivery;
	}

	/**
	 * Re-drives one record: the attempt budget is reset and the retry scan will invoke the consumer
	 * again with the same event id. Safe to repeat, and the consumer's own idempotency check is what
	 * keeps a partially applied effect from being applied twice.
	 *
	 * @param id The record to re-drive.
	 * @returns The record as it stands afterwards, `PENDING`.
	 */
	@ApiOperation({ summary: 'Re-drive one delivery record' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery record re-queued' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_RETRY)
	@Idempotent({ scope: 'event.delivery.replay', resourceType: 'event_delivery' })
	@HttpCode(HttpStatus.OK)
	@Post(':id/replay')
	async replay(@Param('id', UUIDValidationPipe) id: ID): Promise<IEventDelivery> {
		return this.eventOutboxService.replayDelivery(id);
	}

	/**
	 * Stops one record: it is dead-lettered with the reason the caller states, and no further attempt
	 * is made. The reason is required and lands on the record's `lastError`, because a dead letter
	 * that does not say why destroys the diagnosis that made the move necessary.
	 *
	 * @param id The record to stop.
	 * @param entity The reason it is being stopped.
	 * @returns The record as it stands afterwards, `DEAD`.
	 */
	@ApiOperation({ summary: 'Dead-letter one delivery record' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Delivery record dead-lettered' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_REQUIRED_FIELD' })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_RETRY)
	@Idempotent({ scope: 'event.delivery.mark-dead', resourceType: 'event_delivery' })
	@HttpCode(HttpStatus.OK)
	@Post(':id/mark-dead')
	@UseValidationPipe({ transform: true, whitelist: true })
	async markDead(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: MarkEventDeliveryDeadDTO
	): Promise<IEventDelivery> {
		return this.eventOutboxService.deadLetterDelivery(id, entity.reason);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: EventDeliveryQueryDTO): {
		status?: EventOutboxStatus;
		consumerKey?: string;
		eventId?: ID;
	} {
		const stated: { status?: EventOutboxStatus; consumerKey?: string; eventId?: ID } = {};

		for (const member of ['status', 'consumerKey', 'eventId'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null && value !== '') {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
