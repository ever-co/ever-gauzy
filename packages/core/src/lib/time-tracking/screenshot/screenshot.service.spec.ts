/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see the note in
 * `time-log.service.spec.ts`: entering the entity graph from the service end leaves
 * `IsEmployeeBelongsToOrganization` half-initialized and the suite fails to load.
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { TypeOrmScreenshotRepository } from './repository/type-orm-screenshot.repository';
import { MikroOrmScreenshotRepository } from './repository/mikro-orm-screenshot.repository';
import { ScreenshotService } from './screenshot.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const OWN_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const SCREENSHOT_ID = '9c8b7a65-4d3e-4f21-8a0b-1c2d3e4f5a6b';

/**
 * `deleteScreenshot` restricts a caller without CHANGE_SELECTED_EMPLOYEE to their own screenshots by
 * joining the time slot. The join has to be an INNER join: a LEFT join keeps the row when its ON clause
 * does not match, so the restriction removed nothing and any member of the organization could delete a
 * colleague's screenshot — with `forceDelete`, the stored image too.
 */
describe('ScreenshotService.deleteScreenshot', () => {
	let service: ScreenshotService;
	let joins: Array<{ type: string; alias: string; condition: string; parameters: Record<string, unknown> }>;
	let deleted: string[];
	let softRemoved: string[];

	/** Records which join the service asks for; every method returns the builder, as TypeORM does. */
	class RecordingScreenshotQueryBuilder {
		readonly alias = 'screenshot';

		where(): this {
			return this;
		}

		andWhere(): this {
			return this;
		}

		innerJoin(_relation: string, alias: string, condition: string, parameters: Record<string, unknown>): this {
			joins.push({ type: 'innerJoin', alias, condition, parameters });
			return this;
		}

		leftJoin(_relation: string, alias: string, condition: string, parameters: Record<string, unknown>): this {
			joins.push({ type: 'leftJoin', alias, condition, parameters });
			return this;
		}

		async getOneOrFail(): Promise<{ id: string }> {
			return { id: SCREENSHOT_ID };
		}
	}

	const queryBuilder = new RecordingScreenshotQueryBuilder();

	const actAs = (caller: { employeeId: string | null; canChangeSelectedEmployee: boolean }) => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(caller.employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE && caller.canChangeSelectedEmployee
		);
	};

	beforeEach(async () => {
		joins = [];
		deleted = [];
		softRemoved = [];

		const module: TestingModule = await Test.createTestingModule({ providers: [ScreenshotService] })
			.useMocker((token) => {
				if (token === TypeOrmScreenshotRepository) {
					return { metadata: { tableName: 'screenshot' }, createQueryBuilder: () => queryBuilder };
				}
				return {};
			})
			.compile();

		service = module.get<ScreenshotService>(ScreenshotService);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		jest.spyOn(service, 'delete').mockImplementation(async (id: any) => {
			deleted.push(id);
			return {} as any;
		});
		jest.spyOn(service, 'softRemove').mockImplementation(async (id: any) => {
			softRemoved.push(id);
			return {} as any;
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('filters by the owning time slot with an INNER join, so a foreign screenshot cannot match', async () => {
		actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: false });

		await service.deleteScreenshot(SCREENSHOT_ID, { organizationId: ORGANIZATION_ID } as any);

		expect(joins).toHaveLength(1);
		expect(joins[0].type).toBe('innerJoin');
		expect(joins[0].condition).toContain('time_slot.employeeId = :employeeId');
		expect(joins[0].parameters).toEqual(
			expect.objectContaining({
				employeeId: OWN_EMPLOYEE_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID
			})
		);
		expect(softRemoved).toEqual([SCREENSHOT_ID]);
	});

	it('refuses a caller with no employee identity instead of dropping the ownership filter', async () => {
		actAs({ employeeId: null, canChangeSelectedEmployee: false });

		await expect(
			service.deleteScreenshot(SCREENSHOT_ID, { organizationId: ORGANIZATION_ID } as any)
		).rejects.toThrow(ForbiddenException);

		expect(joins).toEqual([]);
		expect(deleted).toEqual([]);
		expect(softRemoved).toEqual([]);
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder delete without the ownership join', async () => {
		actAs({ employeeId: OWN_EMPLOYEE_ID, canChangeSelectedEmployee: true });

		await service.deleteScreenshot(SCREENSHOT_ID, {
			organizationId: ORGANIZATION_ID,
			forceDelete: true
		} as any);

		expect(joins).toEqual([]);
		expect(deleted).toEqual([SCREENSHOT_ID]);
	});
});
