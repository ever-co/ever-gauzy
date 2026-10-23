import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IntegrationEntity, IntegrationEnum } from '@gauzy/contracts';

/**
 * The GraphQL `IntegrationEntity` enum is a closed vocabulary declared by hand in
 * `schema/integration.type.gql`. It must name exactly the values of the contract's `IntegrationEntity`,
 * or a sync flag written over REST could not be read back over GraphQL (and the reverse).
 */
describe('IntegrationEntity vocabulary', () => {
	const sdl = readFileSync(join(__dirname, 'schema', 'integration.type.gql'), 'utf8');
	/** The committed schema snapshot: what the endpoint serves, and what clients are generated from. */
	const snapshot = readFileSync(join(__dirname, '..', 'graphql', 'schema', 'schema.graphql'), 'utf8');

	function enumValues(source: string): string[] {
		const match = /enum IntegrationEntity \{([^}]*)\}/.exec(source);
		expect(match).not.toBeNull();
		return match[1]
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith('#'));
	}
	const declaredValues = () => enumValues(sdl);

	it('declares every contract value, and nothing else', () => {
		expect([...declaredValues()].sort()).toEqual([...Object.values(IntegrationEntity)].sort());
	});

	it('the committed schema snapshot serves the same values', () => {
		expect([...enumValues(snapshot)].sort()).toEqual([...Object.values(IntegrationEntity)].sort());
	});

	it('includes the Ever Works entities', () => {
		expect(declaredValues()).toEqual(
			expect.arrayContaining([
				IntegrationEntity.GOAL,
				IntegrationEntity.KEY_RESULT,
				IntegrationEntity.ORGANIZATION_TEAM,
				IntegrationEntity.STRATEGIC_INITIATIVE,
				IntegrationEntity.COMMENT,
				IntegrationEntity.DOCUMENT,
				IntegrationEntity.INBOX_ITEM,
				IntegrationEntity.AGENT
			])
		);
	});

	it('names the Ever Works provider', () => {
		expect(IntegrationEnum.EVER_WORKS).toBe('Ever_Works');
	});
});
