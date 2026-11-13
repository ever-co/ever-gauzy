import { DocumentSpaceKindEnum, DocumentVisibilityEnum, ID, JsonData } from '@gauzy/contracts';

/** The `metadata` key the collaboration feature keeps its per-document facts under. */
export const DOCS_COLLAB_METADATA_KEY = 'collaboration';

/** The collaboration facts of a document, as stored in `metadata.collaboration`. */
export interface IDocumentCollaborationMetadata {
	/** The employees who muted the page: no follow is re-created for them by the plugin's own paths. */
	mutedEmployeeIds?: ID[];
}

/** The space a document is in, from its visibility and team. */
export function spaceOf(document: { visibility: DocumentVisibilityEnum; organizationTeamId?: ID | null }): {
	kind: DocumentSpaceKindEnum;
	organizationTeamId?: ID;
} {
	if (document.visibility === DocumentVisibilityEnum.TEAM && document.organizationTeamId) {
		return { kind: DocumentSpaceKindEnum.TEAM, organizationTeamId: document.organizationTeamId };
	}
	if (document.visibility === DocumentVisibilityEnum.PRIVATE) {
		return { kind: DocumentSpaceKindEnum.PRIVATE };
	}
	return { kind: DocumentSpaceKindEnum.ORGANIZATION };
}

/** The collaboration facts of a document's metadata (never undefined). */
export function collaborationOf(metadata: JsonData | null | undefined): IDocumentCollaborationMetadata {
	const facts = (metadata as Record<string, unknown> | null | undefined)?.[DOCS_COLLAB_METADATA_KEY];
	if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
		return {};
	}
	const muted = (facts as IDocumentCollaborationMetadata).mutedEmployeeIds;
	return { mutedEmployeeIds: Array.isArray(muted) ? muted.map(String).filter(Boolean) : [] };
}

/** The employees who muted the page. */
export function mutedEmployeeIdsOf(metadata: JsonData | null | undefined): string[] {
	return collaborationOf(metadata).mutedEmployeeIds ?? [];
}

/** Whether an employee muted the page. */
export function isMutedBy(metadata: JsonData | null | undefined, employeeId: ID | null | undefined): boolean {
	return !!employeeId && mutedEmployeeIdsOf(metadata).includes(String(employeeId));
}

/**
 * The document's metadata with an employee added to, or taken out of, the muted list; the other keys are kept.
 *
 * @param metadata The metadata as stored.
 * @param employeeId The employee.
 * @param muted True to mute, false to unmute.
 * @returns The metadata to persist.
 */
export function withMuted(metadata: JsonData | null | undefined, employeeId: ID, muted: boolean): JsonData {
	const current = mutedEmployeeIdsOf(metadata);
	const id = String(employeeId);
	const next = muted ? [...new Set([...current, id])] : current.filter((item) => item !== id);
	const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
	const facts = { ...((base[DOCS_COLLAB_METADATA_KEY] as Record<string, unknown>) ?? {}), mutedEmployeeIds: next };
	return { ...base, [DOCS_COLLAB_METADATA_KEY]: facts } as JsonData;
}

/** The receivers of a page notification with the ones who muted the page, and the actor, left out. */
export function notifiableReceivers(
	receiverEmployeeIds: readonly ID[],
	metadata: JsonData | null | undefined,
	actorEmployeeId: ID | null | undefined
): ID[] {
	const muted = new Set(mutedEmployeeIdsOf(metadata));
	const actor = actorEmployeeId ? String(actorEmployeeId) : null;
	return [...new Set(receiverEmployeeIds.map(String))].filter((id) => id && id !== actor && !muted.has(id)) as ID[];
}
