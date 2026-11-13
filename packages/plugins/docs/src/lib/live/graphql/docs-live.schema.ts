import { gql } from 'graphql-tag';

/**
 * The live editing sessions' contribution to the one GraphQL schema: `Subscription.documentLive`.
 *
 * It is registered only with `DocsLivePlugin`, so a deployment without `GAUZY_DOCS_LIVE_ENABLED=true` serves none of
 * it (and the committed schema snapshot, composed from the default plugin list, does not carry it). The field-binding
 * gate reads this document on top of the snapshot — it is named in `GATED_PLUGIN_SCHEMAS` of
 * `tools/scripts/graphql-field-binding-check.mjs` — so it must stay a plain `gql` template (no `${…}`), registered by
 * `DocsLivePlugin` as `schema: docsLiveSchemaExtensions`.
 *
 * The stream is the server's half of a session; the client's half (its edits and cursors) is
 * `POST /api/plugins/docs/documents/:id/live/updates` and `…/live/awareness`.
 */
export const docsLiveSchemaExtensions = gql`
	"""
	One frame of a live editing session of a Docs page. Binary payloads (Yjs updates, state vectors, y-protocols
	awareness updates) are base64. The first frame is sync: the page's state, its state vector, the co-editors'
	awareness, whether the session may write, and the lineage and revision of the state. Then update (someone's
	edit), awareness (someone's cursor or presence), mode (the session became read-only or writable) and, last,
	closed (with the reason).
	"""
	type DocumentLiveFrame {
		kind: String!
		documentId: ID!
		update: String
		stateVector: String
		awareness: String
		readOnly: Boolean
		reason: String
		revision: Int
		lineage: String
	}

	extend type Subscription {
		"""
		Opens a live editing session of a Docs page the caller may read. It is read-only without write access, on
		a locked page and past the page's editor limit; it closes when the caller loses read access or the page is
		trashed. Opening the same connectionId again replaces that session. Requires DOCS_READ.
		"""
		documentLive(
			"The page."
			documentId: ID!
			"The client's id for this connection (a tab): 8 to 64 letters, digits, - or _."
			connectionId: String!
		): DocumentLiveFrame!
	}
`;
