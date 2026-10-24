import { IOrganizationProject, IOrganizationProjectEmployee, ProjectStatusEnum, RolesEnum } from '@gauzy/contracts';
import { IRecordViewField, IRecordViewSection, IRecordViewStatus } from '@gauzy/ui-core/shared';

/**
 * The read-only description of one project, for the project quick-look drawer of the Projects panels:
 * who works on it, its plan and billing, its description, and the created / updated stamps.
 */

/** Relations the View reads. */
export const PROJECT_VIEW_RELATIONS: string[] = [
	'organizationContact',
	'members.employee.user',
	'members.role',
	'tags',
	'teams',
	'teams.members',
	'teams.members.employee',
	'teams.members.employee.user',
	'image'
];

/**
 * Whether a project member manages the project: flagged `isManager`, or holding the MANAGER role. The server sets
 * the flag only for a caller holding CHANGE_SELECTED_EMPLOYEE; the managers of a project an employee creates hold
 * the role alone, as team managers do.
 */
export function managesProject(member: IOrganizationProjectEmployee): boolean {
	return !!member?.isManager || member?.role?.name === RolesEnum.MANAGER;
}

export interface IProjectViewText {
	/** Translates an i18n key (visibility). */
	translate: (key: string) => string;
}

export interface IProjectViewOptions {
	/**
	 * The project's own page: its headline, timeline and Team panel already show the people, status,
	 * visibility, client and dates, so Details leaves them out — and an empty description is left out
	 * rather than shown as "None".
	 */
	page?: boolean;
	/** The page's headline shows the billing figure (it does while there is no hours-budget bar). */
	billingInHeadline?: boolean;
	/** The page's headline shows the budget (its bar, or a cost budget under the billing figure). */
	budgetInHeadline?: boolean;
}

/** Status for the Details row; the standard values arrive as enum slugs ('in-progress'). */
export function projectStatusOf(project: IOrganizationProject): IRecordViewStatus {
	if (!project.status) {
		return null;
	}
	const text = project.status.replace(/-/g, ' ');
	switch (project.status) {
		case ProjectStatusEnum.COMPLETED:
			return { text, tone: 'success' };
		case ProjectStatusEnum.CANCELLED:
			return { text, tone: 'danger' };
		case ProjectStatusEnum.IN_PROGRESS:
			return { text, tone: 'info' };
		default:
			return { text, tone: 'basic' };
	}
}

/** "1,000 (cost)" — the budget with its type, the way the project form sets it. */
function budgetOf(project: IOrganizationProject): string {
	if (project.budget === null || project.budget === undefined) {
		return null;
	}
	const amount = project.budget.toLocaleString();
	return project.budgetType ? `${amount} (${project.budgetType})` : amount;
}

/**
 * Field descriptor for a project's View. Name and logo are in the drawer heading; the Details panel
 * holds people then planning, the description is prose, and the stamps close it.
 */
export function buildProjectViewSections(
	project: IOrganizationProject,
	text: IProjectViewText,
	options: IProjectViewOptions = {}
): IRecordViewSection[] {
	const members = (project.members || []).filter((member) => !!member?.employee);
	const managers = members.filter((member) => managesProject(member)).map((member) => member.employee);
	const others = members.filter((member) => !managesProject(member)).map((member) => member.employee);
	// Rows the project's own page shows elsewhere, by label: each only while something else shows it.
	const shownElsewhere = new Set<string>([
		...(options.page
			? [
					'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS',
					'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS',
					'ORGANIZATIONS_PAGE.EDIT.CONTACT',
					'FORM.LABELS.STATUS',
					'ORGANIZATIONS_PAGE.EDIT.VISIBILITY',
					'ORGANIZATIONS_PAGE.EDIT.START_DATE',
					'ORGANIZATIONS_PAGE.EDIT.END_DATE'
				]
			: []),
		...(options.page && options.billingInHeadline
			? ['ORGANIZATIONS_PAGE.EDIT.BILLING', 'ORGANIZATIONS_PAGE.EDIT.CURRENCY']
			: []),
		...(options.page && options.budgetInHeadline ? ['ORGANIZATIONS_PAGE.BUDGET'] : [])
	]);

	const sections: IRecordViewSection[] = [
		{
			title: 'BUTTONS.DETAILS',
			icon: 'info-outline',
			collapsible: true,
			fields: (
				[
					// People
					{
						label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MANAGERS',
						type: 'people',
						value: managers,
						icon: 'award-outline'
					},
					{
						label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS',
						type: 'people',
						value: others,
						icon: 'people-outline',
						showWhenEmpty: true
					},
					{ label: 'ORGANIZATIONS_PAGE.EDIT.TEAMS', key: 'teams', type: 'teams', icon: 'briefcase-outline' },
					{
						label: 'ORGANIZATIONS_PAGE.EDIT.CONTACT',
						key: 'organizationContact.name',
						icon: 'person-outline'
					},
					// Planning
					{
						label: 'FORM.LABELS.STATUS',
						type: 'status',
						value: projectStatusOf(project),
						icon: 'checkmark-circle-2-outline',
						divider: true
					},
					{
						// Blank until the full read says: the card the drawer opens with has no `public`.
						label: 'ORGANIZATIONS_PAGE.EDIT.VISIBILITY',
						value:
							typeof project.public === 'boolean'
								? text.translate(project.public ? 'BUTTONS.PUBLIC' : 'BUTTONS.PRIVATE')
								: null,
						icon: project.public ? 'globe-outline' : 'lock-outline'
					},
					{
						label: 'ORGANIZATIONS_PAGE.EDIT.START_DATE',
						key: 'startDate',
						type: 'date',
						icon: 'calendar-outline'
					},
					{
						label: 'ORGANIZATIONS_PAGE.EDIT.END_DATE',
						key: 'endDate',
						type: 'date',
						icon: 'calendar-outline'
					},
					{ label: 'ORGANIZATIONS_PAGE.EDIT.BILLING', key: 'billing', icon: 'credit-card-outline' },
					{ label: 'ORGANIZATIONS_PAGE.EDIT.CURRENCY', key: 'currency', icon: 'pricetags-outline' },
					{ label: 'ORGANIZATIONS_PAGE.BUDGET', value: budgetOf(project), icon: 'pie-chart-outline' },
					{ label: 'ORGANIZATIONS_PAGE.EDIT.OWNER', key: 'owner', icon: 'person-done-outline' },
					{
						label: 'FORM.LABELS.PROJECT_URL',
						key: 'projectUrl',
						type: 'link',
						icon: 'link-2-outline'
					},
					{
						label: 'FORM.LABELS.OPEN_SOURCE_PROJECT_URL',
						key: 'openSourceProjectUrl',
						type: 'link',
						icon: 'github-outline'
					},
					{
						label: 'SM_TABLE.TAGS',
						key: 'tags',
						type: 'tags',
						icon: 'pricetags-outline',
						showWhenEmpty: true
					}
				] as IRecordViewField[]
			).filter((field) => !shownElsewhere.has(field.label))
		},
		{
			title: 'FORM.LABELS.DESCRIPTION',
			icon: 'file-text-outline',
			variant: 'plain',
			fields: [
				{
					label: 'FORM.LABELS.DESCRIPTION',
					key: 'description',
					type: 'markdown',
					hideLabel: true,
					showWhenEmpty: !options.page
				}
			]
		},
		{
			variant: 'meta',
			fields: [
				{ label: 'SM_TABLE.CREATED_AT', key: 'createdAt', type: 'datetime', icon: 'plus-circle-outline' },
				{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'datetime', icon: 'refresh-outline' }
			]
		}
	];
	// On the page, a project without a description has no Description block at all.
	return options.page && !project.description?.trim()
		? sections.filter((section) => section.title !== 'FORM.LABELS.DESCRIPTION')
		: sections;
}
