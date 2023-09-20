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
