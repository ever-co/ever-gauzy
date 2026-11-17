import { readFileSync } from 'fs';
import { join } from 'path';
import { buildSchema, graphql } from 'graphql';
import { withHiddenProjectsWithheld, withProjectIdKept } from '../../organization-project/hidden-projects';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): the statistics over GraphQL answer a project the caller may not see as REST does,
 * its id and `projectHidden`, with its tracked time and no name, and the schema the API serves accepts that answer.
 */
const schema = buildSchema(readFileSync(join(__dirname, '../../graphql/schema/schema.graphql'), 'utf8'));

const CONFIDENTIAL = 'project-client-x-redesign';
const HIDDEN = new Map([[CONFIDENTIAL, 'Client X redesign']]);

describe('the statistics over GraphQL and hidden projects', () => {
	it('answers a hidden project of the projects statistic as its id and the marker, keeping its time', async () => {
		const rows = [
			{ id: CONFIDENTIAL, name: 'Client X redesign', duration: 43200, durationPercentage: 92 },
			{ id: 'project-website', name: 'Website', duration: 3600, durationPercentage: 8 }
		];
		const answer = withHiddenProjectsWithheld(rows, HIDDEN, {
			rootRowsAreProjects: { keep: ['duration', 'durationPercentage'] }
		});

		const result = await graphql({
			schema,
			source: `{ timeTrackingProjects(organizationId: "org-1") { id name projectHidden duration durationPercentage } }`,
			rootValue: { timeTrackingProjects: () => answer }
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			timeTrackingProjects: [
				{ id: CONFIDENTIAL, name: null, projectHidden: true, duration: 43200, durationPercentage: 92 },
				{ id: 'project-website', name: 'Website', projectHidden: null, duration: 3600, durationPercentage: 8 }
			]
		});
	});

	it('answers the hidden project of a manual time as its id and the marker, with no name or image', async () => {
		const rows = [
			{
				id: 'log-1',
				employeeId: 'employee-marie',
				duration: 3600,
				project: withProjectIdKept({ name: 'Client X redesign', imageUrl: 'https://img/x.png' }, CONFIDENTIAL)
			}
		];
		const answer = withHiddenProjectsWithheld(rows, HIDDEN);

		const result = await graphql({
			schema,
			source: `{ timeTrackingManualTimes(organizationId: "org-1") { id project { id name imageUrl projectHidden } } }`,
			rootValue: { timeTrackingManualTimes: () => answer }
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			timeTrackingManualTimes: [
				{ id: 'log-1', project: { id: CONFIDENTIAL, name: null, imageUrl: null, projectHidden: true } }
			]
		});
	});
});
