import { gql } from 'graphql-tag';

/**
 * The Docs plugin's contribution to the one GraphQL schema: the text-range anchors of page comments.
 *
 * A page's comments are the platform's (`Query.comments`, `Mutation.createComment` on entity `Document`); a comment's
 * range is the Docs plugin's, the same as `GET /api/plugins/docs/documents/:id/comment-anchors` and
 * `PUT|DELETE …/documents/:id/comments/:commentId/anchor`. `DocsPlugin` is in the default composition, so this
 * document is part of the committed schema snapshot; it stays a plain `gql` template (no `${…}`), as the gates read
 * it statically.
 */
export const docsSchemaExtensions = gql`
	"""
	Where a comment anchor is in the page as it is now. status: exact (the range still covers the quote), moved (the
	quote was found elsewhere, or approximately), block (only the block is left) or orphaned (neither). method: offsets,
	relative (the live relative positions), quote, fuzzy or block. start and end are UTF-16 offsets into the block's
	text (every text node under the block, in order); null without a range.
	"""
	type DocumentCommentAnchorPosition {
		status: String!
		method: String
		blockId: String
		start: Int
		end: Int
		text: String
	}

	"""
	Where a comment of a Docs page was made: a range of one block's text, the quote it covered and a few characters of
	context, and in a live session the range's relative positions in the page's shared document (base64
	Y.RelativePosition). One per root comment; a reply is on its thread's place.
	"""
	type DocumentCommentAnchor {
		id: ID
		commentId: ID!
		documentId: ID!
		blockId: String!
		start: Int!
		end: Int!
		quote: String!
		prefix: String
		suffix: String
		relativeStart: String
		relativeEnd: String
		createdAt: DateTime
		updatedAt: DateTime
		"Where the anchor is in the page as it is now."
		position: DocumentCommentAnchorPosition!
	}

	"""
	The anchors of a page's comments, each found again in the page as it is now (its live state when it has one, else
	its JSON). revision is the page's contentRevision the positions were computed on.
	"""
	type DocumentCommentAnchorList {
		documentId: ID!
		revision: Int!
		live: Boolean!
		items: [DocumentCommentAnchor!]!
	}

	"""
	Where a comment was made. The quote is the range's text (its length is end - start, at most 1000); prefix and
	suffix at most 32 characters; relativeStart and relativeEnd together or not at all.
	"""
	input DocumentCommentAnchorInput {
		blockId: String!
		start: Int!
		end: Int!
		quote: String!
		prefix: String
		suffix: String
		relativeStart: String
		relativeEnd: String
	}

	extend type Comment {
		"""
		Where the comment was made in its Docs page, found again in the page as it is now; null for a comment that is not
		on a page, has no range (a block comment, a reply), whose page the caller may not read, or while Docs collaboration
		is off.
		"""
		documentAnchor: DocumentCommentAnchor
	}

	extend type Query {
		"""
		The anchors of a Docs page's comments, each found again in the page as it is now. The page must be readable by
		the caller (an error otherwise, as the REST route's 404). Requires DOCS_READ and Docs collaboration.
		"""
		documentCommentAnchors(documentId: ID!, organizationId: ID): DocumentCommentAnchorList!
	}

	extend type Mutation {
		"""
		Sets where a comment of a Docs page was made: its author only, a root comment only, on a page that takes the
		author's comments. Requires DOCS_READ and Docs collaboration.
		"""
		setDocumentCommentAnchor(documentId: ID!, commentId: ID!, input: DocumentCommentAnchorInput!, organizationId: ID): DocumentCommentAnchor!

		"""
		Removes a comment's anchor (its author only): the comment is on its block again. True when one was removed.
		Requires DOCS_READ and Docs collaboration.
		"""
		removeDocumentCommentAnchor(documentId: ID!, commentId: ID!, organizationId: ID): Boolean!
	}
`;
