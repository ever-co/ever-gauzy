import { Connection } from 'typeorm';
import { IOrganization, ITenant, JobPostSourceEnum } from '@gauzy/contracts';
import { JobSearchCategory } from './job-search-category.entity';

export const createDefaultJobSearchCategories = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<JobSearchCategory[]> => {
	const categories: JobSearchCategory[] = [];
	const upworkCategories = [
		{
			name: 'IT & Networking',
			jobSourceCategoryId: '531770282580668419'
		},
		{
			name: 'Web, Mobile & Software Dev',
			jobSourceCategoryId: '531770282580668418'
		}
	];

	upworkCategories.forEach((category) => {
		const cat = new JobSearchCategory();

		cat.jobSource = JobPostSourceEnum.UPWORK;
		cat.organizationId = organization.id;
		cat.tenantId = tenant.id;
		cat.name = category.name;
		cat.jobSourceCategoryId = category.jobSourceCategoryId;

		categories.push(cat);
	});

	await insertCategories(connection, categories);
	return categories;
};

const insertCategories = async (
	connection: Connection,
	categories: JobSearchCategory[]
): Promise<void> => {
	await connection.manager.save(categories);
};
