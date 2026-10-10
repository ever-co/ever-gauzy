import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AcceptanceRecord } from 'terms-acceptance';
import { Public } from '@gauzy/common';
import { ITermsAcceptanceDocument, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { AcceptTermsDTO } from './dto';
import { TermsAcceptanceService } from './terms-acceptance.service';

@ApiTags('Terms')
@Controller('/terms')
export class TermsAcceptanceController {
	constructor(private readonly termsAcceptanceService: TermsAcceptanceService) {}

	/**
	 * The documents a new account must accept, as currently published.
	 *
	 * Public and unauthenticated by necessity — it is read by the signup and
	 * invite-acceptance forms, before any account exists.
	 *
	 * The point of serving this rather than hard-coding versions in the client is
	 * that the value which gates the submit button and the value which is posted
	 * back on submit are then the same object. Dropping it becomes a visible act
	 * rather than an omission, which is exactly how the checkbox came to be
	 * decorative in the first place.
	 */
	@ApiOperation({ summary: 'List the legal documents a new account must accept' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Document id, version, sha256 and locale for each required document.'
	})
	@Get('/required')
	@Public()
	async getRequiredDocuments(@Query('locale') locale?: string): Promise<ITermsAcceptanceDocument[]> {
		return this.termsAcceptanceService.getRequiredDocuments(locale);
	}

	/**
	 * Record the caller's acceptance of the documents it was shown.
	 *
	 * The re-accept path for an account that already exists: signup and invite acceptance record their own,
	 * and this is how a signed-in person accepts a document that has been republished since. The person is
	 * the credential's — the body names documents, never a user — so an acceptance can only ever be one's
	 * own. Every claim is checked against the published corpus before it is written, and a repeated
	 * submission answers the records already on file.
	 *
	 * Stated under `PROFILE_EDIT`, the grant a person edits their own account under: an acceptance is a fact
	 * about one's own account and nobody else's.
	 */
	@ApiOperation({ summary: "Record the caller's acceptance of published legal documents" })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'One acceptance record per document.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A claim does not match published text.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PROFILE_EDIT)
	@Post('/accept')
	@UseValidationPipe({ whitelist: true, transform: true })
	async accept(@Body() input: AcceptTermsDTO): Promise<AcceptanceRecord[]> {
		return this.termsAcceptanceService.acceptAsCaller(input.terms);
	}

	/**
	 * Every acceptance on file for the caller in the caller's tenant, newest first, integrity-checked.
	 *
	 * Stated under the same grant as the write above: the read answers the caller's own evidence and nothing
	 * else, so it is a view of one's own account rather than of anybody's.
	 */
	@ApiOperation({ summary: "List the caller's own terms acceptances" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The acceptance records, newest first.' })
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PROFILE_EDIT)
	@Get('/acceptances')
	async acceptances(): Promise<AcceptanceRecord[]> {
		return this.termsAcceptanceService.historyOfCaller();
	}
}
