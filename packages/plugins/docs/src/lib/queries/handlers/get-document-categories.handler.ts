import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IDocumentCategory, IPagination } from '@gauzy/contracts';
import { DocumentCategoryService } from '../../services/document-category.service';
import { GetDocumentCategoriesQuery } from '../get-document-categories.query';

@QueryHandler(GetDocumentCategoriesQuery)
export class GetDocumentCategoriesHandler implements IQueryHandler<GetDocumentCategoriesQuery> {
	constructor(private readonly documentCategoryService: DocumentCategoryService) {}

	/**
	 * Handles the `GetDocumentCategoriesQuery`: the per-tenant/org catalog, sorted by name,
	 * each item carrying `documentCount`.
	 *
	 * @param query - The query carrying pagination + org scope.
	 * @returns The catalog page.
	 */
	public async execute(query: GetDocumentCategoriesQuery): Promise<IPagination<IDocumentCategory>> {
		return this.documentCategoryService.getCategories(query.params);
	}
}
