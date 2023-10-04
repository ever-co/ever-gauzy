import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IGithubAppInstallInput extends IOAuthAppInstallInput {
    installation_id?: string;
    setup_action?: string;
    state?: string;
}

export interface IOAuthAppInstallInput extends IBasePerTenantAndOrganizationEntityModel {
    provider?: string;
    code?: string;
}

/** */
export interface IGithubRepository {
    id: string;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    [x: string]: any;
}

export interface IGithubIssue {
    id: string;
    node_id: string;
    number: string;
    title: string;
    state: string;
    [x: string]: any;
}

export interface IGithubRepositoryResponse {
    total_count: number;
    repository_selection: string;
    repositories: IGithubRepository[]
}

export enum GithubPropertyMapEnum {
    INSTALLATION_ID = 'installation_id',
    SETUP_ACTION = 'setup_action',
    ACCESS_TOKEN = 'access_token',
    EXPIRES_IN = 'expires_in',
    REFRESH_TOKEN = 'refresh_token',
    REFRESH_TOKEN_EXPIRES_IN = 'refresh_token_expires_in',
    TOKEN_TYPE = 'token_type'
}
