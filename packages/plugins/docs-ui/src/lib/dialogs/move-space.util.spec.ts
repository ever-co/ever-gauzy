import { DocumentSpaceKindEnum, DocumentVisibilityEnum, ID } from '@gauzy/contracts';
import { spaceKeyOf, spaceOfDocument, visibilityOfSpace } from './move-space.util';

describe('move-space.util', () => {
	it('gives each space the visibility a page takes in it', () => {
		expect(visibilityOfSpace(DocumentSpaceKindEnum.ORGANIZATION)).toBe(DocumentVisibilityEnum.ORGANIZATION);
		expect(visibilityOfSpace(DocumentSpaceKindEnum.TEAM)).toBe(DocumentVisibilityEnum.TEAM);
		expect(visibilityOfSpace(DocumentSpaceKindEnum.PRIVATE)).toBe(DocumentVisibilityEnum.PRIVATE);
	});

	it('reads the space a page is in, its team included', () => {
		expect(
			spaceOfDocument({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1' as ID } as never)
		).toEqual({
			kind: DocumentSpaceKindEnum.TEAM,
			organizationTeamId: 'team-1'
		});
		expect(spaceOfDocument({ visibility: DocumentVisibilityEnum.PRIVATE } as never)).toEqual({
			kind: DocumentSpaceKindEnum.PRIVATE
		});
		expect(spaceOfDocument(null)).toEqual({ kind: DocumentSpaceKindEnum.ORGANIZATION });
	});

	it('tells two team spaces apart by their team', () => {
		expect(spaceKeyOf({ kind: DocumentSpaceKindEnum.TEAM, organizationTeamId: 'a' as ID })).not.toBe(
			spaceKeyOf({ kind: DocumentSpaceKindEnum.TEAM, organizationTeamId: 'b' as ID })
		);
		expect(spaceKeyOf(spaceOfDocument({ visibility: DocumentVisibilityEnum.ORGANIZATION } as never))).toBe(
			spaceKeyOf({ kind: DocumentSpaceKindEnum.ORGANIZATION })
		);
	});
});
