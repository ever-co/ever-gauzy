import { environment } from '@gauzy/config';

import { AiChatPlugin } from '@gauzy/plugin-ai-chat';
import { AuthKeycloakPlugin, isKeycloakEnabled } from '@gauzy/plugin-auth-keycloak';
import { AuthOidcPlugin, isOidcEnabled } from '@gauzy/plugin-auth-oidc';
import { AuthZitadelPlugin, isZitadelEnabled } from '@gauzy/plugin-auth-zitadel';
import { AiProviderAnthropicPlugin } from '@gauzy/plugin-ai-provider-anthropic';
import { AiProviderOpenAiPlugin } from '@gauzy/plugin-ai-provider-openai';
import { AiProviderOpenRouterPlugin } from '@gauzy/plugin-ai-provider-openrouter';
import { AiProviderVercelGatewayPlugin } from '@gauzy/plugin-ai-provider-vercel-gateway';
import { AiProviderGauzyAiPlugin } from '@gauzy/plugin-ai-provider-gauzy-ai';
import { AiProviderGeminiPlugin } from '@gauzy/plugin-ai-provider-gemini';
import { AiProviderGrokPlugin } from '@gauzy/plugin-ai-provider-grok';
import { AiProviderGroqPlugin } from '@gauzy/plugin-ai-provider-groq';
import { AiProviderMistralPlugin } from '@gauzy/plugin-ai-provider-mistral';
import { AiProviderDeepgramPlugin } from '@gauzy/plugin-ai-provider-deepgram';
import { AiProviderElevenLabsPlugin } from '@gauzy/plugin-ai-provider-elevenlabs';
import { AiProviderSpeachesPlugin } from '@gauzy/plugin-ai-provider-speaches';
import { AiProviderLocalAiPlugin } from '@gauzy/plugin-ai-provider-localai';
import { AiProviderWhisperCppPlugin } from '@gauzy/plugin-ai-provider-whisper-cpp';
import { AiProviderOpenAiCompatiblePlugin } from '@gauzy/plugin-ai-provider-openai-compatible';
import { ChangelogPlugin } from '@gauzy/plugin-changelog';
import { DocsLivePlugin, DocsPlugin, isDocsLiveEnabled } from '@gauzy/plugin-docs';
import { EverConnectPlugin, isEverConnectEnabled } from '@gauzy/plugin-ever-connect';
import { EverStatsPlugin, isEverStatsEnabled } from '@gauzy/plugin-ever-stats';
import { IntegrationAIPlugin } from '@gauzy/plugin-integration-ai';
import { IntegrationGithubPlugin } from '@gauzy/plugin-integration-github';
import { IntegrationJiraCloudPlugin, IntegrationJiraPlugin, isJiraEnabled } from '@gauzy/plugin-integration-jira';
import { IntegrationHubstaffPlugin } from '@gauzy/plugin-integration-hubstaff';
import { IntegrationMakeComPlugin } from '@gauzy/plugin-integration-make-com';
import { IntegrationZapierPlugin } from '@gauzy/plugin-integration-zapier';
import { IntegrationActivepiecesPlugin } from '@gauzy/plugin-integration-activepieces';
import { IntegrationSimPlugin } from '@gauzy/plugin-integration-sim';
import { IntegrationPlanePlugin } from '@gauzy/plugin-integration-plane';
import { IntegrationEverAsyncPlugin } from '@gauzy/plugin-integration-ever-async';
import { IntegrationEverWorksPlugin, isEverWorksEnabled } from '@gauzy/plugin-integration-ever-works';
import { IntegrationLinearPlugin, isLinearEnabled } from '@gauzy/plugin-integration-linear';
import { IntegrationAsanaPlugin, isAsanaEnabled } from '@gauzy/plugin-integration-asana';
import { IntegrationTrelloPlugin, isTrelloEnabled } from '@gauzy/plugin-integration-trello';
import {
	InboxDeliveryPlugin,
	InboxEmailPlugin,
	InboxPlugin,
	isInboxEmailEnabled,
	isInboxEnabled,
	isInboxNotificationEmailEnabled,
	isInboxWebPushEnabled
} from '@gauzy/plugin-inbox';
import { isRealtimeEnabled, RealtimePlugin } from '@gauzy/plugin-realtime';

import { ChatPlugin, isChatEnabled } from '@gauzy/plugin-chat';
import { isTaskAutomationsEnabled, TaskAutomationsPlugin } from '@gauzy/plugin-task-automations';
import { EmailProviderPostmarkPlugin, isPostmarkEnabled } from '@gauzy/plugin-email-provider-postmark';
import { EmailProviderResendPlugin, isResendEnabled } from '@gauzy/plugin-email-provider-resend';
import { EmailProviderMailgunPlugin, isMailgunEnabled } from '@gauzy/plugin-email-provider-mailgun';
import { EmailProviderSendGridPlugin, isSendGridEnabled } from '@gauzy/plugin-email-provider-sendgrid';
import { EmailProviderSesPlugin, isSesEnabled } from '@gauzy/plugin-email-provider-ses';
import { IntegrationUpworkPlugin } from '@gauzy/plugin-integration-upwork';
import { JitsuAnalyticsPlugin } from '@gauzy/plugin-jitsu-analytics';
import { JobProposalPlugin } from '@gauzy/plugin-job-proposal';
import { JobSearchPlugin } from '@gauzy/plugin-job-search';
import { KnowledgeBasePlugin } from '@gauzy/plugin-knowledge-base';
import { ProductReviewsPlugin } from '@gauzy/plugin-product-reviews';
import { VideosPlugin } from '@gauzy/plugin-videos';
import { RegistryPlugin } from '@gauzy/plugin-registry';
import { CamshotPlugin } from '@gauzy/plugin-camshot';

import { CatalogPlugin } from '@gauzy/plugin-catalog';
import { PricingPlugin } from '@gauzy/plugin-pricing';
import { TaxPlugin } from '@gauzy/plugin-tax';
import { InventoryPlugin } from '@gauzy/plugin-inventory';
import { WarehousePlugin } from '@gauzy/plugin-warehouse';
import { CartPlugin } from '@gauzy/plugin-cart';
import { OrderPlugin } from '@gauzy/plugin-order';
import { PaymentPlugin } from '@gauzy/plugin-payment';
import { PromotionPlugin } from '@gauzy/plugin-promotion';
import { FulfillmentPlugin } from '@gauzy/plugin-fulfillment';
import { ReturnsPlugin } from '@gauzy/plugin-returns';
import { SubscriptionPlugin } from '@gauzy/plugin-subscription';
import { PurchasingPlugin } from '@gauzy/plugin-purchasing';
import { EntitlementPlugin } from '@gauzy/plugin-entitlement';
import { MarketplacePlugin } from '@gauzy/plugin-marketplace';
import { SearchPlugin } from '@gauzy/plugin-search';

import { SentryTracing as SentryPlugin } from './sentry';
import { PosthogAnalytics as PosthogPlugin } from './posthog';
import { SoundshotPlugin } from '@gauzy/plugin-soundshot';

import { PluginCompositionModule } from './plugin-composition';

const { jitsu, sentry, posthog } = environment;

/**
 * An array of plugins to be included or used in the codebase.
 */
export const plugins = [
	// Includes the SentryPlugin based on the presence of Sentry configuration.
	...(sentry?.dsn ? [SentryPlugin] : []),

	// Includes the PostHogPlugin based on the presence of PostHog configuration.
	...(posthog?.posthogEnabled && posthog?.posthogKey ? [PosthogPlugin] : []),

	// Ever ID as an additional sign-in method. Off unless ZITADEL_ENABLED=true; when off it is not
	// loaded at all (no route, no timer, no outbound request).
	...(isZitadelEnabled() ? [AuthZitadelPlugin] : []),

	// Keycloak as an additional sign-in method. Off unless KEYCLOAK_ENABLED=true and a Keycloak client
	// id and secret are set; when off it is not loaded at all.
	...(isKeycloakEnabled() ? [AuthKeycloakPlugin] : []),

	// Any OpenID Connect provider as an additional sign-in method. Off unless OIDC_ENABLED=true and an issuer,
	// a client id and a secret are set; when off it is not loaded at all (no route, no outbound request).
	...(isOidcEnabled() ? [AuthOidcPlugin] : []),

	// Anonymous usage statistics (one signed report a day: counts and monthly totals, never a name or a
	// record). On unless EVER_STATS_ENABLED=false; when off it is not loaded at all (no route, no timer,
	// no outbound request). Any other value keeps it on and is logged once.
	...(isEverStatsEnabled(process.env, (message) => console.warn(message)) ? [EverStatsPlugin] : []),

	// Ever Platform connection (connect code, organization links, consented integrations). Off unless
	// EVER_CONNECT_ENABLED=true; when off it is not loaded at all (no route, no timer, no outbound
	// request). Any other value keeps it off and is logged once.
	...(isEverConnectEnabled(process.env, (message) => console.warn(message)) ? [EverConnectPlugin] : []),

	// Ever Works integration (two-way sync of tasks, teams, goals, missions, ideas, agents, inbox and
	// docs with an Ever Works tenant). Off unless EVER_WORKS_ENABLED=true; when off it is not loaded at
	// all (no route, no table, no timer, no outbound request). Any other value keeps it off and is
	// logged once.
	...(isEverWorksEnabled(process.env, (message) => console.warn(message)) ? [IntegrationEverWorksPlugin] : []),

	// Linear integration (OAuth connect, team ↔ project mappings, issue import, two-way status sync,
	// webhooks). Off unless LINEAR_ENABLED=true; when off it is not loaded at all (no route, no table,
	// no outbound request). Any other value keeps it off and is logged once.
	...(isLinearEnabled(process.env, (message) => console.warn(message)) ? [IntegrationLinearPlugin] : []),

	// Asana integration (OAuth connect, project ↔ project mappings, task import, two-way sync with sections
	// as statuses, webhooks). Off unless ASANA_ENABLED=true; when off it is not loaded at all.
	...(isAsanaEnabled(process.env, (message) => console.warn(message)) ? [IntegrationAsanaPlugin] : []),

	// Trello integration (key + token connect, board ↔ project mappings, card import, two-way sync with lists as
	// statuses, webhooks). Off unless TRELLO_ENABLED=true; when off it is not loaded at all.
	...(isTrelloEnabled(process.env, (message) => console.warn(message)) ? [IntegrationTrelloPlugin] : []),

	// Inbox (questions, approvals, escalations and notices addressed to a user, each with its own state; the
	// Ever Works integration feeds it through a source-handler registry). Off unless GAUZY_INBOX_ENABLED=true;
	// when off it is not loaded at all (no route, no table, no role grant). Any other value keeps it off and is
	// logged once.
	...(isInboxEnabled(process.env, (message) => console.warn(message)) ? [InboxPlugin] : []),

	// Real-time channel (collaboration change hints on the event outbox, presence and typing signals, the
	// `collaborationEvents` subscription). Off unless GAUZY_REALTIME_ENABLED=true; when off it is not loaded at
	// all (no route, no GraphQL field, no outbox row, no role grant). Any other value keeps it off and is logged once.
	...(isRealtimeEnabled(process.env, (message) => console.warn(message)) ? [RealtimePlugin] : []),

	// Chat between employees (channels, direct and group messages, threads, reactions, mentions, task cards). Off
	// unless GAUZY_CHAT_ENABLED=true; when off it is not loaded at all (no route, no table, no role grant). Routes
	// answer only for tenants whose FEATURE_CHAT toggle is on. Any other value keeps it off and is logged once.
	...(isChatEnabled(process.env, (message) => console.warn(message)) ? [ChatPlugin] : []),

	// Task automations (rules of an organization: a trigger, conditions and actions, run in the background after a
	// task change or on a schedule, with a dry run and a run history). Off unless GAUZY_TASK_AUTOMATIONS_ENABLED=true;
	// when off it is not loaded at all (no route, no GraphQL field, no table, no outbox row, no role grant). The API
	// runs the rules (it hosts the task services they write through); the worker only fires the due-date schedule.
	// Any other value keeps it off and is logged once.
	...(isTaskAutomationsEnabled(process.env, (message) => console.warn(message)) ? [TaskAutomationsPlugin] : []),

	// Inbox email (mailboxes, the inbound pipeline, email provider accounts and the transport seam's provider
	// transports; plan 04 §5). Only on top of the Inbox, and off unless GAUZY_INBOX_EMAIL_ENABLED=true as well; when
	// off it is not loaded at all (no route, no table, no transport: mail goes out over SMTP as before).
	...(isInboxEnabled(process.env) && isInboxEmailEnabled(process.env, (message) => console.warn(message))
		? [InboxEmailPlugin]
		: []),

	// Delivery of the Inbox's notifications beyond the app (the Inbox spec FR-10–FR-13): emails (immediate or digest
	// per kind) under GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED, web push to the person's devices (their subscriptions
	// and routes) under GAUZY_INBOX_WEB_PUSH_ENABLED. Only on top of the Inbox, and off unless one of the two is
	// exactly true; the API owns the tables and the push routes, the worker runs the sweep.
	...(isInboxEnabled(process.env) &&
	(isInboxNotificationEmailEnabled(process.env, (message) => console.warn(message)) ||
		isInboxWebPushEnabled(process.env, (message) => console.warn(message)))
		? [InboxDeliveryPlugin]
		: []),

	// Email provider: Resend (plan 04 §5.2). Off unless EMAIL_PROVIDER_RESEND_ENABLED=true; when off it is not
	// loaded at all. It registers with the Inbox email provider registry, so it only does something where
	// GAUZY_INBOX_EMAIL_ENABLED=true too.
	...(isResendEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderResendPlugin] : []),

	// Email provider: Postmark (plan 04 §5.2). Off unless EMAIL_PROVIDER_POSTMARK_ENABLED=true; when off it is not
	// loaded at all. It registers with the Inbox email provider registry, so it only does something where
	// GAUZY_INBOX_EMAIL_ENABLED=true too.
	...(isPostmarkEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderPostmarkPlugin] : []),

	// Email provider: Mailgun (plan 04 §5.2). Off unless EMAIL_PROVIDER_MAILGUN_ENABLED=true; when off it is not
	// loaded at all. It registers with the Inbox email provider registry, so it only does something where
	// GAUZY_INBOX_EMAIL_ENABLED=true too.
	...(isMailgunEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderMailgunPlugin] : []),

	// Email provider: SendGrid (plan 04 §5.2). Off unless EMAIL_PROVIDER_SENDGRID_ENABLED=true; when off it is not
	// loaded at all. It registers with the Inbox email provider registry, so it only does something where
	// GAUZY_INBOX_EMAIL_ENABLED=true too.
	...(isSendGridEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderSendGridPlugin] : []),

	// Email provider: Amazon SES (plan 04 §5.2). Off unless EMAIL_PROVIDER_SES_ENABLED=true; when off it is not
	// loaded at all. It registers with the Inbox email provider registry, so it only does something where
	// GAUZY_INBOX_EMAIL_ENABLED=true too.
	...(isSesEnabled(process.env, (message) => console.warn(message)) ? [EmailProviderSesPlugin] : []),

	// Initializes the Jitsu Analytics Plugin by providing a configuration object.
	JitsuAnalyticsPlugin.init({
		config: {
			host: jitsu.serverHost,
			writeKey: jitsu.serverWriteKey,
			debug: jitsu.debug,
			echoEvents: jitsu.echoEvents
		}
	}),
	// AI agent chat engine (streaming endpoint, tools, BYOK credentials).
	AiChatPlugin,
	// AI providers for the chat engine — one plugin per provider.
	AiProviderAnthropicPlugin,
	AiProviderOpenAiPlugin,
	AiProviderOpenRouterPlugin,
	AiProviderVercelGatewayPlugin,
	// Gauzy AI provider is registered but chat is not routed through it yet (see plugin README).
	AiProviderGauzyAiPlugin,
	AiProviderGeminiPlugin,
	AiProviderGrokPlugin,
	// OpenAI-compatible cloud providers with chat + speech-to-text (dictation).
	AiProviderGroqPlugin,
	AiProviderMistralPlugin,
	// LOCAL / self-hosted providers (no API key needed): Speaches + whisper.cpp are voice-only,
	// LocalAI and the generic OpenAI-compatible endpoint do chat + voice.
	AiProviderSpeachesPlugin,
	AiProviderLocalAiPlugin,
	AiProviderWhisperCppPlugin,
	AiProviderOpenAiCompatiblePlugin,
	// Cloud speech-to-text only providers (voice / dictation).
	AiProviderDeepgramPlugin,
	AiProviderElevenLabsPlugin,
	// Documents hub plugin — registered after the AI chat/provider plugins so the provider registry is populated first.
	DocsPlugin,
	// Live co-editing of Docs pages (per-page Yjs sessions over the GraphQL subscription channel, the edits saved back
	// to the page's content). Off unless GAUZY_DOCS_LIVE_ENABLED=true; when off it is not loaded at all (no route, no
	// GraphQL field) and the editor keeps its single-writer autosave. Listed after DocsPlugin, whose services it uses.
	...(isDocsLiveEnabled(process.env) ? [DocsLivePlugin] : []),
	// Indicates the inclusion or intention to use the ChangelogPlugin in the codebase.
	ChangelogPlugin,
	// Indicates the inclusion or intention to use the IntegrationActivepiecesPlugin in the codebase.
	IntegrationActivepiecesPlugin,
	// Indicates the inclusion or intention to use the IntegrationAIPlugin in the codebase.
	IntegrationAIPlugin,
	// Indicates the inclusion or intention to use the IntegrationGithubPlugin in the codebase.
	IntegrationGithubPlugin,
	// Indicates the inclusion or intention to use the IntegrationHubstaffPlugin in the codebase.
	IntegrationHubstaffPlugin,
	// Indicates the inclusion or intention to use the IntegrationMakeComPlugin in the codebase.
	IntegrationMakeComPlugin,
	// Indicates the inclusion or intention to use the IntegrationJiraPlugin in the codebase.
	IntegrationJiraPlugin,
	// Jira Cloud sync (OAuth 2.0 connect with site choice, project ↔ project mappings, streamed issue import, two-way
	// sync with status transitions, dynamic webhooks). Off unless JIRA_ENABLED=true; when off it is not loaded at all
	// (no route, no table, no outbound request). Listed right after IntegrationJiraPlugin: the Connect descriptor
	// routes share the `/integration/jira` prefix and must be registered before the sync's `/:integrationId` routes.
	...(isJiraEnabled(process.env, (message) => console.warn(message)) ? [IntegrationJiraCloudPlugin] : []),
	// Indicates the inclusion or intention to use the IntegrationUpworkPlugin in the codebase.
	IntegrationUpworkPlugin,
	// Indicates the inclusion or intention to use the IntegrationPlanePlugin in the codebase.
	IntegrationPlanePlugin,
	IntegrationEverAsyncPlugin,
	// Indicates the inclusion or intention to use the IntegrationSimPlugin in the codebase.
	IntegrationSimPlugin,
	// Indicates the inclusion or intention to use the IntegrationZapierPlugin in the codebase.
	IntegrationZapierPlugin,
	// Indicates the inclusion or intention to use the JobProposalPlugin in the codebase.
	JobProposalPlugin,
	// Indicates the inclusion or intention to use the JobSearchPlugin in the codebase.
	JobSearchPlugin,
	// Indicates the inclusion or intention to use the KnowledgeBasePlugin in the codebase.
	KnowledgeBasePlugin,
	// Indicates the inclusion or intention to use the ProductReviewsPlugin in the codebase.
	ProductReviewsPlugin,
	// Indicates the inclusion or intention to use the VideosPlugin in the codebase.
	VideosPlugin,
	// Indicates the inclusion or intention to use the CamshotPlugin in the codebase.
	CamshotPlugin,
	// Indicates the inclusion or intention to use the SoundshotPlugin in the codebase.
	SoundshotPlugin,
	// Indicates the inclusion or intention to use the RegistryPlugin in the codebase.
	RegistryPlugin,

	// The commerce domains. Each owns its own tables, migrations, permissions and feature flags.
	// Their migrations are merged into the connection before it is opened and ORDERED BY THE
	// PLATFORM, so their position here does not affect them. Their mount order is resolved from
	// `dependsOn` by `resolvePluginLoadOrder`, which is applied to this list where it is installed —
	// so this order is a readable default rather than the contract, and the declaration each plugin
	// makes is what actually decides. A prerequisite that is not in this list is refused at boot,
	// naming the plugin and the dependency, rather than surfacing later as a missing provider.
	//
	// The order below is the dependency order for a full installation:
	//   catalog, pricing, tax        — the sellable thing, what it costs, what it is taxed
	//   inventory, warehouse         — the stock ledger, then the inside of the building
	//   cart, order, payment         — the cart, the order it becomes, the money that settles it
	//   promotion, fulfillment       — what discounts an order, how it reaches the buyer
	//   returns, subscription        — post-purchase flows, and the recurring ones
	//   purchasing, entitlement      — procuring stock, and the rights a purchase grants
	//   marketplace, search          — third-party selling, and the global index over all of it
	CatalogPlugin,
	PricingPlugin,
	TaxPlugin,
	InventoryPlugin,
	WarehousePlugin,
	CartPlugin,
	OrderPlugin,
	PaymentPlugin,
	PromotionPlugin,
	FulfillmentPlugin,
	ReturnsPlugin,
	SubscriptionPlugin,
	PurchasingPlugin,
	EntitlementPlugin,
	MarketplacePlugin,
	SearchPlugin,

	// Not a plugin: this installation's composition point, and the one entry here that carries no
	// plugin metadata. It declares no table, migration or route — it is what binds the capabilities
	// one package offers to the ports another package declares, so that neither has to import the
	// other. It is global, so the tokens it binds resolve inside every module that injects them, and
	// it declares no `dependsOn`, so the load-order resolver leaves it exactly here.
	PluginCompositionModule
];
