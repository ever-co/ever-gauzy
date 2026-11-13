import '../core/entities/internal';

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import {
	BulkCreateEmployeePlaceholderDTO,
	ClaimEmployeePlaceholderDTO,
	CreateEmployeePlaceholderDTO,
	MergeEmployeePlaceholderDTO,
	PLACEHOLDER_BULK_LIMIT
} from './dto/employee-placeholder.dto';
import { EmployeePlaceholderController } from './employee-placeholder.controller';

/**
 * The routes of members without an account (ever-co/ever-gauzy#11913) are guarded like adding a member to an
 * organization, and their bodies are checked before the service reads them.
 */
const ORGANIZATION = '0f5a2c6e-0000-4000-8000-000000000001';

/** The validation errors of a body, with the organization membership check answered yes. */
async function errorsOf<T extends object>(type: new () => T, body: object): Promise<string[]> {
	const errors = await validate(plainToInstance(type, body), { whitelist: true });
	return errors.map((error) => error.property);
}

beforeEach(() => {
	jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'validate').mockResolvedValue(true);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('EmployeePlaceholderController', () => {
	it('lets through only the people who may add members to an organization', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, EmployeePlaceholderController)).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeePlaceholderController)).toEqual([
			PermissionsEnum.ORG_EMPLOYEES_EDIT
		]);
	});
});

describe('the bodies of the placeholder routes', () => {
	it('takes a name, an optional email and teams of the organization', async () => {
		expect(
			await errorsOf(CreateEmployeePlaceholderDTO, {
				organizationId: ORGANIZATION,
				firstName: 'Amina',
				email: 'amina@example.com',
				teamIds: ['0f5a2c6e-0000-4000-8000-000000000002']
			})
		).toEqual([]);
		expect(
			await errorsOf(CreateEmployeePlaceholderDTO, { organizationId: ORGANIZATION, firstName: 'Amina' })
		).toEqual([]);
	});

	it('refuses a missing name, an email that is not one, and a team that is not an identifier', async () => {
		expect(await errorsOf(CreateEmployeePlaceholderDTO, { organizationId: ORGANIZATION, firstName: '' })).toEqual([
			'firstName'
		]);
		expect(
			await errorsOf(CreateEmployeePlaceholderDTO, {
				organizationId: ORGANIZATION,
				firstName: 'Amina',
				email: 'not an email',
				teamIds: ['team']
			})
		).toEqual(['email', 'teamIds']);
	});

	it(`takes between 1 and ${PLACEHOLDER_BULK_LIMIT} members in a bulk creation, each checked`, async () => {
		const member = { firstName: 'Amina' };
		expect(
			await errorsOf(BulkCreateEmployeePlaceholderDTO, { organizationId: ORGANIZATION, members: [member] })
		).toEqual([]);
		expect(await errorsOf(BulkCreateEmployeePlaceholderDTO, { organizationId: ORGANIZATION, members: [] })).toEqual(
			['members']
		);
		const tooMany = Array.from({ length: PLACEHOLDER_BULK_LIMIT + 1 }, () => member);
		expect(
			await errorsOf(BulkCreateEmployeePlaceholderDTO, { organizationId: ORGANIZATION, members: tooMany })
		).toEqual(['members']);
		expect(
			await errorsOf(BulkCreateEmployeePlaceholderDTO, {
				organizationId: ORGANIZATION,
				members: [{ firstName: 'Amina', email: 'nope' }]
			})
		).toEqual(['members']);
	});

	it('needs an email to send a claim, and a member to merge into', async () => {
		expect(await errorsOf(ClaimEmployeePlaceholderDTO, { organizationId: ORGANIZATION })).toEqual(['email']);
		expect(await errorsOf(MergeEmployeePlaceholderDTO, { organizationId: ORGANIZATION })).toEqual([
			'targetEmployeeId'
		]);
	});
});
