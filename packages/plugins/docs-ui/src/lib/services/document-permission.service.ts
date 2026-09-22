import { Injectable } from '@angular/core';
import { DocumentVisibilityEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

/**
 * The minimal document projection the ownership check inspects.
 *
 * Deliberately structural rather than `IDocument`: the tree carries `IDocsTreeNode`, the
 * table/cards carry the list projection and the detail panel carries the full row — all three
 * satisfy this shape, and both fields are in `DOCUMENT_LIST_COLUMNS` (`document.service.ts`),
 * so no surface has to re-read the document to answer the question.
 */
export interface IDocsMutableTarget {
	createdByUserId?: ID | null;
	visibility?: DocumentVisibilityEnum | string | null;
}

/**
 * Ownership scoping of the mutating affordances (`08-permissions-security.md` §1.7/§1.8).
 *
 * `ngxPermissionsOnly` can only answer "does this user hold `DOCS_UPDATE`" — it cannot express
 * "…on *this* document". The backend's write rule is
 * `DOCS_UPDATE AND (DOCS_MANAGE OR creator OR an EDIT share)`
 * (`plugins/docs/.../document-access.predicate.ts` `isDocumentWritable`), so a `DOCS_UPDATE`
 * holder without `DOCS_MANAGE` was being offered edit/move/archive/delete on *every* document
 * and only learned otherwise from a `403 DOCS_WRITE_FORBIDDEN`.
 *
 * This service supplies the missing row-level half. Every caller keeps its existing
 * `ngxPermissionsOnly` gate and ANDs {@link canMutate} on top — the verb permission and the
 * ownership scope are two independent conditions, exactly as they are on the server.
 *
 * 🛑 FE gating is UX only; the backend stays the enforcement boundary (§1.7). That is why the
 * PRIVATE branch below deliberately errs towards *showing* an action rather than hiding one.
 */
@Injectable()
export class DocumentPermissionService {
	constructor(private readonly store: Store) {}

	/** `DOCS_MANAGE` — the admin override that mutates everything in scope (§1.8). */
	get canManageAll(): boolean {
		return this.store.hasPermission(PermissionsEnum.DOCS_MANAGE);
	}

	/**
	 * Whether the current user created the document.
	 *
	 * Ownership is **user**-identity based (§1.6): `createdByUserId` is a `User` id, which is what
	 * `Store.userId` holds — not the employee id the share overlay is keyed by.
	 */
	isCreator(document?: IDocsMutableTarget | null): boolean {
		const userId = this.store.userId;
		return !!userId && !!document?.createdByUserId && String(document.createdByUserId) === String(userId);
	}

	/**
	 * Whether the mutating affordances should be offered for this document.
	 *
	 * `DOCS_MANAGE` holder, or the document's own creator. The third server-side path — an `EDIT`
	 * share — cannot be evaluated here: shares are a separate `GET /documents/:id/shares` read and
	 * are never part of a document projection. They apply to PRIVATE documents only (§3.3), and a
	 * PRIVATE document that is neither owned nor covered by `DOCS_MANAGE` is only *readable at all*
	 * because a share grants it — so that case resolves to `true` and lets the backend decide,
	 * rather than stripping the controls from a legitimate `EDIT` grantee. Every other document
	 * (i.e. the ORGANIZATION-visible majority) is answered exactly.
	 *
	 * An absent document is not mutable: a panel with nothing loaded has nothing to offer.
	 */
	canMutate(document?: IDocsMutableTarget | null): boolean {
		if (!document) return false;
		if (this.canManageAll || this.isCreator(document)) return true;
		return document.visibility === DocumentVisibilityEnum.PRIVATE;
	}

	/** Every row of a selection is mutable (bulk affordances). Empty selections are not mutable. */
	canMutateAll(documents?: readonly (IDocsMutableTarget | null | undefined)[] | null): boolean {
		if (!documents?.length) return false;
		return documents.every((document) => this.canMutate(document));
	}
}
