import { Controller, Get, Header, HttpStatus, Param, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@gauzy/common';
import { IPublicSavedReport } from '@gauzy/contracts';
import { PublicTransformInterceptor } from '../public-share/public-transform.interceptor';
import { SavedReportPublicService } from './saved-report-public.service';

/**
 * A saved report read through its link, without signing in. Rate limited, never cached by a shared cache, and the same
 * 404 for every link that does not open a report.
 */
@ApiTags('SavedReport')
@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/saved-reports')
export class PublicSavedReportController {
	constructor(private readonly savedReportPublicService: SavedReportPublicService) {}

	@ApiOperation({ summary: 'Read a shared report through its link: report fields only, computed now' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown, expired or turned-off link, or author gone' })
	@Throttle({ default: { limit: 30, ttl: 60000 } })
	@Get('/:token')
	@Header('Cache-Control', 'no-store')
	async read(@Param('token') token: string): Promise<IPublicSavedReport> {
		return await this.savedReportPublicService.read(token);
	}
}
