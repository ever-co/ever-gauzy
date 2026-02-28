import { PartialType } from '@nestjs/swagger';
import { IHelpCenterArticleUpdate } from '@gauzy/contracts';
import { CreateHelpCenterArticleDTO } from './create-help-center-article.dto';

/**
 * Update HelpCenterArticle data validation request DTO
 * All fields are optional
 */
export class UpdateHelpCenterArticleDTO
	extends PartialType(CreateHelpCenterArticleDTO)
	implements IHelpCenterArticleUpdate {}
