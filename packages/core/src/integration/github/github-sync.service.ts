
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as moment from 'moment';
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
    IGithubIssueCreateOrUpdatePayload
} from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { IntegrationEntitySetting } from 'core/entities/internal';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { OrganizationProjectService } from 'organization-project/organization-project.service';
import { IntegrationMapSyncIssueCommand, IntegrationMapSyncLabelCommand } from 'integration-map/commands';
import { AutomationTaskSyncCommand } from 'tasks/commands';
import { AutomationLabelSyncCommand } from 'tags/commands';

@Injectable()
export class GithubSyncService {
    private readonly logger = new Logger('GithubSyncService');

    constructor(
        private readonly _commandBus: CommandBus,
        private readonly _octokitService: OctokitService,
        private readonly _integrationTenantService: IntegrationTenantService,
        private readonly _organizationProjectService: OrganizationProjectService
    ) { }

    /**
     * Synchronize GitHub issues and labels based on entity settings.
     *
     * @param integrationId - The ID of the integration tenant.
     * @param input - The payload containing information required for synchronization.
     * @throws {HttpException} Throws an HTTP exception if synchronization fails.
     */
    public async syncGithubIssuesAndLabels(
        integrationId: IIntegrationTenant['id'],
        input: IGithubSyncIssuePayload
    ): Promise<any[] | boolean> {
        try {
            const { organizationId, repository } = input;
            const tenantId = RequestContext.currentTenantId() || input.tenantId;
            const issues: IGithubIssue[] = Array.isArray(input.issues) ? input.issues : [input.issues];

            /**  */
            if (!input['projectId'] && repository) {
                try {
                    const project: IOrganizationProject = await this._organizationProjectService.findOneByWhereOptions({
                        organizationId,
                        tenantId,
                        repository: {
                            repositoryId: repository.id
                        }
                    });
                    input['projectId'] = project['id'] || null;
                } catch (error) {
                    input['projectId'] = null;
                }
            }

            // Retrieve integration settings tied to the specified organization
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
                // Synchronize data based on entity settings
                const promises = await Promise.all(
                    entitySettings.map(async (entitySetting: IntegrationEntitySetting) => {
                        switch (entitySetting.entity) {
                            case IntegrationEntity.ISSUE:
                                /** Issues Sync */
                                const issueSetting: IIntegrationEntitySetting = entitySetting;
                                if (!!issueSetting.sync) {
                                    return await Promise.all(
                                        issues.map(
                                            async ({ number: issue_number, title, state, body }) => {
                                                let labels: ITag[] = [];
                                                /** */
                                                try {
                                                    // Check for label synchronization settings
                                                    const labelSetting: IIntegrationEntitySetting = entitySetting.tiedEntities.find(
                                                        ({ entity }: IIntegrationEntitySettingTied) => entity === IntegrationEntity.LABEL
                                                    );
                                                    if (!!labelSetting && labelSetting.sync) {
                                                        /** Sync Github Issue Labels */
                                                        labels = await this.syncGithubLabelsByIssueNumber({
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
                                                /** */
                                                return await this._commandBus.execute(
                                                    new IntegrationMapSyncIssueCommand({
                                                        entity: {
                                                            title,
                                                            description: body,
                                                            status: state as TaskStatusEnum,
                                                            public: repository.visibility === 'private' ? false : true,
                                                            projectId: input['projectId'] || null,
                                                            organizationId,
                                                            tenantId,
                                                            tags: labels
                                                        },
                                                        sourceId: issue_number.toString(),
                                                        integrationId,
                                                        organizationId,
                                                        tenantId
                                                    })
                                                );
                                            }
                                        )
                                    );
                                }
                        }
                    })
                );

                // Update Integration Last Synced Date
                await this._integrationTenantService.update(integrationId, {
                    lastSyncedAt: moment()
                });

                return promises;
            } catch (error) {
                console.log('Error while syncing github issues: ', error.message);
                return false;
            }
        } catch (error) {
            // Handle errors gracefully, for example, log them
            this.logger.error('Error in syncGithubIssuesAndLabels', error.message);
            throw new HttpException({ message: 'GitHub synchronization failed', error }, HttpStatus.BAD_REQUEST);
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
                const labels = response.data;
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
            const projects: IOrganizationProject[] = await this._organizationProjectService.getProjectsByRepository(repository.id, {
                organizationId,
                tenantId,
                integrationId
            });

            /** Loop through the projects and synchronize issues */
            await Promise.all(
                projects.map(async (project: IOrganizationProject) => {
                    // Check if the issue should be synchronized for this project
                    if (!!this.shouldSyncIssue(project, issue)) {

                        const issues: IGithubIssue[] = this._mapIssuePayload(Array.isArray(issue) ? issue : [issue]);
                        const projectId = project.id;

                        const integrationId = integration.id;

                        // Synchronize data based on entity settings
                        await Promise.all(
                            entitySettings.map(async (entitySetting: IntegrationEntitySetting) => {
                                switch (entitySetting.entity) {
                                    case IntegrationEntity.ISSUE:
                                        /** Issues Sync */
                                        const issueSetting: IIntegrationEntitySetting = entitySetting;
                                        if (!!issueSetting.sync) {
                                            return await Promise.all(
                                                issues.map(async ({ sourceId, title, state, body, labels }) => {
                                                    // Initialize an array to store tags
                                                    let tags: ITag[] = [];

                                                    // Check for label synchronization settings
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

                                                    try {
                                                        // Synchronize the issue as a task
                                                        return await this._commandBus.execute(
                                                            new AutomationTaskSyncCommand({
                                                                entity: {
                                                                    title,
                                                                    description: body,
                                                                    status: state as TaskStatusEnum,
                                                                    public: repository.visibility === 'private' ? false : true,
                                                                    prefix: project ? project.name.substring(0, 3) : null,
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
                                                )
                                            );
                                        }
                                }
                            })
                        );
                    }
                })
            );
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
            return !!issue.labels.find(label => label.name === project.syncTag);
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
        return issues.map(({ number, title, state, body, labels }) => ({
            sourceId: number,
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
