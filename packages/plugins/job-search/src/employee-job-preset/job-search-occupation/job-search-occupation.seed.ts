import { DataSource } from 'typeorm';
import { IOrganization, ITenant, JobPostSourceEnum } from '@gauzy/contracts';
import { JobSearchOccupation } from './job-search-occupation.entity';

/**
 *
 * @param dataSource
 * @param tenant
 * @param organization
 * @returns
 */
export const createDefaultJobSearchOccupations = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization
): Promise<JobSearchOccupation[]> => {
	const occupations: JobSearchOccupation[] = [];

	const upworkOccupations = [
		{
			name: 'DevOps Engineering',
			jobSourceOccupationId: '1110580753140797440'
		},
		{
			name: 'Project Management',
			jobSourceOccupationId: '1017484851352698979'
		}
	];

	upworkOccupations.forEach((occupation) => {
		const occ = new JobSearchOccupation();

		occ.jobSource = JobPostSourceEnum.UPWORK;
		occ.organizationId = organization.id;
		occ.tenantId = tenant.id;
		occ.name = occupation.name;
		occ.jobSourceOccupationId = occupation.jobSourceOccupationId;

		occupations.push(occ);
	});

	await insertOccupations(dataSource, occupations);
	return occupations;
};

/**
 *
 * @param dataSource
 * @param occupations
 */
const insertOccupations = async (
	dataSource: DataSource,
	occupations: JobSearchOccupation[]
): Promise<void> => {
	await dataSource.manager.save(occupations);
};
