/**
 * The capture-address DTOs declared `organizationId` as a bare `@IsUUID()`, unlike every other scope DTO of the
 * documents plugin, so the platform's `@IsOrganizationBelongsToUser()` check never ran on it:
 * - a DOCS_READ holder could call `GET /plugins/docs/inbound-addresses?organizationId=<another organization of the
 *   tenant>` and read — minting it on first read — that organization's platform capture address, the credential
 *   that drops mailed attachments into its documents;
 * - a DOCS_MANAGE holder could rotate, disable, re-allowlist or add a custom domain for another organization.
 * They now extend a partial `TenantOrganizationBaseDTO`, which carries that check. `@gauzy/core` boots the whole
 * application graph on import, so its base is stubbed here with a stand-in for the membership rule.
 */
jest.mock('@gauzy/core', () => {
	const { IsIn, IsOptional } = jest.requireActual('class-validator');
	class TenantOrganizationBaseDTO {
		organizationId?: string;
	}
	IsOptional()(TenantOrganizationBaseDTO.prototype, 'organizationId');
	// Stand-in for `@IsOrganizationBelongsToUser()`: the caller belongs to `member-org` only.
	IsIn(['member-org'], { message: 'not a member' })(TenantOrganizationBaseDTO.prototype, 'organizationId');
	return { TenantOrganizationBaseDTO };
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DocumentInboundAddressKindEnum } from '@gauzy/contracts';
import {
	CreateDocumentInboundAddressDTO,
	DocumentInboundAddressQueryDTO,
	UpdateDocumentInboundAddressDTO
} from './document-inbound-address.dto';

const errorsOf = async (dto: any, body: Record<string, unknown>) =>
	(await validate(plainToInstance(dto, body) as object)).map((error) => error.property);

describe('Capture-address DTOs — the organization must be one the caller belongs to', () => {
	it.each([
		['the list/read query and the verify/rotate bodies', DocumentInboundAddressQueryDTO, {}],
		['the create body', CreateDocumentInboundAddressDTO, { kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN }],
		['the update body', UpdateDocumentInboundAddressDTO, {}]
	])('%s refuse another organization of the tenant', async (_label, dto, rest) => {
		expect(await errorsOf(dto, { ...rest, organizationId: 'other-org' })).toContain('organizationId');
	});

	it.each([
		['query', DocumentInboundAddressQueryDTO, {}],
		['create', CreateDocumentInboundAddressDTO, { kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN }],
		['update', UpdateDocumentInboundAddressDTO, {}]
	])('%s: accept the caller’s own organization, or none (control)', async (_label, dto, rest) => {
		expect(await errorsOf(dto, { ...rest, organizationId: 'member-org' })).not.toContain('organizationId');
		expect(await errorsOf(dto, rest)).not.toContain('organizationId');
	});
});
