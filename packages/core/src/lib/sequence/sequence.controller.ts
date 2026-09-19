import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, ISequence, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { SequenceService } from './sequence.service';
import { CreateSequenceDTO, SequenceQueryDTO, UpdateSequenceDTO } from './dto';

/**
 * The numbering series of the organization, over REST.
 *
 * **A series is administration, and that is what its permission pair says.** Nothing a shopper does
 * reaches these routes: what they carry is how this installation's documents are numbered, which is a
 * decision an administrator makes once and an auditor reads afterwards. The resource is therefore
 * guarded with the catalogue's own `SEQUENCES_VIEW` on its reads and `SEQUENCES_EDIT` on its writes —
 * the pair `06-api-specification.md` §7.3 names for it, and the pair the catalogue already declares
 * under "Platform: channels, regions, rules, numbering, operations, outbox, idempotency".
 *
 * **The counter is not a document number, and the routes are shaped around that.** A row of this
 * resource holds the shape of the numbers a series produces *and* the value the next document will be
 * numbered with. The shape is edited — a prefix, a width, a step, a restart policy. The value is not:
 * it moves when a number is allocated, and backwards only through the restart the series' own policy
 * describes, which is the `POST /sequences/:id/reset` route and the operation it calls. A caller that
 * could write the counter through an edit would renumber documents that are already printed and
 * quoted, which is why the edit body does not carry it, the route refuses a body that states it, and
 * the reset is a move of its own rather than a column write.
 *
 * **Five routes and no more, and the surface is the design's.** §7.3 names the list, the detail, the
 * create, the edit, the removal and the reset, and `17-graphql-api-specification.md` §3.3 declares
 * this domain's complete set of GraphQL root fields as `sequences`, `sequence(id)`, `createSequence`,
 * `updateSequence` and `resetSequence`. Parity is capability parity (§3.1), so the surface delivered
 * here is the five routes those five fields mirror, and the base `CrudController` is deliberately not
 * extended: inheriting it would serve a count, a paginated twin of the list, a hard removal and a
 * withdrawal/restoration pair that no field mirrors, and a hard removal of a numbering series is the
 * one operation this resource must not offer — the row *is* the counter, so removing it answers every
 * later allocation for its key "no series is configured", and creating the series again starts at one
 * and issues numbers the removed row had already issued. Retiring a series is `isActive: false`
 * through the edit, which allocation already refuses with a reason and which an operator can undo.
 *
 * **Every route speaks through `SequenceService`**, which owns the domain's rules: which series a key
 * resolves to, what a scope is, what a create stamps, which members an edit may write, and what a
 * restart is. This class adds permissions, validation and the list envelope — never a second copy of a
 * rule. The reads are scoped by the service from the credential, so no route states a tenant or an
 * organization a caller could choose.
 */
@ApiTags('Sequence')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.SEQUENCES_VIEW)
@Controller('/sequences')
export class SequenceController {
	constructor(private readonly sequenceService: SequenceService) {}

	/**
	 * Lists the numbering series of the caller's organization.
	 *
	 * @param query The narrowing: one key, one channel, or neither.
	 * @returns One page of series, by key.
	 */
	@ApiOperation({ summary: 'List numbering series' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Numbering series retrieved' })
	@Permissions(PermissionsEnum.SEQUENCES_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: SequenceQueryDTO): Promise<IPagination<ISequence>> {
		const items = await this.sequenceService.listSeries(this.narrowing(query));

		return { items, total: items.length };
	}

	/**
	 * Reads one numbering series.
	 *
	 * @param id The series to read.
	 * @returns The series.
	 */
	@ApiOperation({ summary: 'Find a numbering series by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Numbering series retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.SEQUENCES_VIEW)
	@Get('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<ISequence> {
		return this.sequenceService.findSeriesOrFail(id);
	}

	/**
	 * Opens a numbering series.
	 *
	 * @param entity The series as the caller states it.
	 * @returns The stored series.
	 */
	@ApiOperation({ summary: 'Create a numbering series' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Numbering series created' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'VALIDATION_REQUIRED_FIELD, UNIQUE_CONSTRAINT_VIOLATION'
	})
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSequenceDTO): Promise<ISequence> {
		return this.sequenceService.createSeries(entity);
	}

	/**
	 * Changes the configuration of a numbering series.
	 *
	 * **The body is closed, and that is the safety property rather than a style.** The counter is not a
	 * member of the DTO, and a request that states one is refused as an unknown field instead of having
	 * it stripped quietly: a caller that believed it set `nextValue` and was answered `200` has a bug it
	 * would otherwise never see, and the document numbers it expected to change would silently not
	 * change. What may be stated is the shape of the numbers — the prefix, the width, the step, the
	 * restart policy, the operator note — and `isActive`, which retires the series without removing its
	 * counter.
	 *
	 * @param id The series to change.
	 * @param entity The configuration to change.
	 * @returns The stored series.
	 */
	@ApiOperation({ summary: 'Update a numbering series' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Numbering series updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_UNKNOWN_FIELD, PRECONDITION_REQUIRED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateSequenceDTO): Promise<ISequence> {
		return this.sequenceService.updateSeries(id, entity);
	}

	/**
	 * Restarts a series.
	 *
	 * The restart is the series' own: `SequenceService.resetSeries` performs the move the allocator
	 * performs when a period has elapsed — rewind the counter to the value a period starts at and
	 * record the moment — under the same row lock and inside the same kind of transaction, and it
	 * declines with the kernel's own reason when the series' policy says no restart is due. This route
	 * adds nothing to that decision.
	 *
	 * It is a `POST` and not a `PUT`: the operation does not state the series' next value, it performs a
	 * move on the series and answers the row the move produced. The endpoint table's `nextValue` request
	 * member is deliberately not bound — a caller-stated counter written straight to the column is
	 * precisely the renumbering this resource's shape exists to prevent, and the kernel's restart has
	 * exactly one destination, which is one.
	 *
	 * @param id The series to restart.
	 * @returns The stored series, rewound, with the restart recorded.
	 */
	@ApiOperation({ summary: 'Restart a numbering series' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Numbering series restarted' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PRECONDITION_REQUIRED' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post('/:id/reset')
	async reset(@Param('id', UUIDValidationPipe) id: ID): Promise<ISequence> {
		return this.sequenceService.resetSeries(id);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a repository
	 * handed an explicit `undefined` asks the database for a row whose column *is* null — a different
	 * question from "do not narrow on this column". The bracketed spelling wins when both are stated,
	 * because that is the spelling the endpoint table fixes.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: SequenceQueryDTO): { key?: string; channelId?: ID } {
		const stated: { key?: string; channelId?: ID } = {};

		for (const member of ['key', 'channelId'] as const) {
			const value = query?.filter?.[member] ?? query?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		return stated;
	}
}
