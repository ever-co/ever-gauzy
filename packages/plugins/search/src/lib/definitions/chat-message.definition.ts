import { ChatMessageKindEnum, ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * Chat messages: the body is the text (a message has no title of its own, so the title is the body too, cut by
 * the builder), the conversation and the author are keywords a request filters on — the chat's own search route
 * narrows every query to the conversations the caller is a member of, which `permission` alone cannot say: the
 * declaration is private (`privateScope`), so the generic search, suggestion and facet routes leave it out and
 * only `SearchService.searchWithin`, which that route calls with the caller's conversations as a filter, reaches it. Only a
 * member's message is indexed (a system line, or an integration's post, is not what a person searches for), and a
 * deleted message keeps its row with an empty body, so it matches nothing. A message's files are searched by the
 * names they had when it was sent (`attachmentNames`, one per line): a message of files only has no body, and is
 * found, and titled, by them.
 */
export const CHAT_MESSAGE_INDEX: ISearchIndexRegistration = {
	entity: 'chat_message',
	label: 'Chat messages',
	permission: PermissionsEnum.CHAT_VIEW,
	titleTemplate: '{{body}} {{attachmentNames}}',
	bodyTemplate: '{{body}} {{attachmentNames}}',
	keywordFields: ['conversationId', 'authorEmployeeId', 'kind'],
	visibleWhen: { field: 'kind', values: [ChatMessageKindEnum.MESSAGE] },
	privateScope: true,
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'body',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: false,
			facetable: false
		},
		{
			name: 'attachmentNames',
			kind: SearchFieldKind.TEXT,
			weight: 2,
			searchable: true,
			filterable: false,
			facetable: false
		},
		{
			name: 'conversationId',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'authorEmployeeId',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'kind',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		}
	]
};
