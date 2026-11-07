import { gql } from 'graphql-tag';

/**
 * The real-time channel's contribution to the one GraphQL schema: `Subscription.collaborationEvents`.
 *
 * It is registered only with the plugin, so a deployment without `GAUZY_REALTIME_ENABLED=true` serves none
 * of it (and the committed schema snapshot, composed from the default plugin list, does not carry it). The
 * field-binding gate reads this document on top of the snapshot — it is named in `GATED_PLUGIN_SCHEMAS` of
 * `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template (no `${…}`),
 * registered by `RealtimePlugin` as `schema: realtimeSchemaExtensions`.
 *
 * The field reuses the kernel's `EventEnvelope`: a subscriber of the collaboration events reads exactly
 * what a holder of `EVENT_OUTBOX_VIEW` reads on `Subscription.events` for the same event, under a
 * permission (`REALTIME_SUBSCRIBE`) every employee holds.
 */
export const realtimeSchemaExtensions = gql`
	extend type Subscription {
		"""
		The collaboration events of the caller's tenant and organization, selected by name: durable change
		hints (task, comment, mention, notification, document) and ephemeral signals (presence, typing).
		An addressed event (a mention, a notification, a typing signal) reaches the caller only when they are
		one of its recipients. Requires REALTIME_SUBSCRIBE.
		"""
		collaborationEvents(
			"Exact event names, or one-segment prefix patterns such as \\"task.*\\"."
			names: [String!]!
			"Narrows the stream to one aggregate (a task, a conversation)."
			aggregateId: ID
		): EventEnvelope!
	}
`;
