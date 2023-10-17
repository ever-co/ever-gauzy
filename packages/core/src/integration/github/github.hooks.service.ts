import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Context } from 'probot';
import {
    GithubPropertyMapEnum,
    IGithubInstallation,
    IGithubIssue,
    IGithubRepository,
    IIntegrationSetting
} from '@gauzy/contracts';
import { IntegrationSettingGetCommand } from 'integration-setting/commands';
import { GithubSyncService } from './github-sync.service';

@Injectable()
export class GithubHooksService {

    private readonly logger = new Logger('GithubHooksService');

    constructor(
        private readonly _commandBus: CommandBus,
        private readonly _githubSyncService: GithubSyncService
    ) { }

    /**
     * Handles the 'issues.opened' event from GitHub, syncs automation issues and labels.
     *
     * @param context - The GitHub webhook event context.
     */
    async issuesOpened(context: Context) {
        try {
            const installation = context.payload['installation'] as IGithubInstallation;
            const issue = context.payload['issue'] as IGithubIssue;
            const repository = context.payload['repository'] as IGithubRepository;

            /** */
            await this.syncAutomationIssue({ installation, issue, repository });
        } catch (error) {
            this.logger.error('Failed to sync in issues and labels', error.message);
        }
    }

    /**
     * Handles the 'issues.edited' event from GitHub, syncs automation issues and labels.
     *
     * @param context - The GitHub webhook event context.
     */
    async issuesEdited(context: Context) {
        try {
            const installation = context.payload['installation'] as IGithubInstallation;
            const issue = context.payload['issue'] as IGithubIssue;
            const repository = context.payload['repository'] as IGithubRepository;

            /** */
            await this.syncAutomationIssue({ installation, issue, repository });
        } catch (error) {
            this.logger.error('Failed to sync in issues and labels', error.message);
        }
    }

    /**
     * Synchronizes automation issues for a GitHub installation.
     *
     * @param param0 - An object containing installation, issue, and repository information.
     */
    private async syncAutomationIssue({
        installation,
        issue,
        repository
    }: {
        installation: IGithubInstallation,
        issue: IGithubIssue,
        repository: IGithubRepository
    }): Promise<void> {
        try {
            const setting: IIntegrationSetting = await this.getInstallationSetting(installation);
            if (!!setting && !!setting.integration) {
                const integration = setting.integration;
                await this._githubSyncService.syncAutomationIssue({
                    integration,
                    issue,
                    repository
                });
            }
        } catch (error) {
            this.logger.error(`Failed to sync GitHub automation issue: ${installation?.id}`, error.message);
        }
    }

    /**
     * Retrieves integration settings associated with a specific GitHub installation.
     *
     * @param installation - The GitHub installation for which to retrieve settings.
     * @returns A promise that resolves to the integration setting or rejects with an error.
     */
    private async getInstallationSetting(
        installation: IGithubInstallation
    ): Promise<IIntegrationSetting> {
        try {
            const installation_id = installation.id;
            // Retrieve the integration setting associated with the GitHub installation.
            return await this._commandBus.execute(
                new IntegrationSettingGetCommand({
                    where: {
                        settingsName: GithubPropertyMapEnum.INSTALLATION_ID,
                        settingsValue: installation_id,
                        isActive: true,
                        isArchived: false,
                        integration: {
                            isActive: true,
                            isArchived: false,
                        }
                    },
                    relations: {
                        integration: {
                            settings: true,
                            entitySettings: {
                                tiedEntities: true
                            }
                        }
                    }
                })
            );
        } catch (error) {
            this.logger.error(`Failed to fetch GitHub installation setting: ${installation?.id}`, error.message);
        }
    }
}
