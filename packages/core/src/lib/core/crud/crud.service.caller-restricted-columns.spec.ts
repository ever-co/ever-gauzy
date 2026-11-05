import '../entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityMetadata, getMetadataArgsStorage, IsNull, MoreThanOrEqual, Not } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { BaseEntity } from '../entities/internal';
import { MultiORMEnum } from '../utils';
import { CALLER_REFUSED_COLUMNS } from '../util/caller-restricted-columns.config';
import { TokenRepository } from '../../token/repositories/token.repository';
import { PasswordResetGetHandler } from '../../password-reset/commands/handlers/password-reset.get.handler';
import { PasswordResetGetCommand } from '../../password-reset/commands/password-reset.get.command';
import { CrudService } from './crud.service';

/**
 * Drives the CRUD read methods with a fake repository and the query or body each route receives, so a refused
 * read never reaches the ORM. The entities are synthetic and carry the real relation names.
 */
type MetadataFactory = () => EntityMetadata;

function relationTo(relations: Record<string, MetadataFactory>, propertyPath: string) {
	const declared = Object.hasOwn(relations, propertyPath);
	if (!declared) {
		return undefined;
	}
	return { inverseEntityMetadata: relations[propertyPath]() };
}

function entity(name: string, relations: Record<string, MetadataFactory> = {}): EntityMetadata {
	return {
		name,
		tableName: name.toLowerCase(),
		findRelationWithPropertyPath: (propertyPath: string) => relationTo(relations, propertyPath)
	} as unknown as EntityMetadata;
}

const USER = (): EntityMetadata => entity('User');
const EMPLOYEE = (): EntityMetadata => entity('Employee', { user: USER });
const TIME_LOG = (): EntityMetadata => entity('TimeLog', { employee: EMPLOYEE });
const INVITE = (): EntityMetadata => entity('Invite', { user: USER, invitedByUser: USER });
const PROJECT_MEMBER = (): EntityMetadata => entity('OrganizationProjectEmployee', { employee: EMPLOYEE });
const PROJECT = (): EntityMetadata => entity('OrganizationProject', { members: PROJECT_MEMBER });
const PASSWORD_RESET = (): EntityMetadata => entity('PasswordReset');
const TOKEN = (): EntityMetadata => entity('Token');

class SyntheticCrudService extends CrudService<BaseEntity> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown = {}) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

function fakeRepository(metadata: EntityMetadata) {
	return {
		metadata,
		findAndCount: jest.fn().mockResolvedValue([[], 0]),
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn().mockResolvedValue({ id: 'row' }),
		findOneBy: jest.fn().mockResolvedValue({ id: 'row' }),
		count: jest.fn().mockResolvedValue(0)
	};
}

type FakeRepository = ReturnType<typeof fakeRepository>;

interface FakeRequest {
	query?: Record<string, unknown>;
	body?: Record<string, unknown>;
}

describe('CrudService caller-restricted columns', () => {
	let request: FakeRequest | null;
	let granted: PermissionsEnum[];

	function serviceOver(metadata: EntityMetadata): { repository: FakeRepository; service: SyntheticCrudService } {
		const repository = fakeRepository(metadata);
		const service = new SyntheticCrudService(repository);
		return { repository, service };
	}

	beforeEach(() => {
		request = null;
		granted = [];
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentRequest').mockImplementation(() => request);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('credential columns', () => {
		it('refuses a nested filter on a user credential through the invite list (GET /invite)', async () => {
			const where = { user: { hash: '$2b$10$abc' } };
			request = { query: { where } };
			const { repository, service } = serviceOver(INVITE());

			const read = service.findAll({ where: [{ tenantId: 'tenant', ...where }] } as any);

			await expect(read).rejects.toThrow(BadRequestException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
		});

		it('refuses a nested sort on a user credential through the employee list (GET /employee)', async () => {
			const order = { user: { refreshToken: 'ASC' } };
			request = { query: { order } };
			const { repository, service } = serviceOver(EMPLOYEE());

			const read = service.findAll({ where: { user: { isActive: true, isArchived: false } }, order } as any);

			await expect(read).rejects.toThrow(BadRequestException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
		});

		it.each([
			['filter', { where: { employee: { user: { code: '123456' } } } }],
			['sort', { order: { employee: { user: { hash: 'DESC' } } } }]
		])('refuses a two-level %s through a time log by id (GET /timesheet/time-log/:id)', async (_label, query) => {
			request = { query };
			const { repository, service } = serviceOver(TIME_LOG());

			await expect(service.findOneByIdString('log-id', query as any)).rejects.toThrow(BadRequestException);
			expect(repository.findOne).not.toHaveBeenCalled();
		});

		it('refuses the query string a count route hands over as the filter (GET /user/count)', async () => {
			const query = { code: '123456' };
			request = { query };
			const { repository, service } = serviceOver(USER());

			await expect(service.countBy({ ...query, tenantId: 'tenant' } as any)).rejects.toThrow(BadRequestException);
			expect(repository.count).not.toHaveBeenCalled();
		});

		it('refuses a credential named in the legacy data parameter', async () => {
			const findInput = { user: { emailToken: 'x' } };
			request = { query: { data: JSON.stringify({ findInput }) } };
			const { service } = serviceOver(EMPLOYEE());

			await expect(service.find({ where: findInput } as any)).rejects.toThrow(BadRequestException);
		});

		it('refuses a credential in a legacy select list', async () => {
			request = { query: { select: ['email', 'refreshToken'] } };
			const { service } = serviceOver(USER());

			await expect(service.paginate({ select: ['email', 'refreshToken'] } as any)).rejects.toThrow(
				BadRequestException
			);
		});

		it('refuses a caller holding every permission', async () => {
			granted = Object.values(PermissionsEnum);
			const order = { user: { hash: 'ASC' } };
			request = { query: { order } };
			const { service } = serviceOver(EMPLOYEE());

			await expect(service.findAll({ order } as any)).rejects.toThrow(BadRequestException);
		});

		it('refuses before the MikroORM read as well', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			const where = { user: { hash: 'x' } };
			request = { query: { where } };
			const mikroOrmRepository = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
			const service = new SyntheticCrudService(fakeRepository(EMPLOYEE()), mikroOrmRepository);

			await expect(service.findAll({ where } as any)).rejects.toThrow(BadRequestException);
			expect(mikroOrmRepository.findAndCount).not.toHaveBeenCalled();
		});

		it('refuses a filter nested deeper than it can check, instead of running it unchecked', async () => {
			let where: unknown = { user: { hash: 'x' } };
			for (let level = 0; level < 13; level++) {
				where = [where];
			}
			request = { query: { where } };
			const { repository, service } = serviceOver(INVITE());

			await expect(service.findAll({ where } as any)).rejects.toThrow(BadRequestException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
		});

		it('refuses a read that nests the caller filter deeper than it can check', async () => {
			const callerWhere = { user: { hash: 'x' } };
			let readWhere: unknown = callerWhere;
			for (let level = 0; level < 13; level++) {
				readWhere = [readWhere];
			}
			request = { query: { where: callerWhere } };
			const { repository, service } = serviceOver(INVITE());

			await expect(service.findAll({ where: readWhere } as any)).rejects.toThrow(BadRequestException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
		});
	});

	describe('rate columns', () => {
		type RateRead = (service: SyntheticCrudService, query: Record<string, unknown>) => Promise<unknown>;

		const list: RateRead = (service, query) => service.findAll(query as any);
		const byId: RateRead = (service, query) => service.findOneByIdString('row-id', query as any);

		const RATE_CASES: Array<[string, MetadataFactory, Record<string, unknown>, RateRead]> = [
			['a pay rate filter on the employee list', EMPLOYEE, { where: { payRateValue: '40' } }, list],
			['a pay rate sort on the employee list', EMPLOYEE, { order: { payRateCurrency: 'ASC' } }, list],
			['a pay rate filter through a time log', TIME_LOG, { where: { employee: { payRateValue: '40' } } }, byId],
			['a pay rate sort through a time log', TIME_LOG, { order: { employee: { payRateValue: 'DESC' } } }, byId],
			['a project client rate sort', PROJECT, { order: { billRateValue: 'DESC' } }, list],
			['a member client rate filter', PROJECT, { where: { members: { billRateValue: '90' } } }, list]
		];

		it.each(RATE_CASES)('refuses %s without the right that sets rates', async (_label, metadata, query, read) => {
			granted = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			request = { query };
			const { repository, service } = serviceOver(metadata());

			await expect(read(service, query)).rejects.toThrow(ForbiddenException);
			expect(repository.findAndCount).not.toHaveBeenCalled();
			expect(repository.findOne).not.toHaveBeenCalled();
		});

		it.each(RATE_CASES)('lets a rate editor run %s', async (_label, metadata, query, read) => {
			granted = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
			request = { query };
			const { service } = serviceOver(metadata());

			await expect(read(service, query)).resolves.toBeDefined();
		});
	});

	describe('reads that keep working', () => {
		it('runs a nested filter and sort on ordinary columns', async () => {
			const where = { user: { firstName: 'Ann' }, isActive: true };
			const order = { user: { lastName: 'ASC' } };
			request = { query: { where, order } };
			const { repository, service } = serviceOver(EMPLOYEE());

			await expect(service.findAll({ where, order } as any)).resolves.toEqual({ items: [], total: 0 });
			expect(repository.findAndCount).toHaveBeenCalledWith({ where, order });
		});

		it('runs a server lookup by a credential outside any request', async () => {
			const { repository, service } = serviceOver(USER());

			await expect(service.find({ where: { refreshToken: 'stored' } } as any)).resolves.toEqual([]);
			expect(repository.find).toHaveBeenCalled();
		});

		it('runs a server lookup by a credential while the caller filters on other columns', async () => {
			request = { query: { where: { name: 'Ann' }, order: { createdAt: 'DESC' } } };
			const { repository, service } = serviceOver(USER());

			await expect(service.findOneByWhereOptions({ emailToken: 'stored' } as any)).resolves.toEqual({
				id: 'row'
			});
			expect(repository.findOneBy).toHaveBeenCalledWith({ emailToken: 'stored' });
		});

		it('invite accept: the invite looked up by email and token or code', async () => {
			request = { body: { email: 'ann@example.com', token: 'raw-token', code: '123456', password: 'x' } };
			const { repository, service } = serviceOver(INVITE());

			const byToken = { where: { email: 'ann@example.com', token: 'raw-token', status: 'INVITED' } };
			const byCode = { where: { email: 'ann@example.com', code: '123456', status: 'INVITED' } };

			await expect(service.findOneByOptions(byToken as any)).resolves.toEqual({ id: 'row' });
			await expect(service.findOneByOptions(byCode as any)).resolves.toEqual({ id: 'row' });
			expect(repository.findOne).toHaveBeenCalledTimes(2);
		});

		it('email verification by code: the user looked up by email, code and expiry', async () => {
			request = { body: { email: 'ann@example.com', code: '123456', tenantId: 'tenant' } };
			const { repository, service } = serviceOver(USER());

			const byCode = {
				where: {
					email: 'ann@example.com',
					code: '123456',
					tenantId: 'tenant',
					codeExpireAt: MoreThanOrEqual(new Date())
				}
			};

			await expect(service.findOneByOptions(byCode as any)).resolves.toEqual({ id: 'row' });
			expect(repository.findOne).toHaveBeenCalled();
		});

		it('password reset: the reset request found by its token', async () => {
			request = { body: { token: 'raw-token', password: 'x', confirmPassword: 'x' } };
			const { repository, service } = serviceOver(PASSWORD_RESET());
			const handler = new PasswordResetGetHandler(service as any);

			await expect(handler.execute(new PasswordResetGetCommand({ token: 'raw-token' }))).resolves.toEqual({
				id: 'row'
			});
			expect(repository.findOne).toHaveBeenCalledWith(
				expect.objectContaining({ where: expect.objectContaining({ token: 'raw-token' }) })
			);
		});

		it('code and password sign-in: users found by code and expiry, or by a stored hash', async () => {
			request = { body: { email: 'ann@example.com', code: '123456' } };
			const { repository, service } = serviceOver(USER());

			const byCode = {
				where: { email: 'ann@example.com', code: '123456', codeExpireAt: MoreThanOrEqual(new Date()) }
			};
			const byPassword = {
				where: { email: 'ann@example.com', isActive: true, isArchived: false, hash: Not(IsNull()) },
				relations: { role: true },
				order: { updatedAt: 'DESC' }
			};

			await expect(service.find(byCode as any)).resolves.toEqual([]);
			await expect(service.find(byPassword as any)).resolves.toEqual([]);
			expect(repository.find).toHaveBeenCalledTimes(2);
		});

		it('token refresh: the stored token found by its hash', async () => {
			request = { body: { refresh_token: 'raw-refresh-token' } };
			const repository = fakeRepository(TOKEN());
			const tokens = new TokenRepository(repository as any, {} as any);

			await expect(tokens.findByHash('stored-hash')).resolves.toEqual({ id: 'row' });
			expect(repository.findOneBy).toHaveBeenCalledWith({ tokenHash: 'stored-hash' });
		});
	});

	describe('the credential list', () => {
		it.each(Object.entries(CALLER_REFUSED_COLUMNS))('names real columns of %s', (entityName, columns) => {
			const storage = getMetadataArgsStorage();
			const table = storage.tables.find(
				(candidate) => typeof candidate.target === 'function' && candidate.target.name === entityName
			);
			const declared = storage.columns
				.filter((column) => column.target === table?.target)
				.map((column) => column.propertyName);

			expect(table).toBeDefined();
			expect(declared).toEqual(expect.arrayContaining([...columns]));
		});
	});
});
