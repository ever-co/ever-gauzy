import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Language } from './language.entity';
import { LanguageService } from './language.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
@ApiTags('Languages')
@Controller()
export class LanguageController extends CrudController<Language> {
	constructor(private readonly languageService: LanguageService) {
		super(languageService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Language> {
		return this.languageService.findOneByName(name);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TAGS_EDIT)
	@Post()
	async createRecord(@Body() entity: Language): Promise<any> {
		return this.languageService.create(entity);
	}
}
