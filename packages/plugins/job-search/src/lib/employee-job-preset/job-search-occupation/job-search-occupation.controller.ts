import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { JobSearchOccupationService } from './job-search-occupation.service';
import { JobSearchOccupation } from './job-search-occupation.entity';

/**
 * The job-search occupations the presets filter on.
 *
 * The routes are the job-matching page's, which the web app opens to `ORG_JOB_MATCHING_VIEW` alone, so the
 * class states that grant for every route, the nine routes inherited from the CRUD base included. They used
 * to state no guard and no permission, so any member of the tenant (VIEWER, EMPLOYEE, CANDIDATE) could
 * create, rewrite or delete them through those inherited routes.
 */
@ApiTags('JobSearchOccupation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_JOB_MATCHING_VIEW)
@Controller('/job-preset/job-search-occupation')
export class JobSearchOccupationController extends CrudController<JobSearchOccupation> {
	constructor(protected readonly jobSearchOccupationService: JobSearchOccupationService) {
		super(jobSearchOccupationService);
	}
}
