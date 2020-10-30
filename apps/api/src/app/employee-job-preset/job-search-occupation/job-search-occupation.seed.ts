import { Connection } from 'typeorm';
import { IOrganization, JobPostSourceEnum } from '@gauzy/models';
import { Tenant } from '../../tenant/tenant.entity';
import { JobSearchOccupation } from './job-search-occupation.entity';

export const createDefaultJobSearchOccupations = async (
	connection: Connection,
	tenant: Tenant,
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

	await insertOccupations(connection, occupations);
	return occupations;
};

const insertOccupations = async (
	connection: Connection,
	occupations: JobSearchOccupation[]
): Promise<void> => {
	await connection.manager.save(occupations);
};
