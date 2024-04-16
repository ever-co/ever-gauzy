import { DataSource } from 'typeorm';
import { IOrganization, ITenant, JobPostSourceEnum } from '@gauzy/contracts';
import { JobSearchCategory } from './job-search-category.entity';

/**
 * Creates default job search categories.
 *
 * @param connection The connection to the data source for database operations.
 * @param tenant The tenant for which categories are created.
 * @param organization The organization for which categories are created.
 * @returns A Promise that resolves with the created job search categories.
 */
export const createDefaultJobSearchCategories = async (
	connection: DataSource,
	tenant: ITenant,
	organization: IOrganization
): Promise<JobSearchCategory[]> => {
	const upworkCategories = [
		{ name: 'IT & Networking', jobSourceCategoryId: '531770282580668419' },
		{ name: 'Web, Mobile & Software Dev', jobSourceCategoryId: '531770282580668418' }
	];

	const categories: JobSearchCategory[] = upworkCategories.map(category => {
		const cat = new JobSearchCategory();
		cat.jobSource = JobPostSourceEnum.UPWORK;
		cat.organizationId = organization.id;
		cat.tenantId = tenant.id;
		cat.name = category.name;
		cat.jobSourceCategoryId = category.jobSourceCategoryId;
		return cat;
	});

	await connection.manager.save(categories);
	return categories;
};
