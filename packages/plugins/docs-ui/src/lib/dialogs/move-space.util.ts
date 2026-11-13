import { DocumentSpaceKindEnum, DocumentVisibilityEnum, ID, IDocument, IDocumentSpace } from '@gauzy/contracts';

/** The visibility a page takes in a space. */
export function visibilityOfSpace(kind: DocumentSpaceKindEnum): DocumentVisibilityEnum {
	switch (kind) {
		case DocumentSpaceKindEnum.TEAM:
			return DocumentVisibilityEnum.TEAM;
		case DocumentSpaceKindEnum.PRIVATE:
			return DocumentVisibilityEnum.PRIVATE;
		default:
			return DocumentVisibilityEnum.ORGANIZATION;
	}
}

/** The key of a space among the spaces of the dialog. */
export function spaceKeyOf(space: Pick<IDocumentSpace, 'kind' | 'organizationTeamId'>): string {
	return `${space.kind}:${space.organizationTeamId ?? ''}`;
}

/** The space a page is in, from its visibility and team. */
export function spaceOfDocument(document: Pick<IDocument, 'visibility' | 'organizationTeamId'> | null | undefined): {
	kind: DocumentSpaceKindEnum;
	organizationTeamId?: ID;
} {
	switch (document?.visibility) {
		case DocumentVisibilityEnum.TEAM:
			return {
				kind: DocumentSpaceKindEnum.TEAM,
				organizationTeamId: (document.organizationTeamId ?? undefined) as ID
			};
		case DocumentVisibilityEnum.PRIVATE:
			return { kind: DocumentSpaceKindEnum.PRIVATE };
		default:
			return { kind: DocumentSpaceKindEnum.ORGANIZATION };
	}
}
