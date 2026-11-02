/**
 * A provider credential is the tenant's, and the AI Providers page hides the organization selector, so a tenant
 * admin with no organization selected saves (and completes the OpenRouter Connect flow) without one. Both DTOs
 * extended the REQUIRED `TenantOrganizationBaseDTO`, so that first save failed with "organization must be an
 * object; organizationId must be a UUID". They now extend a partial base, which still checks an organization that
 * IS sent. `@gauzy/core` boots the whole application graph on import, so its base is stubbed here with the same
 * "one of the two is required" rule and a stand-in for the membership check.
 */
jest.mock('@gauzy/core', () => {
	const { ApiProperty } = jest.requireActual('@nestjs/swagger');
	const { IsIn, IsObject, IsUUID, ValidateIf } = jest.requireActual('class-validator');
	const isSent = (value: unknown) => value !== undefined && value !== null && value !== '';
	class TenantOrganizationBaseDTO {
		organization?: { id?: string };
		organizationId?: string;
	}
	const proto = TenantOrganizationBaseDTO.prototype;
	ApiProperty({ type: () => Object })(proto, 'organization');
	ValidateIf((it: any) => isSent(it.organization) || !it.organizationId)(proto, 'organization');
	IsObject()(proto, 'organization');
	ApiProperty({ type: () => String })(proto, 'organizationId');
	ValidateIf((it: any) => isSent(it.organizationId) || !it.organization)(proto, 'organizationId');
	IsUUID()(proto, 'organizationId');
	// Stand-in for `@IsOrganizationBelongsToUser()`: the caller belongs to this organization only.
	IsIn(['5c7d8e9f-0000-4000-8000-0000000000b1'], { message: 'not a member' })(proto, 'organizationId');
	return { TenantOrganizationBaseDTO };
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ConnectAiProviderCredentialDTO } from './connect-ai-provider-credential.dto';
import { CreateAiProviderCredentialDTO } from './create-ai-provider-credential.dto';
import { UpdateAiProviderCredentialDTO } from './update-ai-provider-credential.dto';

const OWN_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b1';
const OTHER_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b2';

const errorsOf = async (dto: any, body: Record<string, unknown>) =>
	(await validate(plainToInstance(dto, body) as object)).map((error) => error.property).sort();

/** What the settings page posts for a first OpenRouter key when no organization is selected. */
const SAVE_BODY = { providerId: 'openrouter', apiKey: 'sk-or-v1-0123456789', enabled: true, isDefault: false };
/** What the settings page posts after OpenRouter redirected back with a code. */
const CONNECT_BODY = { providerId: 'openrouter', code: 'one-time-code', codeVerifier: 'v'.repeat(64) };

describe('AI provider credential DTOs — the organization is optional, and checked when sent', () => {
	it('control: the stubbed base still requires an organization', async () => {
		expect(await errorsOf(TenantOrganizationBaseDTO, {})).toEqual(['organization', 'organizationId']);
	});

	it.each([
		['create (POST /ai-chat/credentials)', CreateAiProviderCredentialDTO, SAVE_BODY],
		['update (PUT /ai-chat/credentials/:id)', UpdateAiProviderCredentialDTO, SAVE_BODY],
		['connect (POST /ai-chat/credentials/connect)', ConnectAiProviderCredentialDTO, CONNECT_BODY]
	])('%s accepts a body without an organization', async (_label, dto, body) => {
		expect(await errorsOf(dto, body)).toEqual([]);
	});

	it.each([
		['create', CreateAiProviderCredentialDTO, SAVE_BODY],
		['update', UpdateAiProviderCredentialDTO, SAVE_BODY],
		['connect', ConnectAiProviderCredentialDTO, CONNECT_BODY]
	])('%s accepts the caller’s own organization and refuses another one', async (_label, dto, body) => {
		expect(await errorsOf(dto, { ...body, organizationId: OWN_ORGANIZATION_ID })).toEqual([]);
		expect(await errorsOf(dto, { ...body, organizationId: OTHER_ORGANIZATION_ID })).toEqual(['organizationId']);
		expect(await errorsOf(dto, { ...body, organizationId: 'not-a-uuid' })).toEqual(['organizationId']);
	});
});
