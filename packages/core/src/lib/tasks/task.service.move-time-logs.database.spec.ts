import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PermissionsEnum, TimesheetStatus } from '@gauzy/contracts';
import { coreEntities } from '../core/entities';
import { RequestContext } from '../core/context';
import { TaskService } from './task.service';

/**
 * The write that moves a task's time logs, run on a real SQLite database with the tables TypeORM creates. The other
 * suite answers from stand-ins and only sees that the write carries its conditions; this one checks what the
 * conditions do: a timesheet approved after the logs were read keeps its log, a move overtaken by a later move of the
 * same task writes nothing, and only the task's own logs are written.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '81000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '81000000-0000-4000-8000-0000000000a1';
const USER = '81000000-0000-4000-8000-0000000000b1';
const EMPLOYEE = '81000000-0000-4000-8000-0000000000e1';
const PROJECT_OLD = '81000000-0000-4000-8000-0000000000c1';
const PROJECT_NEW = '81000000-0000-4000-8000-0000000000c2';
const PROJECT_LATER = '81000000-0000-4000-8000-0000000000c3';
const TASK = '81000000-0000-4000-8000-000000000001';
const OTHER_TASK = '81000000-0000-4000-8000-000000000002';
const OPEN_SHEET = '81000000-0000-4000-8000-0000000000d1';
const SHEET_APPROVED_DURING_MOVE = '81000000-0000-4000-8000-0000000000d2';
const LOG = {
	open: '81000000-0000-4000-8000-0000000000f1',
	approvedDuringMove: '81000000-0000-4000-8000-0000000000f2',
	otherTask: '81000000-0000-4000-8000-0000000000f3'
};

describe('TaskService moving the time logs, on a real database', () => {
	const file = path.join(os.tmpdir(), `gauzy-task-move-time-logs-${process.pid}-${Date.now()}.sqlite3`);
	let dataSource: DataSource;
	let service: TaskService;

	/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
	const insert = async (table: string, row: Record<string, unknown>) => {
		const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
		const values: Record<string, unknown> = { ...row };
		for (const column of columns) {
			const isFilled = column.name in values;
			const needsNoValue = !column.notnull || column.dflt_value !== null || column.pk;
			if (isFilled || needsNoValue) {
				continue;
			}
			const type = String(column.type).toLowerCase();
			const isNumeric = /int|bool|numeric|decimal|real|float/.test(type);
			const isDate = /date|time/.test(type);
			let placeholder: unknown = 'x';
			if (isNumeric) {
				placeholder = 0;
			} else if (isDate) {
				placeholder = '2026-01-01 00:00:00';
			}
			values[column.name] = placeholder;
		}
		const keys = Object.keys(values);
		const names = keys.map((key) => `"${key}"`).join(', ');
		const marks = keys.map(() => '?').join(', ');
		await dataSource.query(
			`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
			keys.map((key) => values[key])
		);
	};

	const projectOf = async (timeLogId: string) => {
		const [row] = await dataSource.query(`SELECT "projectId" FROM "time_log" WHERE "id" = ?`, [timeLogId]);
		return row?.projectId ?? null;
	};

	const move = (projectId: string) =>
		(service as any).moveTimeLogsToProject(TASK, projectId, ORGANIZATION, TENANT) as Promise<void>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: file,
			entities: coreEntities,
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		// The custom-fields placeholder column the migrations add, which synchronize leaves out
		for (const table of ['employee', 'organization_project', 'organization_contact', 'organization']) {
			const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
			const hasColumn = columns.some((column) => column.name === 'fix_relational_custom_fields');
			if (!hasColumn) {
				await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
			}
		}
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
		fs.rmSync(file, { force: true });
	});

	beforeEach(async () => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		for (const table of [
			'time_log',
			'timesheet',
			'task',
			'organization_project',
			'employee',
			'user',
			'organization',
			'tenant'
		]) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insert('tenant', { id: TENANT, name: 'Tenant' });
		await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', allowModifyTime: 1 });
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { ...scope, id: EMPLOYEE, userId: USER });
		for (const [id, name, billable] of [
			[PROJECT_OLD, 'Old', 0],
			[PROJECT_NEW, 'New', 1],
			[PROJECT_LATER, 'Later', 0]
		]) {
			await insert('organization_project', { ...scope, id, name, billable });
		}
		// The task as the update saved it: already in the project its logs move to
		await insert('task', { ...scope, id: TASK, title: 'Task', projectId: PROJECT_NEW, number: 1 });
		await insert('task', { ...scope, id: OTHER_TASK, title: 'Other', projectId: PROJECT_OLD, number: 2 });
		for (const id of [OPEN_SHEET, SHEET_APPROVED_DURING_MOVE]) {
			await insert('timesheet', {
				...scope,
				id,
				employeeId: EMPLOYEE,
				status: TimesheetStatus.PENDING,
				isBilled: 0
			});
		}
		const logs: Array<[string, string, string]> = [
			[LOG.open, TASK, OPEN_SHEET],
			[LOG.approvedDuringMove, TASK, SHEET_APPROVED_DURING_MOVE],
			[LOG.otherTask, OTHER_TASK, OPEN_SHEET]
		];
		for (const [id, taskId, timesheetId] of logs) {
			await insert('time_log', {
				...scope,
				id,
				employeeId: EMPLOYEE,
				taskId,
				timesheetId,
				projectId: PROJECT_OLD,
				isBillable: 0,
				startedAt: '2026-01-10 09:00:00',
				stoppedAt: '2026-01-10 10:00:00'
			});
		}

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.ALLOW_MODIFY_TIME
		);
		service = Object.create(TaskService.prototype);
		Object.assign(service, { _managedEmployeeService: { canManageEmployee: async () => true } });
		Object.defineProperty(service, 'typeOrmRepository', {
			value: { manager: dataSource.manager },
			configurable: true
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it("moves the task's open logs, with the new project's billable setting", async () => {
		await move(PROJECT_NEW);

		expect(await projectOf(LOG.open)).toBe(PROJECT_NEW);
		const [row] = await dataSource.query(`SELECT "isBillable" FROM "time_log" WHERE "id" = ?`, [LOG.open]);
		expect(Boolean(row.isBillable)).toBe(true);
	});

	it('leaves a log whose timesheet is approved after the logs were read', async () => {
		const find = dataSource.manager.find.bind(dataSource.manager);
		jest.spyOn(dataSource.manager, 'find').mockImplementation(async (...args: any[]) => {
			const read = await (find as any)(...args);
			await dataSource.query(`UPDATE "timesheet" SET "status" = ? WHERE "id" = ?`, [
				TimesheetStatus.APPROVED,
				SHEET_APPROVED_DURING_MOVE
			]);
			return read;
		});

		await move(PROJECT_NEW);

		expect(await projectOf(LOG.open)).toBe(PROJECT_NEW);
		expect(await projectOf(LOG.approvedDuringMove)).toBe(PROJECT_OLD);
	});

	it('writes nothing for a move a later move of the same task has overtaken', async () => {
		await dataSource.query(`UPDATE "task" SET "projectId" = ? WHERE "id" = ?`, [PROJECT_LATER, TASK]);

		await move(PROJECT_NEW);

		expect(await projectOf(LOG.open)).toBe(PROJECT_OLD);
		expect(await projectOf(LOG.approvedDuringMove)).toBe(PROJECT_OLD);
	});

	it("writes only the task's own logs, even when the read names another task's log", async () => {
		// The other task in the same project, so that only the task predicate keeps its log out
		await dataSource.query(`UPDATE "task" SET "projectId" = ? WHERE "id" = ?`, [PROJECT_NEW, OTHER_TASK]);
		const find = dataSource.manager.find.bind(dataSource.manager);
		jest.spyOn(dataSource.manager, 'find').mockImplementation(async (...args: any[]) => {
			const read = await (find as any)(...args);
			return [...read, { id: LOG.otherTask, employeeId: EMPLOYEE, projectId: PROJECT_OLD, timesheet: null }];
		});

		await move(PROJECT_NEW);

		expect(await projectOf(LOG.open)).toBe(PROJECT_NEW);
		expect(await projectOf(LOG.otherTask)).toBe(PROJECT_OLD);
	});
});
