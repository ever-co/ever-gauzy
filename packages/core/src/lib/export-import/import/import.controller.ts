import { Controller, HttpStatus, Post, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ImportStatusEnum, ImportTypeEnum, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { ImportService } from './import.service';
import { RequestContext } from '../../core/context';
import { FileStorage, UploadedFileStorage } from '../../core/file-storage';
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
			})
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

		try {
			/** */
			await this._importService.registerAllRepositories();
			await this._importService.unzipAndParse(key, importType === ImportTypeEnum.CLEAN);
			await this._importService.addCurrentUserToImportedOrganizations();
			this._importService.removeExtractedFiles();
			/** */
			return await this._commandBus.execute(
				new ImportHistoryCreateCommand({
					...history,
					status: ImportStatusEnum.SUCCESS
				})
			);
		} catch (error) {
			/** */
			console.log('Error while creating import history', error);
			return await this._commandBus.execute(
				new ImportHistoryCreateCommand({
					...history,
					status: ImportStatusEnum.FAILED
				})
			);
		}
	}
}
