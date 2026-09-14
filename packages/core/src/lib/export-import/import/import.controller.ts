import { Controller, HttpStatus, Post, Body, UseGuards, UseInterceptors, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ImportStatusEnum, ImportTypeEnum, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { ImportService } from './import.service';
import { RequestContext } from '../../core/context';
import { archiveUploadFileFilter, FileStorage, UploadedFileStorage } from '../../core/file-storage';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { ImportHistoryCreateCommand } from '../import-history';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'node:path';

@ApiTags('Import')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.IMPORT_ADD)
@Controller('/import')
export class ImportController {
	private readonly logger = new Logger(ImportController.name);

	constructor(private readonly _importService: ImportService, private readonly _commandBus: CommandBus) {}

	/**
	 *
	 * @param param0
	 * @param file
	 * @returns
	 */
	@UseInterceptors(
		FileInterceptor('file', {
			storage: new FileStorage().storage({
				dest: path.join('import'),
				prefix: 'import'
			}),
			// The import format is a ZIP of CSVs; the local provider keeps the client's extension and
			// the file lands under /public, so anything else is refused before it is stored.
			fileFilter: archiveUploadFileFilter
		})
	)
	@ApiOperation({ summary: 'Imports templates records.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async parse(@Body() { importType }, @UploadedFileStorage() file: UploadedFile) {
		const { key, originalname, size } = file;
		const history = {
			file: originalname,
			path: key,
			size: size,
			tenantId: RequestContext.currentTenantId()
		};

		/**
		 * 🛑 The extraction directory belongs to THIS request and is removed in the `finally`.
		 *
		 * It used to be a field on the singleton `ImportService`, always resolving to the same
		 * `<assetPublicPath>/import/csv` path: concurrent imports read one another's CSVs, and the
		 * cleanup sat inside the `try` so a failed import left a full tenant dump readable at
		 * `GET /public/import/csv/<table>.csv` with no authentication at all (GHSA-g235-c4fm-4fc7).
		 */
		let extractPath: string;

		try {
			extractPath = await this._importService.createExtractDirectory();
			await this._importService.unzipAndParse(extractPath, key, importType === ImportTypeEnum.CLEAN);
			await this._importService.addCurrentUserToImportedOrganizations(extractPath);

			return await this._commandBus.execute(
				new ImportHistoryCreateCommand({
					...history,
					status: ImportStatusEnum.SUCCESS
				})
			);
		} catch (error) {
			this.logger.error('Error while importing tenant data', error?.stack ?? String(error));
			return await this._commandBus.execute(
				new ImportHistoryCreateCommand({
					...history,
					status: ImportStatusEnum.FAILED
				})
			);
		} finally {
			await this._importService.removeExtractedFiles(extractPath);
			await this._importService.removeUploadedArchive(key);
		}
	}
}
