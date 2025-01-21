import { Controller, HttpStatus, Get, Res, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { ParseJsonPipe } from '../../shared/pipes/parse-json.pipe';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { ExportService } from './export.service';

@ApiTags('Download')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EXPORT_ADD)
@Controller('/export')
export class ExportController {
	constructor(private readonly _exportService: ExportService) {}

	@ApiOperation({ summary: 'Find all exports.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async exportAll(@Query('data', ParseJsonPipe) data: any, @Res() res): Promise<any> {
		await this._exportService.createFolders();
		await this._exportService.exportTables();
		await this._exportService.archiveAndDownload();
		await this._exportService.downloadToUser(res);
		await this._exportService.deleteCsvFiles();
		await this._exportService.deleteArchive();
	}

	@ApiOperation({ summary: 'Exports all tables schemas.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables schemas'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('template')
	async downloadTemplate(@Res() res): Promise<any> {
		await this._exportService.createFolders();
		await this._exportService.exportSpecificTablesSchema();
		await this._exportService.archiveAndDownload();
		await this._exportService.downloadToUser(res);
		await this._exportService.deleteCsvFiles();
		await this._exportService.deleteArchive();
	}

	@ApiOperation({ summary: 'Find exports by name' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found specific tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('filter')
	async exportByName(@Query('data', ParseJsonPipe) data: any, @Res() res): Promise<any> {
		const {
			entities: { names }
		} = data;
		await this._exportService.createFolders();
		await this._exportService.exportSpecificTables(names);
		await this._exportService.archiveAndDownload();
		await this._exportService.downloadToUser(res);
		await this._exportService.deleteCsvFiles();
		await this._exportService.deleteArchive();
	}
}
