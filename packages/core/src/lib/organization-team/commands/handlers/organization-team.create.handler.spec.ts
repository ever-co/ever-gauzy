import '../../../core/entities/internal';

import { CommandBus } from '@nestjs/cqrs';
import { OrganizationTeamTagBulkCreateCommand } from '../../../tags/commands/organization-team-tag-bulk-create.command';
import { OrganizationTeamIssueTypeBulkCreateCommand } from '../../../tasks/issue-type/commands';
import { OrganizationTeamTaskPriorityBulkCreateCommand } from '../../../tasks/priorities/commands';
import { OrganizationTeamTaskSizeBulkCreateCommand } from '../../../tasks/sizes/commands';
import { OrganizationTeamTaskStatusBulkCreateCommand } from '../../../tasks/statuses/commands';
import { OrganizationTeamService } from '../../organization-team.service';
import { OrganizationTeamCreateCommand } from '../organization-team.create.command';
import { OrganizationTeamCreateHandler } from './organization-team.create.handler';

/**
 * A new team gets its statuses, priorities, sizes and issue types as before. The starter labels
 * (ever-co/ever-teams#5016) come only when the request asks for them with `withStarterTags: true`, so no other way of
 * creating a team (the Gauzy UI, GraphQL, Zitadel provisioning, an integration) files tags it did not file before.
 */
describe('OrganizationTeamCreateHandler starter labels', () => {
	const team = { id: 'team-1', organizationId: 'organization-1', name: 'Core' };

	function setup() {
		const execute = jest.fn().mockResolvedValue(undefined);
		const create = jest.fn().mockResolvedValue(team);
		const handler = new OrganizationTeamCreateHandler(
			{ execute } as unknown as CommandBus,
			{ create } as unknown as OrganizationTeamService
		);
		// The background commands run without being awaited: let them be dispatched
		const sent = async () => {
			await new Promise((resolve) => setImmediate(resolve));
			return execute.mock.calls.map(([command]) => command.constructor);
		};
		return { handler, create, sent };
	}

	const defaults = [
		OrganizationTeamTaskStatusBulkCreateCommand,
		OrganizationTeamTaskPriorityBulkCreateCommand,
		OrganizationTeamTaskSizeBulkCreateCommand,
		OrganizationTeamIssueTypeBulkCreateCommand
	];

	it('files no tags when the request does not ask for them', async () => {
		const { handler, sent } = setup();

		await expect(
			handler.execute(new OrganizationTeamCreateCommand({ name: 'Core', organizationId: 'organization-1' }))
		).resolves.toBe(team);

		expect(await sent()).toEqual(defaults);
	});

	it('files no tags when the request says false', async () => {
		const { handler, sent } = setup();

		await handler.execute(
			new OrganizationTeamCreateCommand({ name: 'Core', organizationId: 'organization-1', withStarterTags: false })
		);

		expect(await sent()).toEqual(defaults);
	});

	it('gives the team its starter labels when the request asks for them', async () => {
		const { handler, sent } = setup();

		await handler.execute(
			new OrganizationTeamCreateCommand({ name: 'Core', organizationId: 'organization-1', withStarterTags: true })
		);

		expect(await sent()).toEqual([...defaults, OrganizationTeamTagBulkCreateCommand]);
	});
});
