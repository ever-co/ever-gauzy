export interface IKeycloakConfig {
    readonly realm: string;
    readonly clientId: string;
    readonly secret: string;
    readonly authServerUrl: string;
    readonly cookieKey: string;
  }
  