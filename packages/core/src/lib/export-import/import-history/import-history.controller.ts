import { Controller, Get, HttpStatus, Param, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ID, IImportHistory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UUIDValidationPipe } from './../../shared/pipes';
import { ImportHistoryService } from './import-history.service';

@ApiTags('Import History')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD)
@Controller('/import/history')
export class ImportHistoryController {
	constructor(private readonly _importHistoryService: ImportHistoryService) {}

	/**
	 *
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all imports history.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found import history'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(): Promise<IPagination<IImportHistory>> {
		return await this._importHistoryService.findAll();
	}

	/**
	 * Downloads the archive an import was made from.
	 *
	 * Replaces the public `fullUrl` link the Import page used to hand to the browser: the archive is a
	 * full tenant data dump, so it is served only here — behind the same tenant and permission guards
	 * as the history list (the class-level `@Permissions` applies to this handler too), and only for the
	 * caller's own tenant's rows.
	 *
	 * @param id - The import-history row.
	 * @param res - The Express response the archive is written to.
	 */
	@ApiOperation({ summary: 'Download the archive of one import.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The import archive (application/zip)'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record or archive not found'
	})
	@Get(':id/download')
	async download(@Param('id', UUIDValidationPipe) id: ID, @Res() res: Response): Promise<void> {
		const { file, content } = await this._importHistoryService.getArchive(id);

		res.setHeader('Content-Type', 'application/zip');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		// `attachment()` encodes the client-supplied original name per RFC 6266, so it cannot inject headers.
		res.attachment(file || 'import.zip');
		res.send(content);
	}
}
