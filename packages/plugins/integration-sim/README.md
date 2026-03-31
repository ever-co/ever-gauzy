# SIM Integration Plugin

This plugin provides integration between Ever Gauzy and SIM (Sim Studio) AI workflow automation platform. It uses the SIM TypeScript SDK (authenticated via API key) to execute AI agent workflows programmatically.

## Overview

The SIM integration allows tenant-level management of SIM AI workflows from your NestJS application. It provides:

- **Integration Setup** — Configure SIM API key and base URL per tenant
- **Workflow Execution** — Execute SIM workflows synchronously or asynchronously with retry support
- **Job Status Polling** — Check the status of async workflow executions
- **Workflow Validation** — Verify a workflow is deployed and ready for execution
- **Execution History** — View paginated execution logs with filtering by workflow ID and status
- **Event-Driven Triggers** — Trigger SIM workflows from internal Gauzy domain events

All API calls are authenticated using a SIM API key (per-tenant or global fallback via `GAUZY_SIM_API_KEY`).

## Building

Run `yarn nx build plugin-integration-sim` to build the library.

## Running unit tests

Run `yarn nx test plugin-integration-sim` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-integration-sim`, go to the dist folder `cd dist/packages/plugins/integration-sim` and run `npm publish`.

## Installation

Install the Integration SIM Plugin using your preferred package manager:

```shell
npm install @gauzy/plugin-integration-sim
# or
yarn add @gauzy/plugin-integration-sim
```
