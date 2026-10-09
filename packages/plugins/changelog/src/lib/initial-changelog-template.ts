import { IChangelog } from '@gauzy/contracts';

/**
 * Platform-level changelog content used both by the fresh-DB seed
 * (`changelog.seed.ts`) and mirrored by the `RefreshChangelogContent`
 * migration for already-seeded deployments — keep the two in sync.
 *
 * `isFeature: false` entries feed the "What's New" sidebar and the login
 * page panel; `isFeature: true` entries feed the register page feature
 * cards (the only consumer that renders `imageUrl`). Dates are explicit:
 * `new Date()` here stamped every deployment's "news" with its seed time.
 */
export const INITIAL_CHANGELOG_TEMPLATE: IChangelog[] = [
	{
		icon: 'message-circle-outline',
		title: 'Meet your AI Assistant',
		date: new Date('2026-08-05T00:00:00.000Z'),
		content:
			'Chat with an AI agent that knows your workspace: it can navigate pages, read data, fill forms and answer questions — with voice dictation and file attachments built in.',
		isFeature: false,
		learnMoreUrl: 'https://docs.gauzy.co/features/ai-agent-chat',
		imageUrl: ''
	},
	{
		icon: 'file-text-outline',
		title: 'Documents hub',
		date: new Date('2026-08-01T00:00:00.000Z'),
		isFeature: false,
		content:
			'Upload, organize and share company files and wiki pages — and attach any document to the AI chat to discuss it.',
		learnMoreUrl: 'https://docs.gauzy.co/features/documents/overview',
		imageUrl: ''
	},
	{
		icon: 'grid-outline',
		title: 'Custom dashboards',
		date: new Date('2026-07-20T00:00:00.000Z'),
		isFeature: false,
		content:
			'Build your own dashboards: drag & drop widgets from the palette, configure each one, and switch between named layouts.',
		learnMoreUrl: 'https://docs.gauzy.co/features/dashboard-widgets',
		imageUrl: ''
	},
	{
		icon: 'color-palette-outline',
		title: 'A faster, cleaner interface',
		date: new Date('2026-07-10T00:00:00.000Z'),
		isFeature: false,
		content:
			'Redesigned navigation, denser tables, refreshed dark themes and a full-height AI chat column across the whole app.',
		learnMoreUrl: 'https://gauzy.co/',
		imageUrl: ''
	},
	{
		icon: 'message-circle-outline',
		title: 'AI at work',
		date: new Date('2026-08-05T00:00:00.000Z'),
		isFeature: true,
		content:
			'An embedded AI assistant that knows your workspace: chat, dictate, attach documents and let it do the clicking for you.',
		learnMoreUrl: 'https://docs.gauzy.co/features/ai-agent-chat',
		imageUrl: 'assets/images/features/macbook-2.png'
	},
	{
		icon: 'briefcase-outline',
		title: 'Everything your business needs',
		date: new Date('2026-07-01T00:00:00.000Z'),
		isFeature: true,
		content:
			'ERP, CRM, HRM, ATS and project management with integrated time tracking — one open platform.',
		learnMoreUrl: 'https://gauzy.co/',
		imageUrl: 'assets/images/features/macbook-1.png'
	},
	{
		icon: 'flash-outline',
		title: 'Open source, your way',
		date: new Date('2026-07-01T00:00:00.000Z'),
		isFeature: true,
		content: 'AGPL-licensed and free to self-host, with documentation covering every feature.',
		learnMoreUrl: 'https://docs.gauzy.co/',
		imageUrl: ''
	}
];
