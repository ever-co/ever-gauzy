import { ChangelogPlatformEnum, IChangelog } from '@gauzy/contracts';

/**
 * Starter "What's new" entries of the other Ever products that read this table, keyed by product. Used by the
 * fresh-DB seed (`changelog.seed.ts`) and mirrored by the `SeedPlatformChangelogContent` migration for
 * already-seeded deployments; keep the two in sync.
 *
 * Gauzy's own entries stay in `initial-changelog-template.ts`. Every entry here is a What's New entry
 * (`isFeature: false`); only Gauzy's sign-up page shows feature cards. Each entry describes work already
 * live in its product, and the operator edits them in Settings > What's New.
 */
export const PLATFORM_CHANGELOG_TEMPLATES: Readonly<Record<string, readonly IChangelog[]>> = {
	[ChangelogPlatformEnum.EVER_TEAMS]: [
		{
			icon: 'gift-outline',
			title: "What's new and About",
			date: new Date('2026-11-08T00:00:00.000Z'),
			content:
				'Open the gift icon in the header to catch up on Ever Teams updates, and the new About page to see which version of the app and the API you are on.',
			learnMoreUrl: 'https://ever.team'
		},
		{
			icon: 'color-palette-outline',
			title: 'A lighter, cleaner look',
			date: new Date('2026-10-17T00:00:00.000Z'),
			content:
				'A compact header and sidebar, one consistent dark mode and tidier inputs and buttons across the whole app.',
			learnMoreUrl: 'https://ever.team'
		},
		{
			icon: 'bar-chart-outline',
			title: 'Weekly time report',
			date: new Date('2026-10-12T00:00:00.000Z'),
			content:
				"Group the Time & Activity report by week to see every member's tracked time day by day in one table.",
			learnMoreUrl: 'https://docs.ever.team'
		},
		{
			icon: 'people-outline',
			title: 'See who is online',
			date: new Date('2026-10-12T00:00:00.000Z'),
			content:
				'Team cards show teammates as online while they are active in the app, even when they are not tracking time.',
			learnMoreUrl: ''
		},
		{
			icon: 'clock-outline',
			title: "Today's time per task",
			date: new Date('2026-10-12T00:00:00.000Z'),
			content:
				"A member's card on the team page shows which tasks today's tracked time went to, not just the total.",
			learnMoreUrl: ''
		},
		{
			icon: 'list-outline',
			title: 'Daily plans keep your order',
			date: new Date('2026-10-12T00:00:00.000Z'),
			content: 'Drag the tasks of a daily plan into the order you want to work on them, and the order is kept.',
			learnMoreUrl: ''
		},
		{
			icon: 'message-square-outline',
			title: 'Timesheet rejection reasons',
			date: new Date('2026-10-12T00:00:00.000Z'),
			content: 'When a manager rejects a timesheet, the reason they give is saved and shown to the team member.',
			learnMoreUrl: ''
		},
		{
			icon: 'log-in-outline',
			title: 'Sign in with Ever ID',
			date: new Date('2026-10-02T00:00:00.000Z'),
			content: 'Use one Ever ID account to sign in to Ever Teams and the other Ever apps.',
			learnMoreUrl: 'https://ever.co'
		}
	],
	[ChangelogPlatformEnum.EVER_PLATFORM]: [
		{
			icon: 'grid-outline',
			title: 'One Apps page',
			date: new Date('2026-11-06T00:00:00.000Z'),
			content:
				'See the Ever products your organization uses, the apps built with Ever Works and your installs from apps.ever.co in one place, and set up or connect each.',
			learnMoreUrl: 'https://ever.co'
		},
		{
			icon: 'people-outline',
			title: 'Create your organization',
			date: new Date('2026-11-01T00:00:00.000Z'),
			content: 'Create an organization on app.ever.co and manage it and its Ever products from one place.',
			learnMoreUrl: 'https://ever.co'
		},
		{
			icon: 'shield-outline',
			title: 'Account security',
			date: new Date('2026-11-01T00:00:00.000Z'),
			content: 'Review and manage how you sign in to your Ever account from the Account security page.',
			learnMoreUrl: 'https://ever.co'
		},
		{
			icon: 'credit-card-outline',
			title: 'Billing in one place',
			date: new Date('2026-11-01T00:00:00.000Z'),
			content: "See and manage your organization's Ever subscriptions from the Billing page.",
			learnMoreUrl: 'https://ever.co'
		},
		{
			icon: 'log-in-outline',
			title: 'One Ever ID for every app',
			date: new Date('2026-10-02T00:00:00.000Z'),
			content: 'Sign in to Ever Teams, Ever Works and the other Ever apps with the same Ever ID account.',
			learnMoreUrl: 'https://ever.co'
		}
	]
};
