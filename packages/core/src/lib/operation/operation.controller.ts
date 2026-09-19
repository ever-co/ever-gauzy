import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IOperation, IOperationStep, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OperationService } from './operation.service';
import { CancelOperationDTO, OperationQueryDTO } from './dto';

/**
 * One operation as this resource answers it: the row, with its step list attached.
 *
 * The contracts' `IOperation` is the header — what the runtime writes and what a step of another
 * operation is handed — and the plan is the steps, which are their own rows. The two travel together
 * on this route because an operator's next question after "which operation" is always "which step",
 * and the relation is the same one the GraphQL type answers as `steps`.
 */
export interface IOperationDetail extends IOperation {
	/** The steps of the operation, ascending by `order`. */
	steps: IOperationStep[];
}

/**
 * The durable-operation inspector over REST.
 *
 * **This is a read-model and action controller, not an entity's CRUD.** The endpoint table of the API
 * specification lists exactly the routes below for `/operations` — the list, one operation, and the
 * two moves — because an operation is not authored by a caller: it is started by the capability that
 * needs it (a checkout, a capture, a subscription billing run) and what an operator does with one is
 * inspect it, cancel it or retry it. There is deliberately no create, no update and no delete here:
 * a row a request could write by hand would be a plan the runtime would then execute, and a row a
 * request could delete would be the audit trail of an aggregate's failed attempt.
 *
 * **Every route speaks through `OperationService`**, which owns the state machine, the lease and the
 * compensation walk. This class adds permissions, validation and the list envelope — never a second
 * copy of a rule, and never a status write of its own: a route that moved an operation by writing the
 * column would be a status the runtime could not explain.
 *
 * **Every route is an operator's.** The reads carry `OPERATIONS_VIEW` and the two moves carry
 * `OPERATIONS_CANCEL`, which are the catalogue's own codes for exactly these capabilities — a
 * cancelled operation runs compensation and can reverse work that has already been performed, which
 * is why the move is not granted wherever a generic organization edit is. The permissions are stated
 * per route as well as on the class, so the metadata a guard reads is the metadata the GraphQL
 * resolver is held to.
 */
@ApiTags('Operations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.OPERATIONS_VIEW)
@Controller('/operations')
export class OperationController {
	constructor(private readonly operationService: OperationService) {}

	/**
	 * Lists the operations of the caller's tenant, newest first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of operations, with the total the narrowing selects.
	 */
	@ApiOperation({ summary: 'List durable operations' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Operations retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: OperationQueryDTO): Promise<IPagination<IOperation>> {
		// The narrowing the endpoint table names is pushed into the read, and the page is applied to
		// what comes back: the GraphQL connection narrows the same rows with the same values and pages
		// them with the same two numbers, so the two surfaces answer one list under two spellings.
		const rows = await this.operationService.listOperations({ where: this.narrowing(query) });
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one operation: its status, its state, its result and its step list.
	 *
	 * The step rows travel with the operation because an operator's next question is always which step
	 * it is on — the step list is what names the step a failure left, and it is the same relation the
	 * GraphQL type answers as `steps`.
	 *
	 * @param id The operation to read.
	 * @returns The operation.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	@ApiOperation({ summary: 'Find a durable operation by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Operation retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'OPERATION_NOT_FOUND' })
	@Permissions(PermissionsEnum.OPERATIONS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IOperationDetail> {
		const operation = await this.operationService.findOperation(id);

		if (!operation) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: operation '${String(id)}' could not be found.`
			);
		}

		const steps = await this.operationService.findSteps(id);

		return { ...operation, steps } as IOperationDetail;
	}

	/**
	 * Requests cancellation, which compensates what the operation already applied.
	 *
	 * The answer is `202` because that is what the route establishes: a cancellation is a request the
	 * runtime observes at its next checkpoint rather than a kill, and the operation the body carries is
	 * the operation as the request left it — which is already settled when it had applied nothing, and
	 * compensating when it had.
	 *
	 * @param id The operation to cancel.
	 * @param entity The reason the operator records.
	 * @returns The operation as the cancellation left it.
	 */
	@ApiOperation({ summary: 'Cancel a durable operation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Cancellation recorded' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'OPERATION_NOT_CANCELABLE' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'OPERATION_NOT_FOUND' })
	@Permissions(PermissionsEnum.OPERATIONS_CANCEL)
	@HttpCode(HttpStatus.ACCEPTED)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Body() entity?: CancelOperationDTO): Promise<IOperation> {
		return this.operationService.cancel(id, { reason: entity?.reason });
	}

	/**
	 * Re-drives an operation that failed, under a fresh attempt budget.
	 *
	 * The answer is `200` rather than `202`: the retry drives the operation as far as this pass can
	 * take it and answers with the operation where it stands, exactly as the GraphQL mutation does.
	 * The route takes no body — the runtime's own rule decides where a retry continues, from the
	 * persisted step statuses, so a caller-stated starting step would be an argument that could not
	 * change the answer.
	 *
	 * @param id The operation to retry.
	 * @returns The operation as the retry left it.
	 */
	@ApiOperation({ summary: 'Retry a failed durable operation' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Retry driven' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The operation completed, or a caller cancelled it' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'OPERATION_NOT_FOUND' })
	@Permissions(PermissionsEnum.OPERATIONS_CANCEL)
	@HttpCode(HttpStatus.OK)
	@Post(':id/retry')
	async retry(@Param('id', UUIDValidationPipe) id: ID): Promise<IOperation> {
		const { operation } = await this.operationService.retry(id);

		return operation;
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a
	 * repository handed an explicit `undefined` asks the database for a row whose column *is* null —
	 * which is a different question from "do not narrow on this column".
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: OperationQueryDTO): Record<string, unknown> {
		const stated: Record<string, unknown> = {};

		for (const member of [
			'type',
			'status',
			'aggregateType',
			'aggregateId',
			'parentOperationId',
			'correlationId',
			'idempotencyKey'
		] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null && value !== '') {
				stated[member] = value;
			}
		}

		return stated;
	}
}
