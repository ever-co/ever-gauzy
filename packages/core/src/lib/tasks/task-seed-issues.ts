/**
 * The issues the task seeds turn into tasks when GitHub cannot be reached.
 *
 * The seeds read the open issues of `ever-co/ever-gauzy` from the GitHub API, unauthenticated: 60 requests an hour
 * per IP. A demo cluster shares its egress IP with CI runners, and a workstation running several API boots exhausts
 * it, so the request regularly answers 403 — and the seed used to stop there: no tags, no tasks, and with no
 * project holding a task the time logs, activities and job proposals seeded after it failed too. These stand in for
 * the GitHub issues: the same shape (`title`, `body`, `state`, `labels`) and a spread of labels, so tasks, tags and
 * everything built on them are seeded either way.
 */
export interface ISeedIssueLabel {
	name: string;
	description: string;
	/** Hex colour without the `#`, as GitHub answers it. */
	color: string;
}

export interface ISeedIssue {
	title: string;
	body: string;
	state: 'open' | 'closed';
	labels: ISeedIssueLabel[];
}

const BUG: ISeedIssueLabel = { name: 'bug', description: "Something isn't working", color: 'd73a4a' };
const ENHANCEMENT: ISeedIssueLabel = { name: 'enhancement', description: 'New feature or request', color: 'a2eeef' };
const DOCUMENTATION: ISeedIssueLabel = {
	name: 'documentation',
	description: 'Improvements or additions to documentation',
	color: '0075ca'
};
const UI: ISeedIssueLabel = { name: 'UI/UX', description: 'Look and feel of the web app', color: 'fbca04' };
const API: ISeedIssueLabel = { name: 'API', description: 'REST and GraphQL API', color: '5319e7' };
const DESKTOP: ISeedIssueLabel = { name: 'desktop', description: 'Desktop timer and server apps', color: '1d76db' };
const PERFORMANCE: ISeedIssueLabel = { name: 'performance', description: 'Speed and resource use', color: 'c5def5' };
const GOOD_FIRST_ISSUE: ISeedIssueLabel = {
	name: 'good first issue',
	description: 'Good for newcomers',
	color: '7057ff'
};

export const SEED_SAMPLE_ISSUES: ISeedIssue[] = [
	{
		title: 'Export the weekly timesheet report as CSV',
		body: 'Managers want to download the weekly report and open it in a spreadsheet.',
		state: 'open',
		labels: [ENHANCEMENT]
	},
	{
		title: 'Timer keeps running after the laptop wakes from sleep',
		body: 'The desktop timer should stop or ask what to do with the time spent asleep.',
		state: 'open',
		labels: [BUG, DESKTOP]
	},
	{
		title: 'Show the project budget usage on the project card',
		body: 'A progress bar of hours or cost used against the budget.',
		state: 'open',
		labels: [ENHANCEMENT, UI]
	},
	{
		title: 'Invoice PDF cuts long item descriptions',
		body: 'Descriptions longer than two lines are clipped in the generated PDF.',
		state: 'open',
		labels: [BUG]
	},
	{
		title: 'Document how to run the API with PostgreSQL locally',
		body: 'Step by step: database, environment variables, migrations, seed.',
		state: 'open',
		labels: [DOCUMENTATION, GOOD_FIRST_ISSUE]
	},
	{
		title: 'Paginate the employees list on the server',
		body: 'Large organizations load every employee at once.',
		state: 'open',
		labels: [PERFORMANCE, API]
	},
	{
		title: 'Dark theme: low contrast in the dashboard charts',
		body: 'Axis labels are hard to read on the dark theme.',
		state: 'open',
		labels: [BUG, UI]
	},
	{
		title: 'Allow filtering tasks by sprint in the task list',
		body: 'Add a sprint filter beside the status and priority filters.',
		state: 'open',
		labels: [ENHANCEMENT, UI]
	},
	{
		title: 'Expense categories cannot be renamed',
		body: 'Renaming a category answers an error although the name is unique.',
		state: 'open',
		labels: [BUG, API]
	},
	{
		title: 'Add keyboard shortcuts to start and stop the timer',
		body: 'A global shortcut in the desktop app and one in the web app.',
		state: 'open',
		labels: [ENHANCEMENT, DESKTOP]
	},
	{
		title: 'Speed up the screenshots gallery for a full day',
		body: 'Load thumbnails lazily instead of every image of the day.',
		state: 'open',
		labels: [PERFORMANCE, UI]
	},
	{
		title: 'Explain the approval policies in the help center',
		body: 'What each policy does and who can approve what.',
		state: 'open',
		labels: [DOCUMENTATION]
	},
	{
		title: 'Remember the last selected organization after logout',
		body: 'The header selector resets to the first organization on every login.',
		state: 'open',
		labels: [ENHANCEMENT, GOOD_FIRST_ISSUE]
	},
	{
		title: 'Time off requests ignore the employee time zone',
		body: 'A request made late in the day is stored on the next day.',
		state: 'open',
		labels: [BUG]
	},
	{
		title: 'Webhook for a task status change',
		body: 'Notify an external system when a task moves to another status.',
		state: 'open',
		labels: [ENHANCEMENT, API]
	}
];
