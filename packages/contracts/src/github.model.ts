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
