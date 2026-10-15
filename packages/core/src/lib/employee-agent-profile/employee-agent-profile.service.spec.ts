import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { Employee } from '../core/entities/internal';
import { EmployeeAgentProfile } from './employee-agent-profile.entity';
import { pickAgentProfileInput, writeAgentProfile } from './employee-agent-profile.service';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const AGENT = { id: 'e0000000-0000-4000-8000-000000000001', tenantId: TENANT, organizationId: ORGANIZATION };
const LEAD = { id: 'e0000000-0000-4000-8000-000000000002', tenantId: TENANT, organizationId: ORGANIZATION };

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
