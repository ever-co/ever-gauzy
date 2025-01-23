import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as moment from 'moment';
import * as chalk from 'chalk';
import { Request } from 'express';
import {
	IGithubAutomationIssuePayload,
	IGithubIssue,
	IGithubIssueLabel,
	IGithubSyncIssuePayload,
	IGithubInstallationDeletedPayload,
	IIntegrationEntitySetting,
	IIntegrationEntitySettingTied,
	IOrganizationProject,
	ITag,
	IntegrationEntity,
	TaskStatusEnum,
	IGithubIssueCreateOrUpdatePayload,
	IOrganizationGithubRepository,
	IIntegrationMap,
	GithubRepositoryStatusEnum,
	SYNC_TAG_GAUZY,
	SYNC_TAG_GITHUB,
	ID
} from '@gauzy/contracts';
import {
	AutomationLabelSyncCommand,
	AutomationTaskSyncCommand,
	IntegrationMapSyncIssueCommand,
	IntegrationMapSyncLabelCommand,
	IntegrationTenantService,
	OrganizationProjectService,
	RequestContext,
	arrayToObject
} from '@gauzy/core';
import { isNotEmpty, sleep } from '@gauzy/utils';
import { OctokitService } from '../probot/octokit.service';
import { GithubRepositoryService } from './repository/github-repository.service';
import { IntegrationSyncGithubRepositoryIssueCommand } from './repository/issue/commands';

@Injectable()
export class GithubSyncService {
	private readonly logger = new Logger('GithubSyncService');

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _octokitService: OctokitService,
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _organizationProjectService: OrganizationProjectService,
		private readonly _githubRepositoryService: GithubRepositoryService
	) {}

	/**
	 * Automatically synchronize GitHub issues with a repository.
	 *
	 * @param {ID} integrationId - The ID of the integration tenant.
	 * @param {IGithubSyncIssuePayload} input - The payload containing GitHub repository details and issues.
	 * @param {Request} request - The HTTP request object.
	 * @returns {Promise<boolean>} A Promise that indicates whether the synchronization was successful.
	 */
	public async autoSyncGithubIssues(
		integrationId: ID,
		input: IGithubSyncIssuePayload,
		request: Request
	): Promise<boolean> {
		// Check if the request contains integration settings
		const settings = request['integration']?.settings;
		if (!settings || !settings.installation_id) {
			throw new HttpException(
				'Invalid request parameter: Missing or unauthorized integration',
				HttpStatus.UNAUTHORIZED
			);
		}

		try {
			// Extract the 'repository' object from the input payload
			const repository: IOrganizationGithubRepository = input.repository;

			try {
				// Extract the 'installation_id' from the integration settings
				const installation_id = settings['installation_id'];

				// Extract repository details
				const { name: repo, owner } = repository;

				// Retrieve GitHub issues for the repository
				this.getRepositoryAllIssues(installation_id, owner, repo, (issues: IGithubIssue[]) => {
					console.log(chalk.magenta(`Automatically syncing ${issues.length} issues`));

					// Map the issues to the desired format using '_mapIssuePayload' method
					input.issues = this._mapIssuePayload(Array.isArray(issues) ? issues : [issues]);

					// Define a delay of 100 milliseconds
					const delay: number = 100;

					// Attempt to synchronize GitHub issues using the 'syncingGithubIssues' method
					this.syncingGithubIssues(
						integrationId,
						input,
						delay,
						async () => {
							// Update the status of the GitHub repository to "Success" (GithubRepositoryStatusEnum.SUCCESSFULLY).
							await this._githubRepositoryService.update(repository.id, {
								status: GithubRepositoryStatusEnum.SUCCESSFULLY
							});
						},
						async () => {
							// Handle the error by updating the status of the GitHub repository to "Error" (GithubRepositoryStatusEnum.ERROR).
							await this._githubRepositoryService.update(repository.id, {
								status: GithubRepositoryStatusEnum.ERROR
							});
						}
					);
				});

				return true; // Return true to indicate a successful synchronization.
			} catch (error) {
				console.log('Error while syncing github issues automatically: %s', error.message);
				// Handle the error by updating the status of the GitHub repository to "Error" (GithubRepositoryStatusEnum.ERROR).
				await this._githubRepositoryService.update(repository.id, {
					status: GithubRepositoryStatusEnum.ERROR
				});

				return false; // Return false to indicate that an error occurred during synchronization.
			}
		} catch (error) {
			// Handle errors gracefully, for example, log them
			this.logger.error('Error in sync github issues and labels automatically', error.message);
			throw new HttpException(
				{ message: 'GitHub automatic synchronization failed', error },
				HttpStatus.BAD_REQUEST
			);
		}
	}

	/**
	 * Manually synchronize GitHub issues with a repository.
	 *
	 * @param {ID} integrationId - The ID of the integration tenant.
	 * @param {IGithubSyncIssuePayload} input - The payload containing GitHub repository details and issues.
	 * @param {Request} request - The HTTP request object.
	 * @returns {Promise<boolean>} A Promise indicating whether the synchronization was successful.
	 */
	public async manualSyncGithubIssues(
		integrationId: ID,
		input: IGithubSyncIssuePayload,
		request: Request
	): Promise<boolean> {
		try {
			// Check if the request contains integration settings
			const settings = request['integration']?.settings;
			if (!settings || !settings.installation_id) {
				throw new HttpException(
					'Invalid request parameter: Missing or unauthorized integration',
					HttpStatus.UNAUTHORIZED
				);
			}

			// Extract the 'repository' object from the input payload
			const repository: IOrganizationGithubRepository = input.repository;

			try {
				// Set a delay of 0 milliseconds
				const delay: number = 0;

				// Attempt to synchronize GitHub issues using the syncGithubIssues method.
				await this.syncingGithubIssues(integrationId, input, delay);

				// Update the status of the GitHub repository to "Success" (GithubRepositoryStatusEnum.SUCCESSFULLY).
				await this._githubRepositoryService.update(repository.id, {
					status: GithubRepositoryStatusEnum.SUCCESSFULLY
				});

				return true; // Return true to indicate a successful synchronization.
			} catch (error) {
				// Handle the error by updating the status of the GitHub repository to "Error" (GithubRepositoryStatusEnum.ERROR).
				await this._githubRepositoryService.update(repository.id, {
					status: GithubRepositoryStatusEnum.ERROR
				});

				return false; // Return false to indicate that an error occurred during synchronization.
			}
		} catch (error) {
			// Handle errors gracefully, for example, log them
			this.logger.error('Error in sync GitHub issues and labels manually', error.message);

			// Throw an HTTP exception to indicate manual synchronization failure.
			throw new HttpException({ message: 'GitHub manual synchronization failed', error }, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Synchronize GitHub issues and labels based on entity settings.
	 *
	 * @param integrationId - The ID of the integration tenant.
	 * @param input - The payload containing information required for synchronization.
	 * @throws {HttpException} Throws an HTTP exception if synchronization fails.
	 */
	public async syncingGithubIssues(
		integrationId: ID,
		input: IGithubSyncIssuePayload,
		delay: number = 100,
		successCallback?: (success: boolean) => void,
		errorCallback?: (error: boolean) => void
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
									console.log(chalk.green(`Processing Issue Sync: %s`), issue.id);
									const { id, title, state, body } = issue;

									let tags: ITag[] = [];
									try {
										// Step 5: Label synchronization settings
										const labelSetting: IIntegrationEntitySetting = entitySetting.tiedEntities.find(
											({ entity }: IIntegrationEntitySettingTied) =>
												entity === IntegrationEntity.LABEL
										);
										if (!!labelSetting && labelSetting.sync) {
											// Step 6: Sync GitHub Issue Labels
											tags = await this.syncGithubLabelsByIssueNumber({
												organizationId,
												tenantId,
												integrationId,
												repository,
												issue
											});
										}
									} catch (error) {
										console.error(
											'Failed to fetch GitHub labels for the repository issue:',
											error.message
										);
									}

									// Step 7: Synchronized GitHub Repository Issue.
									const { repositoryId } = repository;
									await this._commandBus.execute(
										new IntegrationSyncGithubRepositoryIssueCommand(
											{
												tenantId,
												organizationId,
												integrationId
											},
											repositoryId,
											issue
										)
									);

									// Step 8: Execute a command to initiate the synchronization process
									const triggeredEvent = false;
									const integrationMap = await this._commandBus.execute(
										new IntegrationMapSyncIssueCommand(
											{
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
												sourceId: id.toString(),
												integrationId,
												organizationId,
												tenantId
											},
											triggeredEvent
										)
									);
									integrationMaps.push(integrationMap);

									/** 100ms Pause or Delay for sync new sync issue */
									await sleep(delay);
								}
							}
							break;
					}
				}

				// Step 9: Update Integration Last Synced Date
				await this._integrationTenantService.update(integrationId, {
					lastSyncedAt: moment().toDate()
				});

				// Call the success callback function if provided
				if (successCallback) {
					successCallback(true);
				}

				// Step 10: Return integration mapping
				return integrationMaps;
			} catch (error) {
				console.log('Error while syncing github issues: ', error.message);
				// Call the error callback function if provided
				if (errorCallback) {
					errorCallback(false);
				}

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
	 * @param organizationId - The ID of the organization.
	 * @param tenantId - The ID of the organization's tenant.
	 * @param integrationId - The ID of the GitHub integration.
	 * @param repository - Information about the GitHub repository for which labels are synchronized.
	 * @param issue - The GitHub issue for which labels are synchronized.
	 * @returns A promise that resolves to the result of the label synchronization process, which is an array of tags.
	 */
	private async syncGithubLabelsByIssueNumber({
		organizationId,
		tenantId,
		integrationId,
		repository,
		issue
	}: {
		organizationId: ID;
		tenantId: ID;
		integrationId: ID;
		repository: IOrganizationGithubRepository;
		issue: IGithubIssue;
	}): Promise<ITag[]> {
		try {
			// Retrieve integration settings
			const integration = await this._integrationTenantService.findOneByIdString(integrationId, {
				where: { isActive: true, isArchived: false },
				relations: { settings: true }
			});

			const settings = arrayToObject(integration.settings, 'settingsName', 'settingsValue');
			const { name: repo, owner } = repository;

			// Check for integration settings and installation ID
			if (settings && settings.installation_id) {
				const installation_id = settings.installation_id;

				// Get the labels associated with the GitHub issue
				let labels = issue.labels;

				// List of labels to check and create if missing
				const labelsToCheck = [SYNC_TAG_GITHUB, SYNC_TAG_GAUZY];
				const labelsToCreate = labelsToCheck.filter(
					(name) => !labels.find((label: IGithubIssueLabel) => label.name === name)
				);

				// Check if specific labels exist on a GitHub issue and create them if missing.
				if (isNotEmpty(labelsToCreate)) {
					try {
						const response = await this._octokitService.addLabelsForIssue(installation_id, {
							owner,
							repo,
							issue_number: issue.number,
							labels: labelsToCreate
						});
						labels = response.data;
					} catch (error) {
						console.log(chalk.red(`Error while creating missing labels with payload: %s`), error);
					}
				}

				// Sync labels and return an array of tags
				return await Promise.all(
					labels.map(async (label: IGithubIssueLabel) => {
						const { id: sourceId, name, color, description } = label;
						console.log(chalk.magenta(`Syncing GitHub Automation Issue Label: %s`), label);

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
					})
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
	public async syncAutomationIssue(input: IGithubAutomationIssuePayload) {
		const { integration, repository, issue } = input;
		const { entitySettings } = integration;

		try {
			/** Extract necessary data from integration */
			const { tenantId, organizationId, id: integrationId } = integration;

			/** Get a list of projects for the repository */
			const projects = await this._organizationProjectService.getProjectsByGithubRepository(repository.id, {
				organizationId,
				tenantId,
				integrationId
			});

			for await (const project of projects) {
				console.log(chalk.magenta(`Syncing GitHub Automation Issues for Project: %s`), project.name);
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
										const { id, title, state, body, labels = [] } = issue;

										// Initialize an array to store tags
										let tags: ITag[] = [];

										// Check for label synchronization settings
										try {
											const labelSetting = entitySetting.tiedEntities.find(
												({ entity }: IIntegrationEntitySettingTied) =>
													entity === IntegrationEntity.LABEL
											);

											if (!!labelSetting && labelSetting.sync) {
												/** Sync GitHub Issue Labels */
												tags = await Promise.all(
													labels.map(async (label: IGithubIssueLabel) => {
														const { id: labelId, name, color, description } = label;
														/** */
														return await this._commandBus.execute(
															new AutomationLabelSyncCommand(
																{
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
																},
																IntegrationEntity.LABEL
															)
														);
													})
												);
											}
										} catch (error) {
											console.error(
												'Failed to fetch GitHub labels for the repository issue:',
												error.message
											);
										}

										// Step 7: Synchronized GitHub repository issue.
										const repositoryId = repository.id;
										await this._commandBus.execute(
											new IntegrationSyncGithubRepositoryIssueCommand(
												{
													tenantId,
													organizationId,
													integrationId
												},
												repositoryId,
												issue
											)
										);

										try {
											// Synchronize the issue as a task
											return await this._commandBus.execute(
												new AutomationTaskSyncCommand(
													{
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
														sourceId: id.toString(),
														integrationId,
														integration,
														organizationId,
														tenantId
													},
													IntegrationEntity.ISSUE
												)
											);
										} catch (error) {
											this.logger.error(`Failed to sync automation github task: ${id}`, error);
										}
									}
								}
						}
					}
				}
			}
		} catch (error) {
			this.logger.error(
				`Failed to fetch repository: ${repository.id} integration with specific project too sync issue: ${issue.id}`,
				error
			);
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
			this.logger.error(
				`Failed to delete GitHub integration for installation: ${payload.installation?.id}`,
				error
			);
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
			id,
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
	public async createOrUpdateIssue(installationId: number, data: IGithubIssueCreateOrUpdatePayload): Promise<any> {
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
			throw new HttpException(
				`Error while creating/updating an issue in GitHub: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}

	/**
	 * Retrieves all issues from a GitHub repository using the GitHub API with pagination.
	 *
	 * @param installation_id - The installation ID for the GitHub App.
	 * @param owner - The owner (user or organization) of the GitHub repository.
	 * @param repo - The name of the GitHub repository.
	 * @returns A Promise that resolves to an array of GitHub issues.
	 */
	async getRepositoryAllIssues(
		installation_id: number,
		owner: string,
		repo: string,
		callback?: (issues: IGithubIssue[]) => void
	): Promise<IGithubIssue[]> {
		const per_page = 100; // Number of issues per page (GitHub API maximum is 100)
		const issues: IGithubIssue[] = [];
		let page = 1;
		let hasMoreIssues = true;

		// Use a while to simplify pagination
		while (hasMoreIssues) {
			try {
				// Fetch issues for the current page
				const response = await this._octokitService.getRepositoryIssues(installation_id, {
					owner,
					repo,
					page,
					per_page
				});
				if (Array.isArray(response.data) && response.data.length > 0) {
					// Append the retrieved issues to the result array
					issues.push(...response.data);
					// Check if there are more issues on the next page
					hasMoreIssues = response.data.length === per_page;
				} else {
					// No more issues to retrieve
					hasMoreIssues = false;
				}
				// Increment the page number for the next request
				page++;
			} catch (error) {
				console.error('Error fetching issues:', error);
				break; // Exit the loop on error
			}
		}

		// Call the callback function if provided
		if (callback) {
			callback(issues);
		}

		return issues;
	}
}
