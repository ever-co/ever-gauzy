import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { OctokitService } from '@gauzy/integration-github';
import {
    IGithubIssue,
    IGithubIssueLabel,
    IGithubRepository,
    IGithubSyncIssuePayload,
    IIntegrationEntitySetting,
    IIntegrationEntitySettingTied,
    IIntegrationTenant,
    IOrganization,
    ITag,
    IntegrationEntity,
    TaskStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { arrayToObject } from 'core/utils';
import { IntegrationEntitySetting } from 'core/entities/internal';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { IntegrationMapSyncIssueCommand, IntegrationMapSyncLabelCommand } from 'integration-map/commands';
import { IntegrationMapService } from 'integration-map/integration-map.service';

@Injectable()
export class GithubSyncService {
    private readonly logger = new Logger('GithubSyncService');

    constructor(
        private readonly _commandBus: CommandBus,
        private readonly _octokitService: OctokitService,
        private readonly _integrationTenantService: IntegrationTenantService,
        private readonly _integrationMapService: IntegrationMapService
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
            const { organizationId, issues = [], repository } = input;
            const tenantId = RequestContext.currentTenantId() || input.tenantId;

            /**  */
            if (!input['projectId']) {
                /** */
                const repositoryIntegrationMap = await this._integrationMapService.getSyncedProjectByRepository({
                    entity: IntegrationEntity.PROJECT,
                    integrationId,
                    organizationId,
                    tenantId,
                    sourceId: (repository.id).toString()
                });
                input['projectId'] = repositoryIntegrationMap['gauzyId'];
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
                return await Promise.all(
                    entitySettings.map(async (entitySetting: IntegrationEntitySetting) => {
                        switch (entitySetting.entity) {
                            case IntegrationEntity.ISSUE:
                                /** Issues Sync */
                                const issueSetting: IIntegrationEntitySetting = entitySetting;
                                if (!!issueSetting.sync) {
                                    return await Promise.all(
                                        issues.map(
                                            async ({ sourceId, number, title, state, body }) => {
                                                let labels: ITag[] = [];
                                                /** */
                                                try {
                                                    // Check for label synchronization settings
                                                    const labelSetting: IIntegrationEntitySetting = entitySetting.tiedEntities.find(
                                                        ({ entity }: IIntegrationEntitySettingTied) => entity === IntegrationEntity.LABEL
                                                    );
                                                    if (!!labelSetting && labelSetting.sync) {
                                                        const issue_number = number;
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
                                                            number,
                                                            description: body,
                                                            status: state as TaskStatusEnum,
                                                            public: repository.visibility === 'private' ? false : true,
                                                            projectId: input['projectId'] || null,
                                                            organizationId,
                                                            tenantId,
                                                            tags: labels
                                                        },
                                                        sourceId,
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
                                        // To-Do need add system default labels
                                        // isSystem: label.default
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
}
