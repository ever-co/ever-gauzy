import { IDatabaseProvider } from "./i-database-provider";

export interface IClientServerProvider extends IDatabaseProvider {
    createDatabase(): Promise<void>;
}
