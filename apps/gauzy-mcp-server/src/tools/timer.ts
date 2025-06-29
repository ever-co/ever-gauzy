import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiClient } from "../common/api-client.js";
import {
  TimeLogSourceEnum,
  TimeLogTypeEnum,
} from "../schema.js";

export const registerTimerTools = (server: McpServer) => {
  // Timer status tool
  server.tool(
    "timer_status",
    "Get the current timer status for an employee",
    {
      organizationId: z.string().describe("The organization ID"),
      tenantId: z.string().optional().describe("The tenant ID")
    },
    async ({ organizationId, tenantId }) => {
      try {
        const params = {
          organizationId,
          ...(tenantId && { tenantId })
        };

        const response = await apiClient.get("/api/timesheet/timer/status", { params });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error fetching timer status:", error);
        throw new Error("Failed to fetch timer status");
      }
    }
  );

  // Start timer tool
  server.tool(
    "start_timer",
    "Start a timer for an employee",
    {
      organizationId: z.string().describe("The organization ID for the timer"),
      tenantId: z.string().optional().describe("The tenant ID"),
      projectId: z.string().optional().describe("The project ID for the timer"),
      taskId: z.string().optional().describe("The task ID for the timer"),
      organizationContactId: z.string().optional().describe("The organization contact ID for the timer"),
      organizationTeamId: z.string().optional().describe("The organization team ID for the timer"),
      description: z.string().optional().describe("Description for the time entry"),
      logType: TimeLogTypeEnum.optional().describe("The type of time log"),
      source: TimeLogSourceEnum.optional().describe("The source of the timer"),
      tags: z.array(z.string()).optional().describe("Tags for the time entry"),
      isBillable: z.boolean().optional().describe("Whether the time is billable"),
      manualTimeSlot: z.boolean().optional().describe("Whether to use manual time slot"),
      version: z.string().optional().describe("Version information"),
      startedAt: z.string().optional().describe("The start time (ISO format)"),
    },
    async (params) => {
      try {
        // Convert string date to Date object if provided
        const startData = {
          ...params,
          startedAt: params.startedAt ? new Date(params.startedAt) : undefined,
          // Set default values if not provided
          logType: params.logType || "TRACKED",
          source: params.source || "BROWSER",
        };

        const response = await apiClient.post("/api/timesheet/timer/start", startData);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error starting timer:", error);
        throw new Error("Failed to start timer");
      }
    }
  );

  // Stop timer tool
  server.tool(
    "stop_timer",
    "Stop a running timer for an employee",
    {
      employeeId: z.string().describe("The employee ID for the timer"),
      organizationId: z.string().describe("The organization ID for the timer"),
      tenantId: z.string().optional().describe("The tenant ID"),
      source: TimeLogSourceEnum.optional().describe("The source of the timer"),
      stoppedAt: z.string().optional().describe("The stop time (ISO format)"),
      manualTimeSlot: z.boolean().optional().describe("Whether to use manual time slot"),
    },
    async (params) => {
      try {
        // Convert string date to Date object if provided
        const stopData = {
          ...params,
          stoppedAt: params.stoppedAt ? new Date(params.stoppedAt) : undefined,
          // Set default source if not provided
          source: params.source || "GAUZY_MCP",
        };

        const response = await apiClient.post("/api/timesheet/timer/stop", stopData);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error stopping timer:", error);
        throw new Error("Failed to stop timer");
      }
    }
  );
};
