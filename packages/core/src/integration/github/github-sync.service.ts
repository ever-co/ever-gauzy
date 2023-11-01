
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as moment from 'moment';
import { Request } from 'express';
import { OctokitService } from '@gauzy/integration-github';
import {
    IGithubAutomationIssuePayload,
    IGithubIssue,
    IGithubIssueLabel,
    IGithubRepository,
    IGithubSyncIssuePayload,
    IGithubInstallationDeletedPayload,
    IIntegrationEntitySetting,
    IIntegrationEntitySettingTied,
    IIntegrationTenant,
    IOrganization,
    IOrganizationProject,
    ITag,
    IntegrationEntity,
    TaskStatusEnum,
    IGithubIssueCreateOrUpdatePayload,
    IOrganizationGithubRepository,
    IIntegrationMap,
    GithubRepositoryStatusEnum,
    SYNC_TAG_GAUZY,
    SYNC_TAG_GITHUB
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { OrganizationProjectSettingUpdateCommand } from 'organization-project/commands';
import { OrganizationProjectService } from 'organization-project/organization-project.service';
import { IntegrationMapSyncIssueCommand, IntegrationMapSyncLabelCommand } from 'integration-map/commands';
import { AutomationTaskSyncCommand } from 'tasks/commands';
import { AutomationLabelSyncCommand } from 'tags/commands';
import { GithubRepositoryService } from './repository/github-repository.service';
import { IntegrationSyncGithubRepositoryCommand } from './commands';
import { IntegrationSyncGithubRepositoryIssueCommand } from './repository/issue/commands';

@Injectable()
export class GithubSyncService {
    private readonly logger = new Logger('GithubSyncService');

    constructor(
        private readonly _commandBus: CommandBus,
        private readonly _octokitService: OctokitService,
        private readonly _integrationTenantService: IntegrationTenantService,
        private readonly _organizationProjectService: OrganizationProjectService,
        private readonly _githubRepositoryService: GithubRepositoryService,
    ) { }

    /**
     * Initiates an automatic synchronization of GitHub issues.
     * @param integrationId - The unique identifier of the GitHub integration.
     * @param input - An object containing data needed for the synchronization.
     */
    public async autoSyncGithubIssues(
        integrationId: IIntegrationTenant['id'],
        input: IGithubSyncIssuePayload,
        request: Request
    ) {
        // Check if the request contains integration settings
        const settings = request['integration']?.settings;
        if (!settings || !settings.installation_id) {
            throw new HttpException('Invalid request parameter: Missing or unauthorized integration', HttpStatus.UNAUTHORIZED);
        }

        try {
            const hasSyncEnabled: boolean = true;
            input.repository['status'] = GithubRepositoryStatusEnum.SYNCING;

            /** */
            const repository: IOrganizationGithubRepository = await this._commandBus.execute(
                new IntegrationSyncGithubRepositoryCommand(
                    input,
                    hasSyncEnabled
                )
            );

            /** */
            await this._commandBus.execute(
                new OrganizationProjectSettingUpdateCommand(input.projectId, {
                    repositoryId: repository.id
                })
            );

            /** */
            const installation_id = settings['installation_id'];
            if (installation_id) {
                /** */
                const { name: repo, owner } = repository;
                const response = await this._octokitService.getRepositoryIssues(installation_id, { owner, repo });
                input['issues'] = response.data;
            }

            try {
                await this.syncGithubIssues(integrationId, input);
                await this._githubRepositoryService.update(repository.id, { status: GithubRepositoryStatusEnum.STOPPED });
                return true;
            } catch (error) {
                await this._githubRepositoryService.update(repository.id, { status: GithubRepositoryStatusEnum.ERROR });
                return false;
            }
        } catch (error) {
            // Handle errors gracefully, for example, log them
            this.logger.error('Error in sync github issues and labels automatically', error.message);
            throw new HttpException({ message: 'GitHub automatic synchronization failed', error }, HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Synchronize GitHub issues and labels based on entity settings.
     *
     * @param integrationId - The ID of the integration tenant.
     * @param input - The payload containing information required for synchronization.
     * @throws {HttpException} Throws an HTTP exception if synchronization fails.
     */
    public async syncGithubIssues(
        integrationId: IIntegrationTenant['id'],
        input: IGithubSyncIssuePayload
    ): Promise<IIntegrationMap[] | boolean> {
        try {
            const { organizationId, repository } = input;
            const tenantId = RequestContext.currentTenantId() || input.tenantId;
            const issues: IGithubIssue[] = Array.isArray(input.issues) ? input.issues : [input.issues];

            // Step 1: Retrieve integration settings tied to the specified organization
            const { entitySettings } = await this._integrationTenantService.findOneByIdString(integrationId, {
                where: {
                    tenantId,
                    organizationId,
                    isActive: true,
                    isArchived: false
                },
                relations: {
                    entitySettings: {
                        tiedEntities: true
                    }
                }
            });

            try {
                // Step 2: Initialize an array for integration mapping
                let integrationMaps: IIntegrationMap[] = [];

                // Step 3: Synchronize data based on entity settings
                for await (const entitySetting of entitySettings) {
                    switch (entitySetting.entity) {
                        case IntegrationEntity.ISSUE:
                            // Step 4: Issue synchronization
                            const issueSetting: IIntegrationEntitySetting = entitySetting;
                            if (!!issueSetting.sync) {
                                for await (const issue of issues) {
                                    const { sourceId, number: issue_number, title, state, body } = issue;

                                    let tags: ITag[] = [];
                                    try {
                                        // Step 5: Label synchronization settings
                                        const labelSetting: IIntegrationEntitySetting = entitySetting.tiedEntities.find(
                                            ({ entity }: IIntegrationEntitySettingTied) => entity === IntegrationEntity.LABEL
                                        );
                                        if (!!labelSetting && labelSetting.sync) {
                                            // Step 6: Sync GitHub Issue Labels
                                            tags = await this.syncGithubLabelsByIssueNumber({
                                                organizationId,
                                                tenantId,
                                                integrationId,
                                                repository,
                                                issue_number
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Failed to fetch GitHub labels for the repository issue:', error.message);
                                    }

                                    // Step 7:
                                    await this._commandBus.execute(
                                        new IntegrationSyncGithubRepositoryIssueCommand(
                                            {
                                                tenantId,
                                                organizationId,
                                                integrationId
                                            },
                                            repository,
                                            issue
                                        )
                                    );

                                    // Step 8: Execute a command to initiate the synchronization process
                                    const triggeredEvent = false;
                                    const integrationMap = await this._commandBus.execute(
                                        new IntegrationMapSyncIssueCommand({
                                            entity: {
                                                title,
                                                description: body,
                                                status: state as TaskStatusEnum,
                                                public: repository.private,
                                                projectId: input['projectId'] || null,
                                                tags,
                                                organizationId,
                                                tenantId
                                            },
                                            sourceId,
                                            integrationId,
                                            organizationId,
                                            tenantId
                                        }, triggeredEvent)
                                    );
                                    integrationMaps.push(integrationMap);
                                }
                            }
                            break;
                    }
                }

                // Step 9: Update Integration Last Synced Date
                await this._integrationTenantService.update(integrationId, {
                    lastSyncedAt: moment()
                });

                // Step 10: Return integration mapping
                return integrationMaps;
            } catch (error) {
                console.log('Error while syncing github issues: ', error.message);
                return false;
            }
        } catch (error) {
            // Handle errors gracefully, for example, log them
            this.logger.error('Error in sync github issues and labels manual', error.message);
            throw new HttpException({ message: 'GitHub manual synchronization failed', error }, HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Synchronize GitHub labels for a specific repository issue based on integration settings.
     *
     * @param integrationId - The ID of the GitHub integration.
     * @param repository - Information about the GitHub repository for which labels are synchronized.
     * @param issue_number - The issue number for which labels are to be synchronized.
     * @returns A promise that resolves to the result of the label synchronization process.
     */
    private async syncGithubLabelsByIssueNumber({
        organizationId,
        tenantId,
        integrationId,
        repository,
        issue_number
    }: {
        organizationId: IOrganization['id'],
        tenantId: IOrganization['tenantId'],
        integrationId: IIntegrationTenant['id'],
        repository: IGithubRepository,
        issue_number: IGithubIssue['number']
    }): Promise<ITag[]> {
        try {
            const integration = await this._integrationTenantService.findOneByIdString(integrationId, {
                where: {
                    isActive: true,
                    isArchived: false
                },
                relations: {
                    settings: true
                }
            });
            const settings = arrayToObject(integration.settings, 'settingsName', 'settingsValue');
            const { name: repo, owner } = repository;

            // Check for integration settings and installation ID
            if (settings && settings.installation_id) {
                const installation_id = settings.installation_id;
                /** Get Github Labels */
                const response = await this._octokitService.getLabelsByIssueNumber(installation_id, {
                    owner: owner.login,
                    repo,
                    issue_number
                });
                // Get the labels associated with the GitHub issue
                let labels = response.data;

                // List of labels to check and create if missing
                const labelsToCheck = [SYNC_TAG_GITHUB, SYNC_TAG_GAUZY];
                const labelsToCreate = labelsToCheck.filter(
                    (name) => !labels.find((label: IGithubIssueLabel) => label.name === name)
                );

                // Check if specific labels exist on a GitHub issue and create them if missing.
                if (isNotEmpty(labelsToCreate)) {
                    try {
                        const response = await this._octokitService.createLabelsForIssue(installation_id, {
                            owner: owner.login,
                            repo,
                            issue_number,
                            labels: labelsToCreate
                        });
                        labels = response.data;
                    } catch (error) {
                        console.log('Error while creating missing labels: ', error.message);
                    }
                }

                /** Sync Labels From Here */
                return await Promise.all(
                    await labels.map(
                        async (label: IGithubIssueLabel) => {
                            const { id: sourceId, name, color, description } = label;
                            /** */
                            return await this._commandBus.execute(
                                new IntegrationMapSyncLabelCommand({
                                    entity: {
                                        name,
                                        color,
                                        description,
                                        isSystem: label.default
                                    },
                                    sourceId: sourceId.toString(),
                                    integrationId,
                                    organizationId,
                                    tenantId
                                })
                            );
                        }
                    )
                );
            }
            return [];
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Failed to fetch GitHub labels for the repository issue', error.message);
            return [];
        }
    }

    /**
     * Syncs automation issues for a GitHub repository.
     *
     * @param integration - The GitHub integration settings.
     * @param input - The payload containing information for the synchronization.
     */
    public async syncAutomationIssue(
        input: IGithubAutomationIssuePayload
    ) {
        const { integration, repository, issue } = input;
        const { entitySettings } = integration;
        try {
            /** Extract necessary data from integration */
            const tenantId = integration['tenantId'];
            const organizationId = integration['organizationId'];
            const integrationId = integration['id'];

            /** Get a list of projects for the repository */
            const projects: IOrganizationProject[] = await this._organizationProjectService.getProjectsByGithubRepository(repository.id, {
                organizationId,
                tenantId,
                integrationId
            });

            for await (const project of projects) {
                // Check if the issue should be synchronized for this project
                if (!!this.shouldSyncIssue(project, issue)) {

                    const issues: IGithubIssue[] = this._mapIssuePayload(Array.isArray(issue) ? issue : [issue]);
                    const projectId = project.id;

                    // Synchronize data based on entity settings
                    for await (const entitySetting of entitySettings) {
                        switch (entitySetting.entity) {
                            case IntegrationEntity.ISSUE:
                                /** Issues Sync */
                                const issueSetting: IIntegrationEntitySetting = entitySetting;
                                if (!!issueSetting.sync) {
                                    for await (const issue of issues) {
                                        const { sourceId, title, state, body, labels = [] } = issue;

                                        // Initialize an array to store tags
                                        let tags: ITag[] = [];

                                        // // Check for label synchronization settings
                                        try {
                                            const labelSetting: IIntegrationEntitySetting = entitySetting.tiedEntities.find(
                                                ({ entity }: IIntegrationEntitySettingTied) => entity === IntegrationEntity.LABEL
                                            );
                                            if (!!labelSetting && labelSetting.sync) {
                                                /** Sync GitHub Issue Labels */
                                                tags = await Promise.all(
                                                    labels.map(
                                                        async (label: IGithubIssueLabel) => {
                                                            const { id: labelId, name, color, description } = label;
                                                            /** */
                                                            return await this._commandBus.execute(
                                                                new AutomationLabelSyncCommand({
                                                                    entity: {
                                                                        name,
                                                                        color,
                                                                        description,
                                                                        isSystem: label.default
                                                                    },
                                                                    sourceId: labelId.toString(),
                                                                    integrationId,
                                                                    organizationId,
                                                                    tenantId
                                                                }, IntegrationEntity.LABEL)
                                                            );
                                                        }
                                                    )
                                                );
                                            }
                                        } catch (error) {
                                            console.error('Failed to fetch GitHub labels for the repository issue:', error.message);
                                        }

                                        // Step 7: Synchronized GitHub repository issue.
                                        await this._commandBus.execute(
                                            new IntegrationSyncGithubRepositoryIssueCommand(
                                                {
                                                    tenantId,
                                                    organizationId,
                                                    integrationId
                                                },
                                                repository,
                                                issue
                                            )
                                        );

                                        try {
                                            // Synchronize the issue as a task
                                            return await this._commandBus.execute(
                                                new AutomationTaskSyncCommand({
                                                    entity: {
                                                        title,
                                                        description: body,
                                                        status: state as TaskStatusEnum,
                                                        public: repository.private,
                                                        prefix: project.name.substring(0, 3) || null,
                                                        projectId,
                                                        organizationId,
                                                        tenantId,
                                                        tags
                                                    },
                                                    sourceId,
                                                    integrationId,
                                                    integration,
                                                    organizationId,
                                                    tenantId
                                                }, IntegrationEntity.ISSUE)
                                            );
                                        } catch (error) {
                                            this.logger.error(`Failed to sync automation github task: ${sourceId}`, error);
                                        }
                                    }
                                }
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Failed to fetch repository: ${repository.id} integration with specific project too sync issue: ${issue.id}`, error);
        }
    }

    /**
     * Determines whether an issue should be synchronized based on project settings.
     *
     * @param project - The project configuration.
     * @param issue - The GitHub issue to be synchronized.
     * @returns A boolean indicating whether the issue should be synchronized.
     */
    private shouldSyncIssue(project: IOrganizationProject, issue: IGithubIssue): boolean {
        if (!project || !project.isTasksAutoSync) {
            return false;
        }
        if (project.isTasksAutoSyncOnLabel) {
            return !!issue.labels.find((label) => label.name.trim() === project.syncTag.trim());
        }
        return true;
    }

    /**
     * Deletes a GitHub installation and its associated integration.
     *
     * @param payload - An object containing the installation and its associated integration.
     */
    public async installationDeleted(payload: IGithubInstallationDeletedPayload) {
        try {
            // Extract the integration ID from the provided integration object
            const integrationId = payload.integration.id;
            // ToDo delete sync repository with specific project
            // const repositories = payload.repositories;

            // Delete the integration associated with the installation
            await this._integrationTenantService.delete(integrationId);
        } catch (error) {
            // Handle errors
            this.logger.error(`Failed to delete GitHub integration for installation: ${payload.installation?.id}`, error);
        }
    }

    /**
     * Map GitHub issue payload data to the required format.
     *
     * @param issues - An array of GitHub issues.
     * @returns An array of mapped issue payload data.
     */
    private _mapIssuePayload(issues: IGithubIssue[]): any[] {
        return issues.map(({ id, number, title, state, body, labels }) => ({
            sourceId: id,
            number,
            title,
            state,
            body,
            labels
        }));
    }

    /**
     * Create or Update a GitHub issue on a repository using the specified installation ID.
     *
     * @param installationId - The GitHub installation ID.
     * @param data - The data for the GitHub issue, including repo, owner, title, body, and labels.
     * @returns A promise that resolves to the response from GitHub.
     */
    public async createOrUpdateIssue(
        installationId: number,
        data: IGithubIssueCreateOrUpdatePayload
    ): Promise<any> {
        try {
            // Check if a valid installation ID is provided
            if (!installationId) {
                throw new HttpException('Invalid request parameter', HttpStatus.UNAUTHORIZED);
            }

            // Prepare the payload for opening or updating the issue
            const payload = {
                repo: data.repo,
                owner: data.owner,
                title: data.title,
                body: data.body,
                labels: data.labels
            };

            // Create or update the installation issue using the octokit service
            if (data.issue_number) {
                // Issue number is provided, update the existing issue
                const issue_number = data.issue_number;

                try {
                    // Check if the issue exists
                    await this._octokitService.getIssueByIssueNumber(installationId, {
                        repo: payload.repo,
                        owner: payload.owner,
                        issue_number: issue_number
                    });

                    // Issue exists, update it
                    const issue = await this._octokitService.updateIssue(installationId, issue_number, payload);
                    return issue.data;
                } catch (error) {
                    // Issue doesn't exist, create a new one
                    const issue = await this._octokitService.openIssue(installationId, payload);
                    return issue.data;
                }
            } else {
                // Issue number is not provided, create a new issue
                const issue = await this._octokitService.openIssue(installationId, payload);
                return issue.data;
            }
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while creating/updating an issue in GitHub', error.message);
            throw new HttpException(`Error while creating/updating an issue in GitHub: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
