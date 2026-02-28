import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IHelpCenterArticle } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { HelpCenterArticle } from '../help-center-article.entity';

/**
 * Create HelpCenterArticle data validation request DTO
 * Inherits validations from the entity, omits relation objects (only IDs needed)
 */
export class CreateHelpCenterArticleDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(HelpCenterArticle, [
			'children',
			'authors',
			'versions'
		] as const)
	)
	implements Partial<IHelpCenterArticle> {}
