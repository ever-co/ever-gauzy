import { DocumentSpaceKindEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { collaborationOf, isMutedBy, mutedEmployeeIdsOf, notifiableReceivers, spaceOf, withMuted } from './document-collaboration.helpers';

const ANNA = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';

describe('document collaboration helpers', () => {
	it('reads the space of a document from its visibility and team', () => {
		expect(spaceOf({ visibility: DocumentVisibilityEnum.ORGANIZATION })).toEqual({ kind: DocumentSpaceKindEnum.ORGANIZATION });
		expect(spaceOf({ visibility: DocumentVisibilityEnum.PRIVATE })).toEqual({ kind: DocumentSpaceKindEnum.PRIVATE });
		expect(spaceOf({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: TEAM })).toEqual({ kind: DocumentSpaceKindEnum.TEAM, organizationTeamId: TEAM });
		// A TEAM document whose team is gone (deleted team → SET NULL) lists with the organization's until moved.
		expect(spaceOf({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: null })).toEqual({ kind: DocumentSpaceKindEnum.ORGANIZATION });
	});

	it('keeps the muted list in the metadata without touching the other keys', () => {
		const metadata = { email: { from: 'x@y' } } as never;
		const muted = withMuted(metadata, ANNA, true);
		expect(mutedEmployeeIdsOf(muted)).toEqual([ANNA]);
		expect((muted as Record<string, unknown>)['email']).toEqual({ from: 'x@y' });
		expect(isMutedBy(muted, ANNA)).toBe(true);
		expect(isMutedBy(muted, BOB)).toBe(false);
		const twice = withMuted(withMuted(muted, ANNA, true), BOB, true);
		expect(mutedEmployeeIdsOf(twice)).toEqual([ANNA, BOB]);
		expect(mutedEmployeeIdsOf(withMuted(twice, ANNA, false))).toEqual([BOB]);
		expect(collaborationOf(null)).toEqual({});
		expect(collaborationOf({ collaboration: 'junk' } as never)).toEqual({});
		expect(collaborationOf({ collaboration: { mutedEmployeeIds: 'junk' } } as never)).toEqual({ mutedEmployeeIds: [] });
	});

	it('leaves the actor and the people who muted the page out of the receivers', () => {
		const metadata = withMuted(null, BOB, true);
		expect(notifiableReceivers([ANNA, BOB, ANNA, '' as never], metadata, null)).toEqual([ANNA]);
		expect(notifiableReceivers([ANNA, BOB], metadata, ANNA)).toEqual([]);
		expect(notifiableReceivers([ANNA, BOB], null, null)).toEqual([ANNA, BOB]);
	});
});
