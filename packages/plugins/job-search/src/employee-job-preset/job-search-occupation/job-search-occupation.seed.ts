import { DataSource } from 'typeorm';
import { IOrganization, ITenant, JobPostSourceEnum } from '@gauzy/contracts';
import { JobSearchOccupation } from './job-search-occupation.entity';

/**
 * Creates default job search occupations.
 *
 * @param connection The connection to the data source for database operations.
 * @param tenant The tenant for which occupations are created.
 * @param organization The organization for which occupations are created.
 * @returns A Promise that resolves with the created job search occupations.
 */
export const createDefaultJobSearchOccupations = async (
	connection: DataSource,
	tenant: ITenant,
	organization: IOrganization
): Promise<JobSearchOccupation[]> => {
	const upworkOccupations = [
		{ name: 'DevOps Engineering', jobSourceOccupationId: '1110580753140797440' },
		{ name: 'Project Management', jobSourceOccupationId: '1017484851352698979' }
	];

	const occupations: JobSearchOccupation[] = upworkOccupations.map(occupation => {
		const occ = new JobSearchOccupation();
		occ.jobSource = JobPostSourceEnum.UPWORK;
		occ.organizationId = organization.id;
		occ.tenantId = tenant.id;
		occ.name = occupation.name;
		occ.jobSourceOccupationId = occupation.jobSourceOccupationId;
		return occ;
	});

	await connection.manager.save(occupations);
	return occupations;
};
