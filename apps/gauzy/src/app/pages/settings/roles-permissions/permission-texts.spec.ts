import { PermissionsEnum } from '@gauzy/contracts';
import {
	matchesPermissionSearch,
	permissionDescriptionKey,
	permissionLabelKey,
	permissionTextKeys,
	toPermissionTexts
} from './permission-texts';

describe('permission texts (#3912)', () => {
	describe('keys', () => {
		it('keys a permission by its value, not its enum member name', () => {
			// APPROVAL_POLICY_VIEW's value is APPROVALS_POLICY_VIEW, and the role stores the value
			expect(permissionLabelKey(PermissionsEnum.APPROVAL_POLICY_VIEW)).toBe(
				'ORGANIZATIONS_PAGE.PERMISSIONS.APPROVALS_POLICY_VIEW'
			);
			expect(permissionDescriptionKey(PermissionsEnum.APPROVAL_POLICY_VIEW)).toBe(
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.APPROVALS_POLICY_VIEW'
			);
		});

		it('asks for every label, then every description', () => {
			expect(permissionTextKeys([PermissionsEnum.INVOICES_VIEW, PermissionsEnum.INVOICES_EDIT])).toEqual([
				'ORGANIZATIONS_PAGE.PERMISSIONS.INVOICES_VIEW',
				'ORGANIZATIONS_PAGE.PERMISSIONS.INVOICES_EDIT',
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_VIEW',
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_EDIT'
			]);
		});
	});

	describe('toPermissionTexts', () => {
		const permissions = [PermissionsEnum.INVOICES_VIEW, PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ORG_TASK_VIEW];

		it('reads each label and description out of one lookup', () => {
			const texts = toPermissionTexts(permissions, {
				'ORGANIZATIONS_PAGE.PERMISSIONS.INVOICES_VIEW': 'View Invoices',
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_VIEW': "See the organization's invoices."
			});

			expect(texts.get(PermissionsEnum.INVOICES_VIEW)).toEqual({
				label: 'View Invoices',
				description: "See the organization's invoices."
			});
			expect([...texts.keys()]).toEqual(permissions);
		});

		it('treats a key answered with itself, an empty text or a non-string as no text', () => {
			// The app's missing-translation handler answers a missing key with the key: never shown as text
			const texts = toPermissionTexts(permissions, {
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_VIEW':
					'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_VIEW',
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.INVOICES_EDIT': '   ',
				'ORGANIZATIONS_PAGE.PERMISSIONS.DESCRIPTIONS.ORG_TASK_VIEW': { nested: true }
			});

			expect(permissions.map((permission) => texts.get(permission).description)).toEqual([
				undefined,
				undefined,
				undefined
			]);
		});

		it('copes with no lookup at all', () => {
			expect(toPermissionTexts(permissions, undefined).get(PermissionsEnum.ORG_TASK_VIEW)).toEqual({
				label: undefined,
				description: undefined
			});
		});
	});

	describe('matchesPermissionSearch', () => {
		const texts = { label: 'Rechnungen anzeigen', description: 'Die Rechnungen der Organisation sehen.' };

		it('matches everything for an empty or blank term', () => {
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, '')).toBe(true);
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, null)).toBe(true);
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, '   ')).toBe(true);
		});

		it('still matches the code read as words, without any texts', () => {
			expect(matchesPermissionSearch(PermissionsEnum.ORG_TASK_VIEW, 'Task View')).toBe(true);
			expect(matchesPermissionSearch(PermissionsEnum.ORG_TASK_VIEW, 'invoice')).toBe(false);
		});

		it('matches the translated label and description, ignoring case and surrounding blanks', () => {
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, ' rechnungen ', texts)).toBe(true);
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, 'ORGANISATION', texts)).toBe(true);
			expect(matchesPermissionSearch(PermissionsEnum.INVOICES_VIEW, 'Ausgaben', texts)).toBe(false);
		});
	});
});
