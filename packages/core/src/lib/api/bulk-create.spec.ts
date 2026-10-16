import {
	BadRequestException,
	Body,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
	PipeTransform,
	Post,
	ValidationPipe
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { UseValidationPipe } from '../shared/pipes/use-validation.pipe';
import {
	applyAsSingleCreate,
	assertSingleRouteGuard,
	bulkCreateRequest,
	singleRouteBody,
	toBulkCreatePayload,
	toBulkItemRefusal
} from './bulk-create';
import { IBulkItemContext } from './bulk-executor.service';

/**
 * What a create-only batch adds to the platform's bulk contract, stated once for the six resources that
 * serve one: the body it accepts, the item it hands the single-item create, the refusal it reports, the
 * payload it answers.
 */

const context = (index: number): IBulkItemContext => ({
	index,
	op: 'upsert',
	mode: 'upsert',
	dryRun: false,
	atomic: false
});

/** A single-item body type with the class-validator decorators a route's DTO carries. */
class LabelDTO {
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@IsOptional()
	@IsString()
	readonly color?: string;
}

describe('bulkCreateRequest — the body a create-only route accepts', () => {
	it('hands the executor the items and the atomic flag, and nothing else', () => {
		const items = [{ name: 'a' }];

		expect(bulkCreateRequest({ items, atomic: true })).toEqual({ items, atomic: true });
	});

	it.each(['dryRun', 'mode'])('refuses the undeclared member "%s" before any item is applied', (member) => {
		const refusal = (() => {
			try {
				bulkCreateRequest({ items: [{ name: 'a' }], [member]: member === 'mode' ? 'upsert' : true } as never);
			} catch (thrown) {
				return thrown;
			}
		})();

		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect((refusal as ApiException).details).toEqual({ field: member });
	});

	it('hands a body that is not an object on as it is, for the executor to refuse in the contract’s words', () => {
		expect(bulkCreateRequest(undefined as never)).toBeUndefined();
	});
});

/** Uppercases a body's name, the way a route's own transform pipe would rewrite a body. */
@Injectable()
class ShoutPipe implements PipeTransform {
	transform(value: { name?: string }) {
		return typeof value?.name === 'string' ? { ...value, name: value.name.toUpperCase() } : value;
	}
}

/** Two single-item routes, declaring their pipes in the two places a route can. */
class LabelController {
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: LabelDTO): Promise<LabelDTO> {
		return entity;
	}

	@Post('/shout')
	async shout(
		@Body(ShoutPipe, new ValidationPipe({ transform: true, whitelist: true })) entity: LabelDTO
	): Promise<LabelDTO> {
		return entity;
	}

	@Post('/none')
	async none(): Promise<void> {
		return undefined;
	}
}

describe('singleRouteBody — the single route’s own pipes, item by item', () => {
	it('strips what the route’s whitelist strips and answers what the route’s handler would receive', async () => {
		const validate = singleRouteBody<LabelDTO>(LabelController, 'create');

		expect(await validate({ name: 'Urgent', color: '#f00', tenantId: 'another-tenant' })).toEqual({
			name: 'Urgent',
			color: '#f00'
		});
	});

	it('refuses what the route refuses, with the pipe’s own messages', async () => {
		const validate = singleRouteBody<LabelDTO>(LabelController, 'create');

		const refusal = await validate({ color: 7 }).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect((refusal as BadRequestException).getResponse()).toMatchObject({
			message: expect.arrayContaining(['name should not be empty', 'color must be a string'])
		});
	});

	it('runs the pipes stated on the parameter, in the order the route runs them, with its body type', async () => {
		const validate = singleRouteBody<LabelDTO>(LabelController, 'shout');

		const body = await validate({ name: 'urgent', extra: true });

		// The transform pipe ran first and the validation pipe second — with `transform: true`, so the
		// handler receives an instance of the declared body type, as the route's handler does.
		expect(body).toBeInstanceOf(LabelDTO);
		expect(body).toEqual(Object.assign(new LabelDTO(), { name: 'URGENT' }));
	});

	it('refuses, as a programming mistake, a route that takes no body', () => {
		expect(() => singleRouteBody(LabelController, 'none')).toThrow(/takes no @Body\(\)/);
	});
});

describe('applyAsSingleCreate — one item through the single-item create', () => {
	it('hands the create the item without its operation, and reports the row it created', async () => {
		const create = jest.fn().mockResolvedValue({ id: 'row-1', name: 'Urgent' });

		const outcome = await applyAsSingleCreate({ op: 'create', name: 'Urgent' } as never, context(3), create);

		expect(create).toHaveBeenCalledWith({ name: 'Urgent' });
		expect(outcome).toEqual({ index: 3, id: 'row-1' });
	});

	it('refuses an item that names any operation but create, without running the create', async () => {
		const create = jest.fn();

		const refusal = await applyAsSingleCreate({ op: 'delete', id: 'row-1' } as never, context(0), create).catch(
			(thrown) => thrown
		);

		expect((refusal as ApiException).code).toBe(ApiErrorCode.VALIDATION_INVALID_ENUM);
		expect((refusal as ApiException).details).toEqual({ field: 'op', allowed: ['create'] });
		expect(create).not.toHaveBeenCalled();
	});

	it('reports the create’s own refusal with its reason, not as an internal failure', async () => {
		const create = jest
			.fn()
			.mockRejectedValue(new ForbiddenException('Only a super admin may assign the super admin role.'));

		const refusal = await applyAsSingleCreate({ email: 'a@b.c' } as never, context(1), create).catch(
			(thrown) => thrown
		);

		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).getStatus()).toBe(403);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect((refusal as ApiException).message).toBe('Only a super admin may assign the super admin role.');
	});
});

describe('toBulkItemRefusal — a single-item refusal in the batch’s vocabulary', () => {
	it('keeps an ApiException as it stands', () => {
		const refusal = new ApiException(409, ApiErrorCode.UNIQUE_CONSTRAINT_VIOLATION, 'Taken.', { field: 'name' });

		expect(toBulkItemRefusal(refusal)).toBe(refusal);
	});

	it('gives a validation pipe’s refusal the envelope’s code for its status, with every message', () => {
		const refusal = toBulkItemRefusal(
			new BadRequestException({
				statusCode: 400,
				message: ['name should not be empty', 'color must be a string'],
				error: 'Bad Request'
			})
		) as ApiException;

		expect(refusal.getStatus()).toBe(400);
		expect(refusal.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(refusal.message).toBe('name should not be empty; color must be a string');
		expect(refusal.details).toEqual({ messages: ['name should not be empty', 'color must be a string'] });
	});

	it('keeps a miss a miss', () => {
		const refusal = toBulkItemRefusal(new NotFoundException('The employee was not found')) as ApiException;

		expect(refusal.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
		expect(refusal.message).toBe('The employee was not found');
	});

	it('describes a database error by its code and never repeats the driver’s text', () => {
		const driverError = Object.assign(
			new Error('duplicate key value violates unique constraint "user_email_key"'),
			{
				code: '23505',
				driverError: {}
			}
		);
		// The shape a handler produces when it wraps what it caught: `{ message, error }`.
		const wrapped = new HttpException({ message: driverError.message, error: driverError }, HttpStatus.BAD_REQUEST);

		const refusal = toBulkItemRefusal(wrapped) as ApiException;

		expect(refusal.code).toBe(ApiErrorCode.INTERNAL_ERROR);
		expect(refusal.message).toBe('A record with these values already exists.');
		expect(JSON.stringify(refusal.getResponse())).not.toContain('user_email_key');
		// A raw driver error is described the same way.
		expect((toBulkItemRefusal(driverError) as ApiException).message).toBe(
			'A record with these values already exists.'
		);
	});

	it('replaces driver text a handler interpolated into its own message', () => {
		const refusal = toBulkItemRefusal(
			new BadRequestException(
				'Failed to add manual time log: violates foreign key constraint "FK_time_log_employee"'
			)
		) as ApiException;

		expect(refusal.message).toBe('A related record referenced by this request does not exist.');
	});

	it('hands back a server failure and an untyped error for the executor to report without their text', () => {
		const server = new HttpException('Error while retrieving employee information', 500);
		const plain = new Error('Cannot read properties of undefined');

		expect(toBulkItemRefusal(server)).toBe(server);
		expect(toBulkItemRefusal(plain)).toBe(plain);
	});
});

describe('assertSingleRouteGuard — a body-reading guard of the single route, asked per item', () => {
	/** Admits a body naming an organization whose policy allows it, reading the route's metadata as Nest would. */
	const policyGuard = (allowed: string[]): CanActivate & { seen: unknown[] } => {
		const seen: unknown[] = [];

		return {
			seen,
			canActivate: async (context: ExecutionContext) => {
				seen.push([context.getClass(), context.getHandler()]);

				return allowed.includes(context.switchToHttp().getRequest().body?.organizationId);
			}
		};
	};

	it('hands the guard the item as the body, with the single route’s class and handler', async () => {
		const guard = policyGuard(['org-a']);

		await expect(
			assertSingleRouteGuard(guard, LabelController, 'create', { organizationId: 'org-a' })
		).resolves.toBeUndefined();
		expect(guard.seen).toEqual([[LabelController, LabelController.prototype.create]]);
	});

	it('refuses the item with the 403 Nest answers a refused route with', async () => {
		const refusal = await assertSingleRouteGuard(policyGuard(['org-a']), LabelController, 'create', {
			organizationId: 'org-b'
		}).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).getStatus()).toBe(403);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
	});
});

describe('toBulkCreatePayload — the GraphQL view of the batch', () => {
	it('answers one entry per item, in order, with the path each failure belongs to and the counts', () => {
		const payload = toBulkCreatePayload({
			dryRun: false,
			succeededCount: 1,
			failedCount: 1,
			total: 2,
			succeeded: [{ index: 0, id: 'row-1', resource: 'tag' }],
			failed: [{ index: 1, code: ApiErrorCode.VALIDATION_FAILED, message: 'name should not be empty' }]
		});

		expect(payload).toEqual({
			results: [
				{ index: 0, ok: true, id: 'row-1', resource: 'tag', error: undefined },
				{
					index: 1,
					ok: false,
					id: undefined,
					resource: undefined,
					error: {
						code: ApiErrorCode.VALIDATION_FAILED,
						message: 'name should not be empty',
						details: undefined,
						path: ['items', '1']
					}
				}
			],
			succeeded: 1,
			failed: 1,
			total: 2
		});
	});
});
