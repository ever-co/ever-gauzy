import { IPagination, IPlugin } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../../domain';
import { PluginSearchFilterDTO } from '../../../../shared';
import { SearchPluginsQuery } from '../search-plugins.query';

/**
 * Query handler for searching and filtering plugins with advanced criteria
 */
@QueryHandler(SearchPluginsQuery)
export class SearchPluginsQueryHandler implements IQueryHandler<SearchPluginsQuery> {
	constructor(private readonly pluginService: PluginService) {}

	/**
	 * Executes the SearchPluginsQuery and returns paginated plugin results with filtering
	 * @param query - The query containing search and filter parameters
	 * @returns A promise resolving to paginated plugin results
	 */
	public async execute(query: SearchPluginsQuery): Promise<IPagination<IPlugin>> {
		const { filters } = query;
		return this.searchAndFilter(filters);
	}

	/**
	 * Search and filter plugins with advanced criteria using QueryBuilder
	 * @param filters - Search and filter criteria
	 * @returns Promise resolving to paginated plugin results
	 */
	private async searchAndFilter(filters: PluginSearchFilterDTO): Promise<IPagination<IPlugin>> {
		const {
			search,
			name,
			description,
			type,
			status,
			isActive,
			categoryId,
			author,
			license,
			uploadedById,
			uploadedAfter,
			uploadedBefore,
			downloadedAfter,
			downloadedBefore,
			minDownloads,
			maxDownloads,
			version,
			tags,
			hasInstallations,
			isVerified,
			skip = 1,
			take = 10,
			sortBy = 'createdAt',
			sortDirection = 'DESC',
			relations = []
		} = filters;

		const isArray = Array.isArray(relations);
		const queryBuilder = this.pluginService.typeOrmPluginRepository.createQueryBuilder('plugin');

		if (isArray && relations.length > 0) {
			// Add relations
			if (relations.includes('category')) {
				queryBuilder.leftJoinAndSelect('plugin.category', 'category');
			}
			if (relations.includes('versions')) {
				queryBuilder.leftJoinAndSelect('plugin.versions', 'versions');
			}
			if (relations.includes('versions.sources')) {
				queryBuilder.leftJoinAndSelect('versions.sources', 'sources');
			}
			if (relations.includes('uploadedBy')) {
				queryBuilder.leftJoinAndSelect('plugin.uploadedBy', 'uploadedBy');
			}
			if (relations.includes('settings')) {
				queryBuilder.leftJoinAndSelect('plugin.settings', 'settings');
			}
		}

		// Global search across multiple fields
		if (search) {
			queryBuilder.andWhere(
				'(plugin.name ILIKE :search OR plugin.description ILIKE :search OR plugin.author ILIKE :search)',
				{ search: `%${search}%` }
			);
		}

		// Exact name match
		if (name) {
			queryBuilder.andWhere('plugin.name = :name', { name });
		}

		// Description partial match
		if (description) {
			queryBuilder.andWhere('plugin.description ILIKE :description', { description: `%${description}%` });
		}

		// Plugin type filter
		if (type) {
			queryBuilder.andWhere('plugin.type = :type', { type });
		}

		// Plugin status filter
		if (status) {
			queryBuilder.andWhere('plugin.status = :status', { status });
		}

		// Active state filter
		if (isActive !== undefined) {
			queryBuilder.andWhere('plugin.isActive = :isActive', { isActive });
		}

		// Category filter
		if (categoryId) {
			queryBuilder.andWhere('plugin.categoryId = :categoryId', { categoryId });
		}

		// Author filter
		if (author) {
			queryBuilder.andWhere('plugin.author ILIKE :author', { author: `%${author}%` });
		}

		// License filter
		if (license) {
			queryBuilder.andWhere('plugin.license ILIKE :license', { license: `%${license}%` });
		}

		// Uploaded by user filter
		if (uploadedById) {
			queryBuilder.andWhere('plugin.uploadedById = :uploadedById', { uploadedById });
		}

		// Upload date range filter
		if (uploadedAfter) {
			queryBuilder.andWhere('plugin.uploadedAt >= :uploadedAfter', { uploadedAfter });
		}
		if (uploadedBefore) {
			queryBuilder.andWhere('plugin.uploadedAt <= :uploadedBefore', { uploadedBefore });
		}

		// Last download date range filter
		if (downloadedAfter) {
			queryBuilder.andWhere('plugin.lastDownloadedAt >= :downloadedAfter', { downloadedAfter });
		}
		if (downloadedBefore) {
			queryBuilder.andWhere('plugin.lastDownloadedAt <= :downloadedBefore', { downloadedBefore });
		}

		// Version filter
		if (version) {
			if (isArray && !relations.includes('versions')) {
				queryBuilder.leftJoin('plugin.versions', 'versionFilter');
			}
			queryBuilder.andWhere('versions.number = :version OR versionFilter.number = :version', { version });
		}

		// Has installations filter
		if (hasInstallations !== undefined) {
			queryBuilder.leftJoin('plugin_installation', 'installation', 'installation.pluginId = plugin.id');
			if (hasInstallations) {
				queryBuilder.andWhere('installation.id IS NOT NULL');
			} else {
				queryBuilder.andWhere('installation.id IS NULL');
			}
		}

		// Download count range filter - using aggregated download count from versions
		let hasDownloadStatsJoin = false;
		if (minDownloads !== undefined || maxDownloads !== undefined) {
			// Create a subquery to calculate total download count for each plugin
			const downloadCountSubquery = this.pluginService.typeOrmPluginRepository
				.createQueryBuilder()
				.subQuery()
				.select('pv.pluginId')
				.addSelect('COALESCE(SUM(pv.downloadCount), 0)', 'totalDownloads')
				.from('plugin_version', 'pv')
				.groupBy('pv.pluginId')
				.getQuery();

			queryBuilder.leftJoin(`(${downloadCountSubquery})`, 'downloadStats', 'downloadStats.pluginId = plugin.id');

			hasDownloadStatsJoin = true;

			if (minDownloads !== undefined) {
				queryBuilder.andWhere('COALESCE(downloadStats.totalDownloads, 0) >= :minDownloads', { minDownloads });
			}
			if (maxDownloads !== undefined) {
				queryBuilder.andWhere('COALESCE(downloadStats.totalDownloads, 0) <= :maxDownloads', { maxDownloads });
			}
		}

		// Tags filter (placeholder - depends on how tags are implemented)
		if (tags && tags.length > 0) {
			// If tags are stored as JSON array in the plugin table
			queryBuilder.andWhere('plugin.tags @> :tags', { tags: JSON.stringify(tags) });
			// Or if tags are in a separate table
			queryBuilder.leftJoin('plugin.tags', 'pluginTags').andWhere('pluginTags.name IN (:...tags)', { tags });
		}

		// Is verified filter (placeholder - depends on verification system)
		if (isVerified !== undefined) {
			// Could join with verification/security table
			queryBuilder
				.leftJoin('plugin_verification', 'verification', 'verification.pluginId = plugin.id')
				.andWhere('verification.isVerified = :isVerified', { isVerified });
		}

		// Apply sorting - special handling for downloadCount
		if (sortBy === 'downloadCount') {
			// Only add the download stats join if we haven't already added it for filtering
			if (!hasDownloadStatsJoin) {
				const downloadCountSubquery = this.pluginService.typeOrmPluginRepository
					.createQueryBuilder()
					.subQuery()
					.select('pv.pluginId')
					.addSelect('COALESCE(SUM(pv.downloadCount), 0)', 'totalDownloads')
					.from('plugin_version', 'pv')
					.groupBy('pv.pluginId')
					.getQuery();

				queryBuilder.leftJoin(
					`(${downloadCountSubquery})`,
					'downloadStats',
					'downloadStats.pluginId = plugin.id'
				);
			}
			queryBuilder.orderBy(
				'COALESCE(downloadStats.totalDownloads, 0)',
				sortDirection.toUpperCase() as 'ASC' | 'DESC'
			);
		} else {
			// Standard sorting for other fields
			queryBuilder.orderBy(`plugin.${sortBy}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
		}

		// Pagination
		queryBuilder.skip((skip - 1) * take).take(take);

		// Execute query and get results with total count
		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total
		} as IPagination<IPlugin>;
	}
}
