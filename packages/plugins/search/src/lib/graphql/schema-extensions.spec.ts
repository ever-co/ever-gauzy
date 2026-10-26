import { schemaExtensions } from './schema-extensions';

/**
 * The search document's list contract.
 *
 * Two fields of this domain answer **rows** — the index definitions the tenant has, and the status of
 * those indexes — and they answered a bare array, which a client can neither page, count nor resume
 * from. The shape is asserted here as the document prints it, because that document is what a client
 * reads and what the composition pass serves: a field that kept answering `[T!]!` while its resolver
 * answered a connection is a client reading `nodes` off an array, and an `edges` naming an edge type the
 * document never declares fails the schema rather than the request.
 *
 * `searchSuggest` and `searchFacets` are deliberately absent: a completion and a bucket count are
 * computed answers with no row set behind them, so dressing either as a connection would put a
 * `totalCount` and a `pageInfo` on a field that can honour neither.
 */
describe('the search document — the two row lists answer a connection', () => {
	/** The document, with the line breaks the template writes flattened so a declaration reads as one line. */
	const schema = (schemaExtensions as any).loc.source.body.replace(/\s+/g, ' ');

	/** The body of one type, as the document prints it. */
	function bodyOf(type: string): string {
		const start = schema.indexOf(`type ${type} {`);

		return schema.slice(start, schema.indexOf('}', start));
	}

	it('declares a pageable connection, with its edge, for the definitions and the statuses', () => {
		const converted: Array<[string, string, string, string]> = [
			[
				'searchIndexDefinitions(entity: String, page: PageInput)',
				'SearchIndexDefinitionConnection',
				'SearchIndexDefinitionEdge',
				'SearchIndexDefinition'
			],
			[
				'searchIndexStatus(entities: [String!], page: PageInput)',
				'SearchIndexStatusConnection',
				'SearchIndexStatusEdge',
				'SearchIndexStatus'
			]
		];

		for (const [field, connection, edge, row] of converted) {
			const body = bodyOf(connection);

			for (const member of [`nodes: [${row}!]!`, `edges: [${edge}!]!`, 'totalCount: Int!', 'pageInfo: PageInfo!']) {
				expect({ connection, member, declares: body.includes(member) }).toEqual({
					connection,
					member,
					declares: true
				});
			}

			// The edge is what a client walks from, so it carries the row and the cursor that addresses
			// it: an edge type the document never declares is a selection that fails at request time.
			const edgeBody = bodyOf(edge);

			for (const member of [`node: ${row}!`, 'cursor: String!']) {
				expect({ edge, member, declares: edgeBody.includes(member) }).toEqual({ edge, member, declares: true });
			}

			expect({ field, connection: schema.includes(`${field}: ${connection}!`) }).toEqual({ field, connection: true });
			// The control: the field no longer answers the bare array it used to, stated as the document
			// spelled it before the conversion.
			const wasBare = `${field.replace(', page: PageInput', '')}: [${row}!]!`;

			expect({ wasBare, declared: schema.includes(wasBare) }).toEqual({ wasBare, declared: false });
		}
	});
});
