/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls Akita's
 * untranspiled ESM into the CommonJS test runtime. The service only reads `Store.userId` and
 * `Store.hasPermission()`, so a stub standing in for it keeps the suite honest without booting
 * the app graph (same shape as `documents.service.spec.ts`).
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { DocumentVisibilityEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocumentPermissionService, IDocsMutableTarget } from './document-permission.service';

const ME = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const SOMEONE_ELSE = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

/** Minimal `Store` double — the two members the service touches. */
class StoreStub {
	constructor(public userId: ID | null = ME, private readonly granted: PermissionsEnum[] = []) {}

	hasPermission(permission: PermissionsEnum): boolean {
		return this.granted.includes(permission);
	}
}

function serviceFor(store: StoreStub): DocumentPermissionService {
	return new DocumentPermissionService(store as unknown as Store);
}

/** An ORGANIZATION-visible document created by someone else, unless overridden. */
function document(overrides: Partial<IDocsMutableTarget> = {}): IDocsMutableTarget {
	return {
		createdByUserId: SOMEONE_ELSE,
		visibility: DocumentVisibilityEnum.ORGANIZATION,
		...overrides
	};
}

describe('DocumentPermissionService — ownership scoping (08 §1.7/§1.8)', () => {
	describe('canMutate', () => {
		// The defect this closes: a DOCS_UPDATE holder without DOCS_MANAGE was offered
		// edit/move/archive/delete on EVERY document and learned otherwise from a 403.
		it('is false on another user\'s ORGANIZATION document without DOCS_MANAGE', () => {
			expect(serviceFor(new StoreStub(ME)).canMutate(document())).toBe(false);
		});

		it('is true for the creator', () => {
			expect(serviceFor(new StoreStub(ME)).canMutate(document({ createdByUserId: ME }))).toBe(true);
		});

		it('is true for a DOCS_MANAGE holder on anything', () => {
			const service = serviceFor(new StoreStub(ME, [PermissionsEnum.DOCS_MANAGE]));

			expect(service.canMutate(document())).toBe(true);
		});

		// Ownership is user-identity based (§1.6), and ids arrive as strings or branded ids
		// depending on the projection — compare by value, never by reference.
		it('matches the creator across id representations', () => {
			expect(serviceFor(new StoreStub(ME)).canMutate({ createdByUserId: String(ME) as ID })).toBe(true);
		});

		it('is false when either side has no user id', () => {
			expect(serviceFor(new StoreStub(null)).canMutate(document({ createdByUserId: ME }))).toBe(false);
			expect(serviceFor(new StoreStub(ME)).canMutate(document({ createdByUserId: null }))).toBe(false);
		});

		// A readable PRIVATE document the user neither owns nor manages is only readable
		// *because* a share grants it, and the share level is not on any document projection.
		// Hiding there would strip the controls from a legitimate EDIT grantee, so the call
		// resolves permissively and the backend decides (FE gating is UX only, §1.7).
		it('stays permissive on a readable PRIVATE document it cannot classify', () => {
			expect(serviceFor(new StoreStub(ME)).canMutate(document({ visibility: DocumentVisibilityEnum.PRIVATE }))).toBe(
				true
			);
		});

		it('is false with no document at all', () => {
			expect(serviceFor(new StoreStub(ME)).canMutate(null)).toBe(false);
			expect(serviceFor(new StoreStub(ME)).canMutate(undefined)).toBe(false);
		});
	});

	describe('canMutateAll', () => {
		it('requires every row of the selection', () => {
			const service = serviceFor(new StoreStub(ME));
			const mine = document({ createdByUserId: ME });

			expect(service.canMutateAll([mine, mine])).toBe(true);
			expect(service.canMutateAll([mine, document()])).toBe(false);
		});

		it('is false for an empty selection', () => {
			expect(serviceFor(new StoreStub(ME)).canMutateAll([])).toBe(false);
		});
	});
});
