import { ID, ITaskView, TaskViewVisibilityEnum, VisibilityLevelEnum } from '@gauzy/contracts';
import {
	createInput,
	DEFAULT_DEFINITION,
	definitionOf,
	displayOptionsOf,
	filterOptionsOf,
	groupViews,
	isBuiltInViewKey,
	isPropertyShown,
	isSameDefinition,
	layoutOf,
	normalizedViewName,
	orderingOf,
	placementInput,
	saveInput,
	scopeOfView,
	versionOf
} from './view-definition';

const tree = {
	op: 'and' as const,
	conditions: [
		{ field: 'status' as const, operator: 'in' as const, values: ['11111111-1111-4111-8111-111111111111' as ID] }
	]
};

describe('view definition', () => {
	it('reads a view with every default in place', () => {
		expect(definitionOf(null)).toEqual(DEFAULT_DEFINITION);
		expect(
			definitionOf({
				filterOptions: { filter: tree, groupBy: 'label', orderBy: { field: 'title' } },
				properties: { size: true, bogus: 'x' as never }
			})
		).toEqual({
			filter: tree,
			groupBy: 'label',
			orderBy: { field: 'title', direction: 'asc' },
			properties: { size: true },
			layout: 'list'
		});
	});

	it('reads the JSON text SQLite may answer, and falls back on what it does not know', () => {
		expect(
			definitionOf({ filterOptions: JSON.stringify({ filter: tree, groupBy: 'colour' }) as never }).filter
		).toEqual(tree);
		expect(definitionOf({ filterOptions: '{not json' as never }).groupBy).toBe('none');
		expect(orderingOf({ field: 'priority' })).toEqual({ field: 'createdAt', direction: 'desc' });
		expect(orderingOf({ field: 'dueDate', direction: 'desc' })).toEqual({ field: 'dueDate', direction: 'desc' });
	});

	it('writes the definition over what the view held, keeping the keys another client stores there', () => {
		const definition = { ...DEFAULT_DEFINITION, filter: tree, groupBy: 'status' as const };
		expect(filterOptionsOf(definition, { status: ['open'], filter: null })).toEqual({
			status: ['open'],
			filter: tree,
			groupBy: 'status',
			orderBy: DEFAULT_DEFINITION.orderBy
		});
	});

	it('compares what two definitions show, properties by their effect', () => {
		const base = definitionOf({ filterOptions: { filter: tree } });
		expect(isSameDefinition(base, { ...base, properties: { status: true } })).toBe(true);
		expect(isSameDefinition(base, { ...base, properties: { status: false } })).toBe(false);
		expect(isSameDefinition(base, { ...base, groupBy: 'priority' })).toBe(false);
		expect(isSameDefinition(base, { ...base, filter: null })).toBe(false);
		expect(isPropertyShown(base, 'size')).toBe(false);
		expect(isPropertyShown({ ...base, properties: { size: true } }, 'size')).toBe(true);
	});

	it('lists the saved views by where they belong, each by name', () => {
		const views = [
			{ id: '1', name: 'zeta', visibility: TaskViewVisibilityEnum.PERSONAL, organizationTeamId: 't' },
			{ id: '2', name: 'Alpha', organizationTeamId: 't' },
			{ id: '3', name: 'beta', projectId: 'p' },
			{ id: '4', name: 'Org', visibility: TaskViewVisibilityEnum.SHARED },
			{ id: '5', name: 'alpha', visibility: TaskViewVisibilityEnum.PERSONAL }
		] as ITaskView[];
		const grouped = groupViews(views);
		expect(grouped.personal.map((view) => view.id)).toEqual(['5', '1']);
		expect(grouped.team.map((view) => view.id)).toEqual(['2']);
		expect(grouped.project.map((view) => view.id)).toEqual(['3']);
		expect(grouped.organization.map((view) => view.id)).toEqual(['4']);
		expect(scopeOfView(views[0])).toBe('personal');
	});

	it('knows the built-in views and normalizes a name', () => {
		expect(isBuiltInViewKey('this-week')).toBe(true);
		expect(isBuiltInViewKey('someone-else')).toBe(false);
		expect(normalizedViewName('  Backend   bugs  ', 80)).toBe('Backend bugs');
		expect(normalizedViewName('x'.repeat(100), 80)).toHaveLength(80);
	});

	it('creates a view for who it is for, copying the columns of the view it is saved from', () => {
		const from = {
			filterOptions: { status: ['open'] },
			properties: { size: true },
			displayOptions: { layout: 'board' }
		} as Partial<ITaskView>;
		const input = createInput(
			{ ...DEFAULT_DEFINITION, filter: tree },
			{ name: 'Team bugs', visibility: TaskViewVisibilityEnum.SHARED, organizationTeamId: 't' as ID },
			{ organizationId: 'org' as ID, tenantId: 'ten' as ID },
			from
		);
		expect(input).toMatchObject({
			organizationId: 'org',
			tenantId: 'ten',
			name: 'Team bugs',
			visibility: 'shared',
			visibilityLevel: VisibilityLevelEnum.TEAM_AND_PROJECT,
			organizationTeamId: 't',
			projectId: null,
			filterOptions: { status: ['open'], filter: tree, groupBy: 'none' },
			properties: { size: true },
			displayOptions: { layout: 'board' }
		});
		expect(
			createInput(
				DEFAULT_DEFINITION,
				{ name: 'Mine', visibility: TaskViewVisibilityEnum.PERSONAL },
				{ organizationId: 'org' as ID }
			).visibilityLevel
		).toBe(VisibilityLevelEnum.ORGANIZATION);
	});

	it('moves the visibility level with where the view is listed', () => {
		const view = {
			id: 'v' as ID,
			name: 'A',
			version: 2,
			organizationTeamId: null,
			projectId: 'p' as ID
		} as unknown as ITaskView;
		const scope = { organizationId: 'org' as ID };
		expect(placementInput(view, { organizationTeamId: 't' as ID }, scope).visibilityLevel).toBe(
			VisibilityLevelEnum.TEAM_AND_PROJECT
		);
		expect(placementInput(view, { projectId: null }, scope).visibilityLevel).toBe(VisibilityLevelEnum.ORGANIZATION);
		expect(placementInput(view, { name: 'B' }, scope).visibilityLevel).toBeUndefined();
	});

	it('saves and renames stating the version read', () => {
		const view = { id: 'v' as ID, name: 'A', version: 3, filterOptions: {}, properties: {} } as ITaskView;
		expect(saveInput(view, DEFAULT_DEFINITION, { organizationId: 'org' as ID }).expectedVersion).toBe(3);
		expect(placementInput(view, { name: 'B' }, { organizationId: 'org' as ID })).toEqual({
			organizationId: 'org',
			name: 'B',
			expectedVersion: 3
		});
		expect(versionOf({ version: 0 })).toBe(1);
		expect(versionOf(null)).toBe(1);
	});
});

describe('the layout of a view', () => {
	const scope = { organizationId: 'org' as ID };
	const viewWith = (displayOptions: unknown) =>
		({ id: 'v' as ID, name: 'A', version: 3, displayOptions }) as unknown as ITaskView;

	it('reads a timeline, and anything else (none, a list, an Ever Teams board, unreadable) as the list', () => {
		expect(layoutOf({ layout: 'timeline' })).toBe('timeline');
		expect(layoutOf(JSON.stringify({ layout: 'timeline' }))).toBe('timeline');
		for (const other of [null, undefined, {}, { layout: 'list' }, { layout: 'board' }, '{not json']) {
			expect(layoutOf(other)).toBe('list');
		}
		expect(definitionOf(viewWith({ layout: 'timeline' })).layout).toBe('timeline');
		expect(definitionOf(null).layout).toBe('list');
	});

	it('writes a timeline over the keys kept there; the list clears a timeline and leaves a board', () => {
		const timeline = { ...DEFAULT_DEFINITION, layout: 'timeline' as const };
		expect(displayOptionsOf(timeline, { zoom: 'month', layout: 'board' })).toEqual({
			zoom: 'month',
			layout: 'timeline'
		});
		expect(displayOptionsOf(DEFAULT_DEFINITION, { zoom: 'month', layout: 'timeline' })).toEqual({ zoom: 'month' });
		expect(displayOptionsOf(DEFAULT_DEFINITION, { layout: 'board' })).toEqual({ layout: 'board' });
	});

	it('tells a changed layout apart, and saves it only when it changes', () => {
		const timeline = { ...DEFAULT_DEFINITION, layout: 'timeline' as const };
		expect(isSameDefinition(DEFAULT_DEFINITION, timeline)).toBe(false);
		expect(saveInput(viewWith({ layout: 'board', zoom: 'month' }), timeline, scope).displayOptions).toEqual({
			layout: 'timeline',
			zoom: 'month'
		});
		expect(saveInput(viewWith({ layout: 'timeline' }), DEFAULT_DEFINITION, scope).displayOptions).toEqual({});
		// A save that leaves the layout as it is does not touch the column (a board stays a board).
		expect('displayOptions' in saveInput(viewWith({ layout: 'board' }), DEFAULT_DEFINITION, scope)).toBe(false);
		expect('displayOptions' in saveInput(viewWith({ layout: 'timeline' }), timeline, scope)).toBe(false);
	});

	it('creates a timeline view with its layout, and a new list view without the column', () => {
		const placement = { name: 'Plan', visibility: TaskViewVisibilityEnum.PERSONAL };
		expect(createInput({ ...DEFAULT_DEFINITION, layout: 'timeline' }, placement, scope).displayOptions).toEqual({
			layout: 'timeline'
		});
		expect('displayOptions' in createInput(DEFAULT_DEFINITION, placement, scope)).toBe(false);
	});
});
