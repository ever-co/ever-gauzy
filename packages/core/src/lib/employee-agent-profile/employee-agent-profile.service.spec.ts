import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Employee } from '../core/entities/internal';
import { EmployeeAgentProfile } from './employee-agent-profile.entity';
import { pickAgentProfileInput, writeAgentProfile } from './employee-agent-profile.service';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const AGENT = {
	id: 'e0000000-0000-4000-8000-000000000001',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	kind: 'agent'
};
const LEAD = {
	id: 'e0000000-0000-4000-8000-000000000002',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	kind: 'human'
};

function fakeManager(rows: { employees?: any[]; profiles?: any[] } = {}) {
	const employees = rows.employees ?? [AGENT, LEAD];
	const profiles = rows.profiles ?? [];
	const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
	return {
		profiles,
		findOne: jest.fn(async (entity: unknown, { where }: any) => {
			const table = entity === Employee ? employees : entity === EmployeeAgentProfile ? profiles : [];
			return table.find((row) => matches(row, where)) ?? null;
		}),
		create: jest.fn((_entity: unknown, values: any) => ({ ...values })),
		merge: jest.fn((_entity: unknown, target: any, values: any) => Object.assign(target, values)),
		save: jest.fn(async (_entity: unknown, value: any) => {
			const stored = { id: value.id ?? 'p0000000-0000-4000-8000-000000000001', ...value };
			const index = profiles.findIndex((row) => row.id === stored.id);
			if (index >= 0) profiles[index] = stored;
			else profiles.push(stored);
			return stored;
		})
	};
}

describe('pickAgentProfileInput', () => {
	it('keeps only the members an integration may state', () => {
		const picked = pickAgentProfileInput({
			source: 'ever_works',
			title: 'Reviewer',
			...({ id: 'x', tenantId: 'x', organizationId: 'x', employeeId: 'x', employee: {} } as object)
		});
		expect(picked).toEqual({ source: 'ever_works', title: 'Reviewer' });
	});
});

describe('writeAgentProfile', () => {
	it('creates a profile scoped by the employee row', async () => {
		const em = fakeManager();
		const profile = await writeAgentProfile(em as any, AGENT, {
			source: 'ever_works',
			externalId: 'ew-1',
			reportsToEmployeeId: LEAD.id,
			status: 'active'
		});
		expect(profile).toMatchObject({
			source: 'ever_works',
			externalId: 'ew-1',
			reportsToEmployeeId: LEAD.id,
			status: 'active',
			employeeId: AGENT.id,
			tenantId: TENANT,
			organizationId: ORGANIZATION
		});
	});

	it('updates the existing profile instead of adding a second one', async () => {
		const em = fakeManager({
			profiles: [{ id: 'p-1', employeeId: AGENT.id, tenantId: TENANT, source: 'ever_works', status: 'active' }]
		});
		await writeAgentProfile(em as any, AGENT, { status: 'paused', lastRunAt: new Date('2026-10-15T00:00:00Z') });
		expect(em.profiles).toHaveLength(1);
		expect(em.profiles[0]).toMatchObject({ id: 'p-1', source: 'ever_works', status: 'paused' });
	});

	it('writes for the employee row as stored: its organization, never the caller-stated one', async () => {
		const profile = await writeAgentProfile(
			fakeManager() as any,
			{ ...AGENT, organizationId: 'other-org' },
			{
				source: 'ever_works'
			}
		);
		expect(profile).toMatchObject({ employeeId: AGENT.id, organizationId: ORGANIZATION });
	});

	it('refuses an employee that does not exist in the tenant, and a person', async () => {
		await expect(
			writeAgentProfile(fakeManager() as any, { ...AGENT, tenantId: 'other-tenant' }, { source: 'ever_works' })
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(writeAgentProfile(fakeManager() as any, LEAD, { source: 'ever_works' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('needs a source for a new profile', async () => {
		await expect(writeAgentProfile(fakeManager() as any, AGENT, { title: 'x' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('refuses a manager outside the organization, and the agent itself', async () => {
		await expect(
			writeAgentProfile(fakeManager() as any, AGENT, {
				source: 'ever_works',
				reportsToEmployeeId: 'e0000000-0000-4000-8000-00000000ffff'
			})
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			writeAgentProfile(fakeManager() as any, AGENT, { source: 'ever_works', reportsToEmployeeId: AGENT.id })
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

/**
 * Two first writes for one employee, as two transactions: each reads "no profile yet" unless the employee
 * row is locked for the transaction. Postgres and MySQL lock it (`findOneForUpdate`), so the second waits,
 * then updates the profile the first created instead of failing on the one-profile-per-employee constraint.
 */
describe('writeAgentProfile — overlapping first writes', () => {
	function sharedDatabase(type: string) {
		const profiles: any[] = [];
		const employees = [AGENT];
		const locks = new Map<string, Promise<void>>();
		const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
		const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
		let sequence = 0;
		const transaction = async <T>(work: (em: any) => Promise<T>): Promise<T> => {
			const held: Array<() => void> = [];
			const em = {
				connection: { options: { type } },
				findOne: async (entity: unknown, { where, lock }: any) => {
					if (lock?.mode === 'pessimistic_write') {
						const key = String(where.id);
						while (locks.has(key)) await locks.get(key);
						let release: () => void;
						locks.set(key, new Promise<void>((resolve) => (release = resolve)));
						held.push(() => {
							locks.delete(key);
							release();
						});
					}
					await tick();
					const table = entity === Employee ? employees : entity === EmployeeAgentProfile ? profiles : [];
					return table.find((row) => matches(row, where)) ?? null;
				},
				create: (_entity: unknown, values: any) => ({ ...values }),
				merge: (_entity: unknown, target: any, values: any) => Object.assign(target, values),
				save: async (_entity: unknown, value: any) => {
					await tick();
					if (!value.id && profiles.some((row) => row.employeeId === value.employeeId)) {
						throw new Error('UNIQUE constraint failed: employee_agent_profile.employeeId');
					}
					const stored = Object.assign(value, { id: value.id ?? `p-${++sequence}` });
					if (!profiles.includes(stored)) profiles.push(stored);
					return stored;
				}
			};
			try {
				return await work(em);
			} finally {
				held.forEach((release) => release());
			}
		};
		return { profiles, transaction };
	}

	it('writes once and then updates when the employee row is locked', async () => {
		const db = sharedDatabase('postgres');
		await Promise.all([
			db.transaction((em) => writeAgentProfile(em, AGENT, { source: 'ever_works', status: 'active' })),
			db.transaction((em) => writeAgentProfile(em, AGENT, { source: 'ever_works', status: 'paused' }))
		]);
		expect(db.profiles).toHaveLength(1);
		expect(db.profiles[0].status).toBe('paused');
	});

	it('control: without the lock the second first write fails on the unique constraint', async () => {
		const db = sharedDatabase('better-sqlite3');
		const results = await Promise.allSettled([
			db.transaction((em) => writeAgentProfile(em, AGENT, { source: 'ever_works', status: 'active' })),
			db.transaction((em) => writeAgentProfile(em, AGENT, { source: 'ever_works', status: 'paused' }))
		]);
		expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
	});
});
