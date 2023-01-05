import IUpdaterConfig from "./i-updater-config";

export interface IUpdaterConfigDigitalOcean extends IUpdaterConfig {
    prereleaseRepository: string;
}