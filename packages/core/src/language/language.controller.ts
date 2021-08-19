import { Controller, Get, Param, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ILanguage, IPagination } from '@gauzy/contracts';
import { Language } from './language.entity';
import { LanguageService } from './language.service';
import { Public } from './../shared/decorators';

@ApiTags('Languages')
@Controller()
export class LanguageController {
	constructor(
		private readonly languageService: LanguageService
	) { }

	@ApiOperation({ summary: 'Find all language.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found language',
		type: Language
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@Public()
	async findAll(
		@Query() query: any
	): Promise<IPagination<ILanguage>> {
		return this.languageService.findAll(query);
	}

	@Get('getByName/:name')
	@Public()
	async findByName(@Param('name') name: string): Promise<ILanguage> {
		return this.languageService.findOneByName(name);
	}
}
