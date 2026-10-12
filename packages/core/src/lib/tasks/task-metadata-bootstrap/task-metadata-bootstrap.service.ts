import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import {
	ITaskMetadataBootstrapQuery,
	ITaskMetadataBootstrapResponse,
	TASK_METADATA_SECTIONS,
	TaskMetadataSection
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TagService } from '../../tags/tag.service';
import { IssueTypeService } from '../issue-type/issue-type.service';
import { TaskPriorityService } from '../priorities/priority.service';
import { TaskRelatedIssueTypeService } from '../related-issue-type/related-issue-type.service';
import { TaskSizeService } from '../sizes/size.service';
import { TaskStatusService } from '../statuses/status.service';
import { TaskVersionService } from '../versions/version.service';

type TaskMetadataLoaderMap = {
	[Section in TaskMetadataSection]: () => Promise<NonNullable<ITaskMetadataBootstrapResponse[Section]>>;
};

type TaskMetadataEntry = readonly [
	TaskMetadataSection,
	NonNullable<ITaskMetadataBootstrapResponse[TaskMetadataSection]>
];

function assertUnreachableSection(_section: never): never {
	throw new BadRequestException();
}

@Injectable()
export class TaskMetadataBootstrapService {
	constructor(
		private readonly taskStatusService: TaskStatusService,
		private readonly taskPriorityService: TaskPriorityService,
		private readonly taskSizeService: TaskSizeService,
		private readonly tagService: TagService,
		private readonly taskVersionService: TaskVersionService,
		private readonly issueTypeService: IssueTypeService,
		private readonly taskRelatedIssueTypeService: TaskRelatedIssueTypeService,
		private readonly configService: ConfigService
	) {}

	async bootstrap(query: ITaskMetadataBootstrapQuery): Promise<ITaskMetadataBootstrapResponse> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			throw new ForbiddenException();
		}

		const include: readonly TaskMetadataSection[] = query.include ?? TASK_METADATA_SECTIONS;
		const canonicalSections: readonly unknown[] = TASK_METADATA_SECTIONS;

		if (include.some((section) => !canonicalSections.includes(section))) {
			throw new BadRequestException();
		}

		const { organizationId, organizationTeamId, projectId } = query;
		const scope = { tenantId, organizationId, organizationTeamId, projectId };
		const loaders: TaskMetadataLoaderMap = {
			taskStatuses: () => this.taskStatusService.fetchAll(scope),
			taskPriorities: () => this.taskPriorityService.fetchAll(scope),
			taskSizes: () => this.taskSizeService.fetchAll(scope),
			taskLabels: () => this.tagService.findTagsByLevel({ organizationId, organizationTeamId }),
			taskVersions: () => this.taskVersionService.fetchAll(scope),
			issueTypes: () => this.issueTypeService.fetchAll(scope),
			relatedIssueTypes: () => this.taskRelatedIssueTypeService.fetchAll(scope)
		};

		const entries =
			this.configService.dbConnectionOptions.type === DatabaseTypeEnum.betterSqlite3
				? await this.loadSynchronousSqliteSections(include, loaders)
				: await Promise.all(
						include.map(async (section) => [section, await this.loadSection(section, loaders)] as const)
					);

		return Object.fromEntries(entries) as ITaskMetadataBootstrapResponse;
	}

	private loadSection(
		section: TaskMetadataSection,
		loaders: TaskMetadataLoaderMap
	): Promise<NonNullable<ITaskMetadataBootstrapResponse[TaskMetadataSection]>> {
		switch (section) {
			case 'taskStatuses':
				return loaders.taskStatuses();
			case 'taskPriorities':
				return loaders.taskPriorities();
			case 'taskSizes':
				return loaders.taskSizes();
			case 'taskLabels':
				return loaders.taskLabels();
			case 'taskVersions':
				return loaders.taskVersions();
			case 'issueTypes':
				return loaders.issueTypes();
			case 'relatedIssueTypes':
				return loaders.relatedIssueTypes();
			default:
				return assertUnreachableSection(section);
		}
	}

	private async loadSynchronousSqliteSections(
		include: readonly TaskMetadataSection[],
		loaders: TaskMetadataLoaderMap
	): Promise<TaskMetadataEntry[]> {
		const entries: TaskMetadataEntry[] = [];

		for (const [index, section] of include.entries()) {
			entries.push([section, await this.loadSection(section, loaders)]);

			if (index < include.length - 1) {
				await new Promise<void>((resolve) => setImmediate(resolve));
			}
		}

		return entries;
	}
}
