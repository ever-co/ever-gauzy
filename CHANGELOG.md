# Changelog for @gauzy

## [Unreleased]

This project consists of several apps, each with its own changelog:

### Core Packages

-   [@gauzy/auth](/packages/auth/CHANGELOG.md) — Authentication and user identity management
-   [@gauzy/common](/packages/common/CHANGELOG.md) — Shared logic and utilities across modules
-   [@gauzy/config](/packages/config/CHANGELOG.md) — Centralized app configuration
-   [@gauzy/constants](/packages/constants/CHANGELOG.md) — Global constants and enums
-   [@gauzy/contracts](/packages/contracts/CHANGELOG.md) — TypeScript interfaces and contracts

### Desktop

-   [@gauzy/desktop-core](/packages/desktop-core/CHANGELOG.md) — Core logic for desktop app
-   [@gauzy/desktop-lib](/packages/desktop-lib/CHANGELOG.md) — Desktop library for Electron
-   [@gauzy/desktop-ui-lib](/packages/desktop-ui-lib/CHANGELOG.md) — UI components for desktop app
-   [@gauzy/desktop-window](/packages/desktop-window/CHANGELOG.md) — Window management for desktop app

### Metrics & Utilities

-   [@gauzy/metrics](/packages/metrics/CHANGELOG.md) — Metrics collection and processing
-   [@gauzy/utils](/packages/utils/CHANGELOG.md) — Utility functions used throughout the codebase

### Plugins — Core

-   [@gauzy/plugin](/packages/plugin/CHANGELOG.md) — Base plugin system
-   [@gauzy/plugin-changelog](/packages/plugins/changelog/CHANGELOG.md) — Changelog management

### Plugins — Integrations

-   [@gauzy/plugin-integration-ai](/packages/plugins/integration-ai/CHANGELOG.md) — AI integration
-   [@gauzy/plugin-integration-hubstaff](/packages/plugins/integration-hubstaff/CHANGELOG.md) — Hubstaff integration
-   [@gauzy/plugin-integration-jira](/packages/plugins/integration-jira/CHANGELOG.md) — Jira integration
-   [@gauzy/plugin-integration-make-com](/packages/plugins/integration-make-com/CHANGELOG.md) — Make.com (Integromat) integration
-   [@gauzy/plugin-integration-upwork](/packages/plugins/integration-upwork/CHANGELOG.md) — Upwork integration
-   [@gauzy/plugin-integration-wakatime](/packages/plugins/integration-wakatime/CHANGELOG.md) — WakaTime integration

### Plugins — Analytics

-   [@gauzy/plugin-jitsu-analytics](/packages/plugins/jitsu-analytics/CHANGELOG.md) — Jitsu analytics integration
-   [@gauzy/plugin-posthog](/packages/plugins/posthog/CHANGELOG.md) — PostHog backend plugin
-   [@gauzy/plugin-posthog-ui](/packages/plugins/posthog-ui/CHANGELOG.md) — PostHog UI plugin

### Plugins — Job Features

-   [@gauzy/plugin-job-employee-ui](/packages/plugins/job-employee-ui/CHANGELOG.md) — Employee UI for job module
-   [@gauzy/plugin-job-matching-ui](/packages/plugins/job-matching-ui/CHANGELOG.md) — Job matching UI
-   [@gauzy/plugin-job-proposal](/packages/plugins/job-proposal/CHANGELOG.md) — Job proposal core
-   [@gauzy/plugin-job-proposal-ui](/packages/plugins/job-proposal-ui/CHANGELOG.md) — Job proposal UI
-   [@gauzy/plugin-job-search](/packages/plugins/job-search/CHANGELOG.md) — Job search core
-   [@gauzy/plugin-job-search-ui](/packages/plugins/job-search-ui/CHANGELOG.md) — Job search UI

### Plugins — Other Features

-   [@gauzy/plugin-knowledge-base](/packages/plugins/knowledge-base/CHANGELOG.md) — Knowledge base module
-   [@gauzy/plugin-legal-ui](/packages/plugins/legal-ui/CHANGELOG.md) — Legal and compliance UI
-   [@gauzy/plugin-maintenance-ui](/packages/plugins/maintenance-ui/CHANGELOG.md) — Maintenance tools UI
-   [@gauzy/plugin-onboarding-ui](/packages/plugins/onboarding-ui/CHANGELOG.md) — Onboarding UI
-   [@gauzy/plugin-product-reviews](/packages/plugins/product-reviews/CHANGELOG.md) — Product review module
-   [@gauzy/plugin-public-layout-ui](/packages/plugins/public-layout-ui/CHANGELOG.md) — Public layout components
-   [@gauzy/plugin-registry](/packages/plugins/registry/CHANGELOG.md) — Plugin registry and discovery
-   [@gauzy/plugin-videos](/packages/plugins/videos/CHANGELOG.md) — Video content backend
-   [@gauzy/plugin-videos-ui](/packages/plugins/videos-ui/CHANGELOG.md) — Video content frontend

### UI Libraries

-   [@gauzy/ui-auth](/packages/ui-auth/CHANGELOG.md) — UI components for authentication
-   [@gauzy/ui-config](/packages/ui-config/CHANGELOG.md) — UI configuration tools
-   [@gauzy/ui-core](/packages/ui-core/CHANGELOG.md) — Core UI library

## Changed in general

-   Updated CKEditor integration for enhanced security and compatibility.
-   Refactored several key components for improved reusability.
-   Additional UI/UX enhancements.
-   Fixed various bugs and improved overall application stability.
-   Extended invoicing functionality — invoices can now be issued per user to the company.
-   Introduced new metrics for better tracking and performance analysis.
-   Extended API to support new functionalities.
-   Implemented customization options for naming and logo.
