import '../entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { CrudService } from '../crud/crud.service';
import { assertCallerColumnsAllowed } from './caller-restricted-columns.helper';
import { MultiORMEnum } from '../utils';
import { TaskService } from '../../tasks/task.service';
import { DailyPlanService } from '../../tasks/daily-plan/daily-plan.service';
import { OrganizationProjectModuleService } from '../../organization-project-module/organization-project-module.service';
import { OrganizationTeamService } from '../../organization-team/organization-team.service';
import { EmailTemplateService } from '../../email-template/email-template.service';
import { AccountingTemplateService } from '../../accounting-template/accounting-template.service';

/**
 * The list reads that build their own query from the caller's options never reach the CRUD read methods, so each
 * asserts the column rule itself. Every read below runs on a service instance whose store fails on first use: a
 * refused read never reaches it, an accepted one does.
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
const PROJECT = (): EntityMetadata => entity('OrganizationProject', { createdByUser: USER });
const withAuthor = (name: string, relations: Record<string, MetadataFactory> = {}): MetadataFactory => {
	return () => entity(name, { createdByUser: USER, ...relations });
};
const TASK = withAuthor('Task', { members: EMPLOYEE, project: PROJECT });
const DAILY_PLAN = withAuthor('DailyPlan', { employee: EMPLOYEE });
const PROJECT_MODULE = withAuthor('OrganizationProjectModule', { project: PROJECT });
const TEAM = withAuthor('OrganizationTeam', { projects: PROJECT });
const EMAIL_TEMPLATE = withAuthor('EmailTemplate');
const ACCOUNTING_TEMPLATE = withAuthor('AccountingTemplate');

const STORE_REACHED = 'store reached';

function failingStore(metadata: EntityMetadata) {
	const reach = jest.fn(() => {
		throw new Error(STORE_REACHED);
	});
	return { metadata, createQueryBuilder: reach, findAndCount: reach, find: reach, reach };
}

type Store = ReturnType<typeof failingStore>;

type ServiceRead = (service: any, options: Record<string, unknown>) => Promise<unknown>;

interface ReadCase {
	readonly label: string;
	readonly service: { prototype: object };
	readonly metadata: MetadataFactory;
	readonly read: ServiceRead;
	readonly credential: Record<string, unknown>;
	readonly rate?: Record<string, unknown>;
	readonly ordinary: Record<string, unknown>;
}

const READS: ReadCase[] = [
	{
		label: 'TaskService.getAllTasksByEmployee',
		service: TaskService,
		metadata: TASK,
		read: (service, options) => service.getAllTasksByEmployee('employee-id', options),
		credential: { where: { createdByUser: { hash: 'x' } } },
		rate: { where: { members: { payRateValue: '40' } } },
		ordinary: { where: { organizationId: 'org', projectId: 'project' } }
	},
	{
		label: 'TaskService.findTeamTasks',
		service: TaskService,
		metadata: TASK,
		read: (service, options) => service.findTeamTasks(options),
		credential: { order: { members: { user: { refreshToken: 'ASC' } } } },
		rate: { where: { organizationId: 'org' }, order: { project: { billRateValue: 'DESC' } } },
		ordinary: { where: { organizationId: 'org', organizationTeamId: 'team' }, order: { createdAt: 'DESC' } }
	},
	{
		label: 'TaskService.findModuleTasks',
		service: TaskService,
		metadata: TASK,
		read: (service, options) => service.findModuleTasks(options),
		credential: { select: { createdByUser: { emailToken: true } } },
		rate: { where: { organizationId: 'org' }, order: { members: { payRateCurrency: 'ASC' } } },
		ordinary: { where: { organizationId: 'org' }, order: { title: 'ASC' } }
	},
	{
		label: 'DailyPlanService.getAllPlans',
		service: DailyPlanService,
		metadata: DAILY_PLAN,
		read: (service, options) => service.getAllPlans(options),
		credential: { where: { employee: { user: { code: '123456' } } } },
		rate: { where: { employee: { payRateValue: '40' } } },
		ordinary: { where: { organizationId: 'org', employeeId: 'employee' } }
	},
	{
		label: 'DailyPlanService.getTeamDailyPlans',
		service: DailyPlanService,
		metadata: DAILY_PLAN,
		read: (service, options) => service.getTeamDailyPlans(options),
		credential: { where: { createdByUser: { codeExpireAt: '2026-01-01' } } },
		rate: { where: { employee: { payRateCurrency: 'EUR' } } },
		ordinary: { where: { organizationId: 'org', organizationTeamId: 'team' } }
	},
	{
		label: 'OrganizationProjectModuleService.getEmployeeProjectModules',
		service: OrganizationProjectModuleService,
		metadata: PROJECT_MODULE,
		read: (service, options) => service.getEmployeeProjectModules(options),
		credential: { order: { createdByUser: { hash: 'ASC' } } },
		rate: { where: { organizationId: 'org' }, order: { project: { billRateValue: 'ASC' } } },
		ordinary: { where: { organizationId: 'org' }, order: { name: 'ASC' } }
	},
	{
		label: 'OrganizationProjectModuleService.findTeamProjectModules',
		service: OrganizationProjectModuleService,
		metadata: PROJECT_MODULE,
		read: (service, options) => service.findTeamProjectModules(options),
		credential: { order: { project: { createdByUser: { refreshToken: 'DESC' } } } },
		rate: { where: { project: { billRateValue: '90' } } },
		ordinary: { where: { organizationId: 'org', organizationTeamId: 'team' } }
	},
	{
		label: 'OrganizationTeamService.findAll',
		service: OrganizationTeamService,
		metadata: TEAM,
		read: (service, options) => service.findAll(options),
		credential: { where: { createdByUser: { hash: 'x' } } },
		rate: { order: { projects: { billRateValue: 'DESC' } } },
		ordinary: { where: { organizationId: 'org' }, order: { name: 'ASC' } }
	},
	{
		label: 'OrganizationTeamService.findMyTeams',
		service: OrganizationTeamService,
		metadata: TEAM,
		read: (service, options) => service.findMyTeams(options),
		credential: { order: { createdByUser: { refreshToken: 'ASC' } } },
		rate: { where: { projects: { billRateValue: '90' } } },
		ordinary: { where: { organizationId: 'org' } }
	},
	{
		label: 'EmailTemplateService.findAll',
		service: EmailTemplateService,
		metadata: EMAIL_TEMPLATE,
		read: (service, options) => service.findAll(options),
		credential: { order: { createdByUser: { emailToken: 'ASC' } } },
		ordinary: { where: { languageCode: 'en' }, order: { name: 'ASC' } }
	},
	{
		label: 'AccountingTemplateService.findAll',
		service: AccountingTemplateService,
		metadata: ACCOUNTING_TEMPLATE,
		read: (service, options) => service.findAll(options),
		credential: { order: { createdByUser: { hash: 'DESC' } } },
		ordinary: { where: { languageCode: 'en' }, order: { name: 'ASC' } }
	}
];

const RATE_READS = READS.filter((readCase: ReadCase) => readCase.rate !== undefined);

const CREDENTIAL_REFUSAL = /cannot be used to filter, sort or select/;
const RATE_REFUSAL = /requires ORG_EMPLOYEES_EDIT/;
const DEPTH_REFUSAL = /nested too deeply/;

/**
 * The team task and daily plan lists answer nothing, or refuse, before their query unless the caller may pick the
 * employee, so the reads expected to reach the store run as such a caller.
 */
const PICKS_THE_EMPLOYEE = PermissionsEnum.CHANGE_SELECTED_EMPLOYEE;

async function outcomeOf(read: () => Promise<unknown>): Promise<unknown> {
	try {
		return await read();
	} catch (error) {
		return error;
	}
}

function messageOf(outcome: unknown): string {
	const isError = outcome instanceof Error;
	if (!isError) {
		return '';
	}
	return outcome.message;
}

function nestedFilter(levels: number): Record<string, unknown> {
	let node: Record<string, unknown> = { name: 'x' };
	for (let level = 0; level < levels; level++) {
		node = { [`level${level}`]: node };
	}
	return node;
}

describe('Service-built list reads and caller-restricted columns', () => {
	let request: { query?: Record<string, unknown> } | null;
	let granted: PermissionsEnum[];

	function serviceFor(readCase: ReadCase): { service: unknown; store: Store } {
		const store = failingStore(readCase.metadata());
		const service = Object.create(readCase.service.prototype);
		service.typeOrmRepository = store;
		service.mikroOrmRepository = store;
		service.typeOrmDailyPlanRepository = store;
		return { service, store };
	}

	beforeEach(() => {
		request = null;
		granted = [];
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentRequest').mockImplementation(() => request);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(READS.map((readCase: ReadCase) => [readCase.label, readCase] as const))(
		'%s refuses a credential the caller names, whatever its permissions',
		async (_label, readCase) => {
			granted = Object.values(PermissionsEnum);
			request = { query: readCase.credential };
			const { service, store } = serviceFor(readCase);

			const read = readCase.read(service, readCase.credential);

			await expect(read).rejects.toThrow(BadRequestException);
			await expect(read).rejects.toThrow(CREDENTIAL_REFUSAL);
			expect(store.reach).not.toHaveBeenCalled();
		}
	);

	it.each(RATE_READS.map((readCase: ReadCase) => [readCase.label, readCase] as const))(
		'%s refuses a rate column to a caller without the right that sets rates',
		async (_label, readCase) => {
			granted = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			request = { query: readCase.rate };
			const { service, store } = serviceFor(readCase);

			const read = readCase.read(service, readCase.rate);

			await expect(read).rejects.toThrow(ForbiddenException);
			await expect(read).rejects.toThrow(RATE_REFUSAL);
			expect(store.reach).not.toHaveBeenCalled();
		}
	);

	it.each(RATE_READS.map((readCase: ReadCase) => [readCase.label, readCase] as const))(
		'%s lets a rate editor filter or sort on a rate column',
		async (_label, readCase) => {
			granted = [PermissionsEnum.ORG_EMPLOYEES_EDIT, PICKS_THE_EMPLOYEE];
			request = { query: readCase.rate };
			const { service, store } = serviceFor(readCase);

			const outcome = await outcomeOf(() => readCase.read(service, readCase.rate));

			expect(store.reach).toHaveBeenCalled();
			expect(messageOf(outcome)).toContain(STORE_REACHED);
		}
	);

	it.each(READS.map((readCase: ReadCase) => [readCase.label, readCase] as const))(
		'%s runs the filters and sorts the clients send',
		async (_label, readCase) => {
			granted = [PICKS_THE_EMPLOYEE];
			request = { query: readCase.ordinary };
			const { service, store } = serviceFor(readCase);

			const outcome = await outcomeOf(() => readCase.read(service, readCase.ordinary));

			expect(store.reach).toHaveBeenCalled();
			expect(messageOf(outcome)).toContain(STORE_REACHED);
		}
	);

	it("refuses a caller filter, sort or select on a share's token, which reads the share without signing in", () => {
		const share = entity('SharedEntity');
		const reads = [{ where: { token: 'guess%' } }, { order: { token: 'ASC' } }, { select: ['token'] }];

		for (const read of reads) {
			request = { query: read };
			expect(() => assertCallerColumnsAllowed(share, read)).toThrow(BadRequestException);
		}
	});

	it("CONTROL: a share's own lookup by token, named by the route path and not the query, still runs", () => {
		request = { query: {} };

		expect(() => assertCallerColumnsAllowed(entity('SharedEntity'), { where: { token: 'share-token' } })).not.toThrow();
	});

	it('refuses a caller filter nested past the depth the check follows', async () => {
		const deep = { where: nestedFilter(20) };
		request = { query: deep };
		const { service, store } = serviceFor(READS[0]);

		const read = READS[0].read(service, deep);

		await expect(read).rejects.toThrow(BadRequestException);
		await expect(read).rejects.toThrow(DEPTH_REFUSAL);
		expect(store.reach).not.toHaveBeenCalled();
	});
});
