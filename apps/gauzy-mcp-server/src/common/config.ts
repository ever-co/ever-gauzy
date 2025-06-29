import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface GauzyConfig {
  apiUrl: string;
  defaultTenantId: string;
  defaultOrganizationId: string;
}

export const config: GauzyConfig = {
  apiUrl: process.env.GAUZY_API_URL || "https://api.gauzy.co",
  defaultTenantId: process.env.GAUZY_DEFAULT_TENANT_ID || "",
  defaultOrganizationId: process.env.GAUZY_DEFAULT_ORGANIZATION_ID || "",
};