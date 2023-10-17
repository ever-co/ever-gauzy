import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Context } from 'probot';
import { GithubPropertyMapEnum, IGithubInstallation, IGithubIssue, IGithubRepository } from '@gauzy/contracts';
import { IntegrationSettingGetCommand } from 'integration-setting/commands';

@Injectable()
export class GithubHooksService {

    private readonly logger = new Logger('GithubHooksService');

    constructor(
        private readonly commandBus: CommandBus
    ) { }

    /**
     *
     * @param context
     */
    async issuesOpened(context: Context) {
    }

    /**
     *
     * @param context
     */
    async issuesEdited(context: Context) {
        const issue = context.payload['issue'] as IGithubIssue;
        const repository = context.payload['repository'] as IGithubRepository;
        const installation = context.payload['installation'] as IGithubInstallation;

        try {
            console.log(repository, issue);
            const installation_id = installation.id;
            const repository_id = repository.id;
            /**
             *
             */
            console.log({ installation_id, repository_id });
            const setting = await this.commandBus.execute(
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
            if (!!setting) {




                console.log({ setting });
            }
        } catch (error) {
            this.logger.error('Failed to sync in issues and labels', error.message);
        }
    }

    /**
     *
     */
    getInstallationSetting(installation) {

    }
}
