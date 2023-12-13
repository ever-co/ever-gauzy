import { IIntegrationTenant, IRelationalIntegrationTenant } from './integration.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalOrganizationProject } from './organization-projects.model';

export const SYNC_TAG_GITHUB = 'GitHub';
export const SYNC_TAG_GAUZY = 'Gauzy';

// Common input properties for GitHub app installation and OAuth app installation
interface IGithubAppInstallInputCommon extends IBasePerTenantAndOrganizationEntityModel {
    provider?: string;
}

// Input properties for GitHub app installation
export interface IGithubAppInstallInput extends IGithubAppInstallInputCommon {
    installation_id?: string;
    setup_action?: string;
    state?: string;
}

// Input properties for OAuth app installation
export interface IOAuthAppInstallInput extends IGithubAppInstallInputCommon {
    code?: string;
}


// Represents a GitHub repository
export interface IGithubRepository {
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    visibility: string;
    open_issues_count: number;
    owner?: {
        id: number;
        login: string;
        node_id: string;
    }
    [x: string]: any; // Additional properties
}

export interface IGithubIssueFindInput extends IBasePerTenantAndOrganizationEntityModel {
    page: number;
    per_page: number;
}

// Represents a GitHub issue
export interface IGithubIssue {
    id: number;
    node_id: string;
    number: number;
    title: string;
    state: string;
    body: string;
    labels: IGithubIssueLabel[];
    [x: string]: any; // Additional properties
}

// Represents a GitHub issue label
export interface IGithubIssueLabel {
    id: number;
    node_id: string;
    url: string;
    name: string;
    color: string;
    default: boolean;
    description: string;
    [x: string]: any; // Additional properties
}

export interface IGithubIssueCreateOrUpdatePayload {
    repo: string;
    owner: string;
    issue_number?: number;
    title: string;
    body: string;
    labels: Partial<IGithubIssueLabel[]>;
}

// Represents a GitHub installation
export interface IGithubInstallation {
    id: number;
    node_id: string;
}

// Response containing GitHub repositories
export interface IGithubRepositoryResponse {
    total_count: number;
    repository_selection: string;
    repositories: IGithubRepository[];
}

// Enum for GitHub property mapping
export enum GithubPropertyMapEnum {
    INSTALLATION_ID = 'installation_id',
    SETUP_ACTION = 'setup_action',
    ACCESS_TOKEN = 'access_token',
    EXPIRES_IN = 'expires_in',
    REFRESH_TOKEN = 'refresh_token',
    REFRESH_TOKEN_EXPIRES_IN = 'refresh_token_expires_in',
    TOKEN_TYPE = 'token_type',
    SYNC_TAG = 'sync_tag'
}

export interface IGithubSyncIssuePayload extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationProject {
    issues: IGithubIssue | IGithubIssue[];
    repository: IOrganizationGithubRepository;
}

/**
 * Represents a payload for GitHub issues, including organization and tenant information.
 */
export interface IGithubRepositoryPayload {
    repository: IGithubRepository;
}

/** */
export interface IGithubAutomationBase extends IGithubRepositoryPayload {
    integration: IIntegrationTenant;
}

export interface IGithubAutomationIssuePayload extends IGithubAutomationBase {
    issue: IGithubIssue;
}

export interface IGithubInstallationDeletedPayload extends Pick<IGithubAutomationBase, 'integration'> {
    installation: IGithubInstallation;
    repositories: IGithubRepository[];
}

export interface IOrganizationGithubRepository extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
    repositoryId: number;
    name: string;
    fullName: string;
    owner: string;
    issuesCount: number;
    hasSyncEnabled: boolean;
    private: boolean;
    status: string;
}

export interface IOrganizationGithubRepositoryUpdateInput extends Partial<IOrganizationGithubRepository> { }

export interface IOrganizationGithubRepositoryFindInput extends Partial<IOrganizationGithubRepository> { }

export interface IOrganizationGithubRepositoryIssue extends IBasePerTenantAndOrganizationEntityModel {
    issueId: number;
    issueNumber: number;
    /** Issue Sync With Repository */
    repository?: IOrganizationGithubRepository;
    repositoryId?: IOrganizationGithubRepository['id'];
}

export interface IIntegrationMapSyncRepository extends IBasePerTenantAndOrganizationEntityModel, IRelationalIntegrationTenant {
    repository: IGithubRepository;
}

export enum GithubRepositoryStatusEnum {
    SYNCING = 'Syncing',
    SUCCESSFULLY = 'Successfully',
    ERROR = 'Error',
    DISABLED = 'Disabled',
}
