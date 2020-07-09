import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterAuthorService } from './help-center-author.service';

@ApiTags('knowledge_base_author')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class HelpCenterAuthorController extends CrudController<
	HelpCenterAuthor
> {
	constructor(
		private readonly helpCenterAuthorService: HelpCenterAuthorService
	) {
		super(helpCenterAuthorService);
	}
}
