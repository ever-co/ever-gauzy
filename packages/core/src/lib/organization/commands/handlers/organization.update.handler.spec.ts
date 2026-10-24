import '../../../core/entities/internal';

import { IOrganizationUpdateInput } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationUpdateCommand } from '../organization.update.command';
import { OrganizationUpdateHandler } from './organization.update.handler';

/**
 * The update coerced every `show_*` flag whether or not the input carried it: `!!undefined` turned the unsent
 * "off by default" flags off and `undefined !== false` turned the unsent "on by default" flags on, so a partial
 * update (only the name, from the GraphQL mutation or a PUT with a subset of fields) reset the public profile
 * settings. Only the flags the input carries must be written.
 */
describe('OrganizationUpdateHandler — public profile flags', () => {
	const fixture = createTenantFixture();
	const stored = {
		id: 'org-1',
		name: 'Org',
		tenantId: fixture.tenantId,
		show_profits: true,
		show_clients: false,
		contact: null
	};

	let restore: () => void;
	let organizationService: { findOneByIdString: jest.Mock; create: jest.Mock; update: jest.Mock };
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		organizationService = {
			findOneByIdString: jest.fn().mockResolvedValue(stored),
			create: jest.fn(async (entity) => entity),
			update: jest.fn()
		};
		self = {
			organizationService,
			activityLogService: {},
			moduleRef: { get: jest.fn() },
			logger: { error: jest.fn() }
		};
		self.update = (OrganizationUpdateHandler.prototype as any).update.bind(self);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const update = (input: Partial<IOrganizationUpdateInput>) =>
		OrganizationUpdateHandler.prototype.execute.call(
			self,
			new OrganizationUpdateCommand('org-1', input as IOrganizationUpdateInput)
		);

	const saved = () => organizationService.create.mock.calls[0][0];

	it('does not write the flags a partial update did not send', async () => {
		await update({ name: 'Renamed' });

		const written = saved();
		expect(written).toMatchObject({ id: 'org-1', name: 'Renamed' });
		for (const flag of [
			'show_profits',
			'show_bonuses_paid',
			'show_income',
			'show_total_hours',
			'show_projects_count',
			'show_minimum_project_size',
			'show_clients_count',
			'show_clients',
			'show_employees_count'
		]) {
			expect(written).not.toHaveProperty(flag);
		}
	});

	it('still writes (and coerces) the flags the input carries', async () => {
		await update({ show_profits: false, show_clients: true, show_income: null, show_projects_count: null });

		expect(saved()).toMatchObject({
			show_profits: false,
			show_clients: true,
			show_income: false,
			show_projects_count: true
		});
	});
});
