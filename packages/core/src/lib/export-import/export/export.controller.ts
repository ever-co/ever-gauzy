import { Controller, HttpStatus, Get, Res, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { ParseJsonPipe } from '../../shared/pipes/parse-json.pipe';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { ExportService } from './export.service';

/**
 * 🛑 Every handler here follows the same shape: take a job, do the work inside a `try`, and clean
 * the job's scratch directory up in a `finally`.
 *
 * Two defects are closed by that shape. The job makes each request use only its OWN files, where
 * the service used to keep the current csv/zip ids in shared singleton fields that a concurrent
 * request could overwrite mid-export (GHSA-g235-c4fm-4fc7). The `finally` makes the delete
 * unconditional, where a throw anywhere in the sequence used to leave the plaintext CSVs and the
 * archive on disk indefinitely.
 */
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
	async exportAll(
		@Query('data', ParseJsonPipe) data: any,
		@Query('organizationId') organizationId: string,
		@Res() res
	): Promise<any> {
		const job = await this._exportService.createExportJob();
		try {
			await this._exportService.exportTables(job, organizationId);
			await this._exportService.archiveAndDownload(job);
			await this._exportService.downloadToUser(job, res);
		} finally {
			await this._exportService.cleanup(job);
		}
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
		const job = await this._exportService.createExportJob();
		try {
			await this._exportService.exportSpecificTablesSchema(job);
			await this._exportService.archiveAndDownload(job);
			await this._exportService.downloadToUser(job, res);
		} finally {
			await this._exportService.cleanup(job);
		}
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
	async exportByName(
		@Query('data', ParseJsonPipe) data: any,
		@Headers() headers: Record<string, string>,
		@Res() res
	): Promise<any> {
		const {
			entities: { names }
		} = data;
		// NOTE: Express lower-cases header names, so this is always undefined (and the Angular client never
		// sends it). It only stamps the global default rows; it never narrows the export. Tracked separately.
		const organizationId = headers['Organization-Id'];
		const job = await this._exportService.createExportJob();
		try {
			await this._exportService.exportSpecificTables(job, names, organizationId);
			await this._exportService.archiveAndDownload(job);
			await this._exportService.downloadToUser(job, res);
		} finally {
			await this._exportService.cleanup(job);
		}
	}
}
