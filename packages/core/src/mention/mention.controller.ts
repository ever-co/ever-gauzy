import { Controller, UseGuards } from '@nestjs/common';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CrudController } from './../core/crud';
import { Mention } from './mention.entity';
import { MentionService } from './mention.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/mentions')
export class MentionController extends CrudController<Mention> {
	constructor(readonly mentionService: MentionService) {
		super(mentionService);
	}
}
