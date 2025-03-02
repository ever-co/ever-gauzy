# Ever Gauzy Platform

[uri_gauzy]: https://gauzy.co
[uri_license]: https://www.gnu.org/licenses/agpl-3.0.html
[uri_license_image]: https://img.shields.io/badge/License-AGPL%20v3-blue.svg

![visitors](https://visitor-badge.laobi.icu/badge?page_id=ever-co.gauzy-platform)
[![License: AGPL v3][uri_license_image]][uri_license]
[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/ever-co/ever-gauzy)

## 💡 What's New

We released [Ever Teams](https://github.com/ever-co/ever-teams) platform for Work & Project Management.
Please check <https://github.com/ever-co/ever-teams> and make it ⭐ on GitHub!
It's built with a React (NextJs) / ReactNative (Expo) stack and connects to headless [Ever Gauzy Platform APIs](https://api.gauzy.co/swg).

## 🌟 What is it

[Ever® Gauzy™][uri_gauzy] - **Open Business Management Platform** for Collaborative, On-Demand and Sharing Economies.

-   **Enterprise Resource Planning** (ERP)
-   **Customer Relationship Management** (CRM)
-   **Human Resource Management** (HRM)
-   **Applicant Tracking System** (ATS)
-   **Work and Project Management** (PM)
-   **Employee Time-Tracking, Activity & Productivity Tracking**

![overview](https://docs.gauzy.co/overview.png)

Ever® Gauzy™ Platform is a part of our larger Open Platform for **Collaborative, On-Demand and Sharing Economies** - [Ever® Platform™](https://ever.co).

## ✨ Features

Main features:

-   Human Resources Management (HRM) with Time Management / Tracking and Employees Performance Monitoring
-   Customer Relationship Management (CRM)
-   Enterprise Resource Planning (ERP)
-   Projects / Tasks Management
-   Sales Management
-   Financial and Cost Management (including _Accounting_, _Invoicing_, etc)
-   Inventory, Supply Chain Management, and Production Management

A more detailed list of the features available in the platform:

-   [Headless APIs](https://api.gauzy.co/swg)
-   Dashboard (provides an overview of different metrics, such as company income/expenses, employee bonuses, etc.)
-   Time Management / Time Tracking / Activity Tracking / Timesheets
-   Employees Management (register of company employees/contractors, rates of employees, etc.)
-   Employee Onboarding
-   Applicant Tracking System (ATS) / Candidates Interviews
-   Contacts Management (Clients / Customers / Leads / etc.)
-   Schedules / Appointments / Events
-   Project Management / Tasks
-   Goals / KPI / Objectives / Key Results
-   Sales Pipelines
-   Proposals
-   Accounting / Invoicing / Estimates
-   Billing
-   Payments
-   Income / Expenses Management
-   Time Off Management / Holidays / Approvals
-   Inventory
-   Equipment / Sharing
-   Multiple Organizations Management
-   Organization Departments and Teams
-   Organization Clients and Vendors
-   Help Center / Knowledge Base
-   Tags / Labels
-   Reports / Insights / Analytics
-   Organization and Employee Public Pages
-   Integrations (Upwork, HubStaff, etc.)
-   Email History / Email Templates
-   Data Import / Export
-   Roles / Permissions
-   Multi-currency
-   Multi-lingual
-   Dark / Light / Corporate / Material and other Themes

Read more [about Gauzy](https://github.com/ever-co/ever-gauzy/wiki/About-Gauzy) and [how to use it](https://github.com/ever-co/ever-gauzy/wiki/How-to-use-Gauzy) at your company, on-demand business, freelance business, agency, studio or in-house teams.

## 🌼 Screenshots

<details>
<summary>Show / Hide Screenshots</summary>

### Web UI

![overview](https://docs.gauzy.co/overview.png)

### Desktop Timer UI (Standard)

![timer](https://docs.gauzy.co/desktop/desktop-timer-small.png)

### Desktop Timer UI (Expanded)

![timer](https://docs.gauzy.co/desktop/desktop-timer-expanded.png)

</details>

## 🔗 Links

-   **<https://gauzy.co>** - check more information about the platform at the official website.
-   **<https://app.gauzy.co>** - SaaS (Important: it's currently in Alpha version/testing mode, please use it cautiously).
-   **<https://demo.gauzy.co>** - Online Demo (see more info below).
-   **<https://gauzy.co/downloads>** - Download Platform & Apps (see also more info below about available downloads).
-   **<https://docs.gauzy.co>** - Platform Documentation (WIP). See also our [Wiki](https://github.com/ever-co/ever-gauzy/wiki).
-   **<https://ever.co>** - get more information about our company products.

## 📊 Activity

![Alt](https://repobeats.axiom.co/api/embed/7c6f6c3bf56fd91647549cf4ae70af49ed5ee106.svg 'Repobeats analytics image')

## 💻 Demo, Downloads, Testing and Production

### Demo

Ever Gauzy Platform Demo at <https://demo.gauzy.co>.

Notes:

-   Default super-admin user login is `admin@ever.co` and the password is `admin`
-   Content of demo DB resets on each deployment to the demo environment (usually daily)
-   Demo environment deployed using CI/CD from the `develop` branch

### Downloads

You can download Gauzy Platform, Gauzy Server, or Desktop Apps (Windows/Mac/Linux) from the official [Downloads](https://web.gauzy.co/downloads) page.

In addition, all downloads are also available from the following pages:

-   [Platform Releases](https://github.com/ever-co/ever-gauzy/releases)
-   [Server Releases](https://github.com/ever-co/ever-gauzy-server/releases)
-   [Desktop App Releases](https://github.com/ever-co/ever-gauzy-desktop/releases)
-   [Desktop Timer App Releases](https://github.com/ever-co/ever-gauzy-desktop-timer/releases)

### Production (SaaS)

Ever® Gauzy™ Platform SaaS is available at <https://app.gauzy.co>.

Note: it's currently in Alpha version/testing mode, please use it cautiously!

### Staging

-   Gauzy Platform Staging builds (using CI/CD, from the `stage` branch) are available at <https://stage.gauzy.co>
-   We are using the Staging environment to test releases before they are deployed to the production environment
-   Our pre-releases of desktop/server apps are built from this environment and can be configured manually (in settings) to connect to Stage API: <https://apistage.gauzy.co>

### Server & Desktop Apps

We have Gauzy Server and two Desktop Apps (for Windows/Mac/Linux):

-   Ever® Gauzy™ Server - includes Gauzy API, SQLite DB (or connects to external PostgreSQL) and serves Guazy frontend. It allows to quickly run Gauzy Server for multiple clients (browser-based or Desktop-based). It's a recommended option if you want to setup the Ever Gauzy Platform in small to medium organizations.

-   Ever® Gauzy™ Desktop App - includes Gauzy frontend (UI), Gauzy API, SQLite DB, etc., all-in-one! It allows to quickly run the whole Gauzy solution locally, both UI and Timer (for time tracking, optionally of course). In addition, it allows you to connect to the external database (e.g. PostgreSQL) or external API (if you have Gauzy Server with API / DB installed on a different computer or if you want to connect to our live API). It's a recommended option if you want to try Gauzy quickly / for personal use or if you want to connect to Gauzy Server in the "client-server" configuration (and use Desktop App instead of web browser).

-   Ever® Gauzy™ Desktop Timer App - allows running Time and Activity Tracking for employees/contractors with screenshots and activity monitoring. It is recommended to setup by organization employees as long as they are not interested in other Gauzy Platform features (e.g. accounting) and only need to track work time.

More information about our Server & Desktop Apps:

-   Download for your OS from the official [Downloads](https://web.gauzy.co/downloads) page or see the section "Download" above for other links to our releases pages.
-   Setup Gauzy Server with default choices in Setup Wizard and run it.
-   You can also setup Gauzy Desktop App (can run independently or connect to Gauzy Server) or Gauzy Desktop Timer App (should be connected to Gauzy Server)
-   You can login with `admin@ever.co` and password `admin` to check Admin functionality if you installed Gauzy Server or Gauzy Desktop App. Note: such an Admin user is not an employee, so you will not be able to track time.
-   You can login with `employee@ever.co` and password `123456` to check Employee-related functionality in Gauzy UI or to run Desktop Timer from an "Employee" perspective (such a user is an Employee and can track time).
-   If you install Gauzy Server, it is possible to connect to it using a browser (by default on <http://localhost:4200>) or using Gauzy Desktop Apps (make sure to configure Desktop apps to connect to Gauzy API on <http://127.0.0.1:3000/api> because it's where Gauzy Server API runs by default).
-   You can read more information about our Desktop Apps on the [Desktop Apps Wiki Page](https://github.com/ever-co/ever-gauzy/wiki/Gauzy-Desktop-Apps) and our Server at the [Server Wiki Page](https://github.com/ever-co/ever-gauzy/wiki/Gauzy-Server).

## 🧱 Technology Stack and Requirements

-   [TypeScript](https://www.typescriptlang.org)
-   [NodeJs](https://nodejs.org) / [NestJs](https://github.com/nestjs/nest)
-   [Nx](https://nx.dev) / [Lerna](https://github.com/lerna/lerna)
-   [Angular](https://angular.io) / [RxJS](http://reactivex.io/rxjs) / [Ngx-admin](https://github.com/akveo/ngx-admin)
-   [TypeORM](https://github.com/typeorm/typeorm) / [MikroORM](https://github.com/mikro-orm/mikro-orm) / [Knex](https://github.com/knex/knex)

For Production, we recommend:

-   [PostgreSQL](https://www.postgresql.org) or [MySQL](https://dev.mysql.com)
-   [Kubernetes](https://kubernetes.io), [Docker](https://www.docker.com)

Note: thanks to TypeORM / MikroORM, Gauzy will support lots of DBs: SQLite (default, for demos), PostgreSQL (development/production), MySql (development/production), MariaDb, CockroachDb, MS SQL, Oracle, MongoDb, and others (with minimal changes).

#### See also README.md and CREDITS.md files in relevant folders for lists of libraries and software included in the Platform, information about licenses, and other details

## 📄 Documentation

Please refer to our official [Platform Documentation](https://docs.gauzy.co) and our [Wiki](https://github.com/ever-co/ever-gauzy/wiki) (WIP).

## 🚀 Quick Start

### With Docker Compose

-   Clone repo.
-   Make sure you have the latest Docker Compose [installed locally](https://docs.docker.com/compose/install). Important: you need a minimum [v2.20](https://docs.docker.com/compose/release-notes/#2200).
-   Run `docker-compose -f docker-compose.demo.yml up`, if you want to run the platform in basic configuration (e.g. for Demo / explore functionality / quick run) using our prebuilt Docker images. Check `.env.demo.compose` file for different settings (optionally), e.g. DB type. _(Note: Docker Compose will use latest images pre-build automatically from head of `master` branch using GitHub CI/CD.)_
-   Run `docker-compose up`, if you want to run the platform in production configuration using our prebuilt Docker images. Check `.env.compose` file for different settings (optionally), e.g. DB type. _(Note: Docker Compose will use latest images pre-build automatically from head of `master` branch using GitHub CI/CD.)_
-   Run `docker-compose -f docker-compose.build.yml up`, if you want to build everything (code and Docker images) locally. Check `.env.compose` file for different settings (optionally), e.g. DB type. _(Note: this is extremely long process because it builds whole platform locally. Other options above are much faster!)_
-   :coffee: time... It might take some time for our API to seed fake data in the DB during the first Docker Compose run, even if you used prebuilt Docker images.
-   Open <http://localhost:4200> in your browser.
-   Login with email `admin@ever.co` and password: `admin` for Super Admin user.
-   Login with email `employee@ever.co` and password: `123456` for Employee user.
-   Enjoy!

Notes:

-   while demo `docker-compose.demo.yml` runs a minimum amount of containers (API, Web UI, and DB), other Docker Compose files run multiple infrastructure dependencies (see full list below).
-   you can also run ONLY infra dependencies (without our API / Web containers) with `docker-compose -f docker-compose.infra.yml up` command. We already doing it using `include` in our main docker compose files.

Together with Gauzy, Docker Compose (i.e. `docker-compose.yml` and `docker-compose.build.yml`, not Demo `docker-compose.demo.yml`) will run the following:

-   [PostgreSQL](https://www.postgresql.org) - Primary Database.
-   [Pgweb](https://github.com/sosedoff/pgweb) - Cross-platform client for PostgreSQL DBs, available on <http://localhost:8081>.
-   [OpenSearch](https://github.com/opensearch-project) - Search Engine.
-   [OpenSearch Dashboards](https://github.com/opensearch-project) - Search Engine Dashboards, available on <http://localhost:5601>. Default username: `admin` and password: `Gauzy_password_123`
-   [Dejavu](https://github.com/appbaseio/dejavu) - Web UI for OpenSearch, available on <http://localhost:1358>.
-   [MinIO](https://github.com/minio/minio) - Multi-Cloud ☁️ Object Storage (AWS S3 compatible).
-   [Jitsu](https://github.com/jitsucom/jitsu) - Jitsu is an open-source Segment alternative (data ingestion engine).
-   [Redis](https://github.com/redis/redis) - In-memory data store/caching (also used by Jitsu)
-   [Cube](https://github.com/cube-js/cube) - "Semantic Layer" used for Reports, Dashboards, Analytics, and other BI-related features, with UI available on <http://localhost:4000>.
-   [Zipkin](https://github.com/openzipkin/zipkin) - distributed tracing system.

### Manually

#### Required

-   Install [NodeJs](https://nodejs.org/en/download) LTS version or later, e.g. 18.x.
-   Install [Yarn](https://github.com/yarnpkg/yarn) (if you don't have it) with `npm i -g yarn`.
-   Install NPM packages and Bootstrap solution using the command `yarn bootstrap`.
-   If you will need to make code changes (and push to Git repo), please run `yarn prepare:husky`.
-   Adjust settings in the [`.env.local`](https://github.com/ever-co/ever-gauzy/blob/develop/.env.local) which is used in local runs.
-   Alternatively, you can copy [`.env.sample`](https://github.com/ever-co/ever-gauzy/blob/develop/.env.sample) to `.env` and change default settings there, e.g. database type, name, user, password, etc.
-   Run both API and UI with a single command: `yarn start`.
-   Open Gauzy UI on <http://localhost:4200> in your browser (API runs on <http://localhost:3000/api>).
-   Login with email `admin@ever.co` and password: `admin` for Super Admin user.
-   Login with email `employee@ever.co` and password: `123456` for Employee user.
-   Enjoy!

Notes:

-   during the first API start, DB will be automatically seeded with a minimum set of initial data if no users are found.
-   you can run seed any moment manually (e.g. if you changed entities schemas) with the `yarn seed` command to re-initialize DB (warning: unsafe for production!).
-   it is possible to run generation of extremely large amounts of fake data for demo purposes/testing with `yarn seed:all` (warning: takes ~10 min to complete)

#### Optional / Recommended for Production

-   Optionally (recommended for production) install and run [PostgreSQL](https://www.postgresql.org) version 14 or later (16.x recommended for production). Note: other DB can be configured manually in TypeORM / MikroORM / Knex. The default DB is set to SQLite (recommended for testing/demo purposes only).
-   Optionally (recommended for production) install and run [Redis](https://github.com/redis/redis). Notes: the platform will work without Redis using an in-memory caching strategy instead of a distributed one (recommended for testing/demo purposes only). Please note however that Redis is required for Jitsu.
-   Optionally (recommended for production) install and run [OpenSearch](https://github.com/opensearch-project). Note: the platform will work without OpenSearch using DB build-in search capabilities (recommended for testing/demo purposes only).
-   Optionally install and run [MinIO](https://github.com/minio/minio) or [LocalStack](https://github.com/localstack/localstack). Note: the platform will work without MinIO / LocalStack or other S3-compatible storage using local filesystem-based storage (recommended for testing/demo purposes only). For production, we recommend using Wasabi or AWS S3 storage or another S3-compatible cloud storage.
-   Optionally (recommended for production) install and run [Jitsu](https://github.com/jitsucom/jitsu). Note: the platform will work without Jitsu, however, data ingestion will be disabled for additional analyses / real-time pipelines.
-   Optionally (recommended for production) install and run [Cube](https://github.com/cube-js/cube). Note: the platform will work without Cube, however some advanced (dynamic) reporting and data processing capabilities will be disabled.

### Production

#### General information

-   See [Setup Gauzy for Client Server](https://github.com/ever-co/ever-gauzy/wiki/Setup-Gauzy-for-Client-Server) for more information about production setup on your servers.

#### Kubernetes

-   We recommend deploying to Kubernetes (k8s), either manually (see below) or with our [Terraform Modules](https://github.com/ever-co/ever-gauzy-terraform) or [Ever Helm Charts](https://github.com/ever-co/ever-charts).
-   For more simple deployment scenarios with k8s, please see [Kubernetes configurations](https://github.com/ever-co/ever-gauzy/tree/develop/.deploy/k8s), which we are using to deploy Gauzy into [DigitalOcean k8s cluster](https://www.digitalocean.com/products/kubernetes).

#### DigitalOcean App Platform

-   For the most simple deployment scenarios (e.g. for yourself or your small organization), check our [DigitalOcean App Platform configurations](https://github.com/ever-co/ever-gauzy/tree/develop/.do) and corresponding [GitHub Action](https://github.com/ever-co/ever-gauzy/blob/develop/.github/workflows/deploy-do-app-platform-stage.yml).

#### Virtual Instances / Droplets (via SSH)

-   Another variant to deploy Gauzy is to use DigitalOcean Droplets or any other virtual instance (with Ubuntu OS) and deploy using SCP/SSH, for example, following [GitHub Action](https://github.com/ever-co/ever-gauzy/blob/develop/.github/workflows/deploy-do-droplet-demo.yml)

#### Pulumi

-   In addition, check [Gauzy Pulumi](https://github.com/ever-co/ever-gauzy-pulumi) project (WIP), it makes complex Clouds deployments possible with a single command (`pulumi up`). Note: it currently supports AWS EKS (Kubernetes) for development and production with Application Load Balancers and AWS RDS Serverless PostgreSQL DB deployments. We also implemented deployments to ECS EC2 and Fargate Clusters in the same Pulumi project.

## 💌 Contact Us

-   [Ever.co Website Contact Us page](https://ever.co/contacts)
-   [Slack Community](https://join.slack.com/t/gauzy/shared_invite/enQtNzc5MTA5MDUwODg2LTI0MGEwYTlmNWFlNzQzMzBlOWExNTk0NzAyY2IwYWYwMzZjMTliYjMwNDI3NTJmYmM4MDQ4NDliMDNiNDY1NWU)
-   [Discord Chat](https://discord.gg/hKQfn4j)
-   [![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/gauzy)
-   [![Gitter](https://badges.gitter.im/JoinChat.svg)](https://gitter.im/ever-co/ever-gauzy?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
-   [![Get help on Codementor](https://cdn.codementor.io/badges/get_help_github.svg)](https://www.codementor.io/evereq?utm_source=github&utm_medium=button&utm_term=evereq&utm_campaign=github)
-   For business inquiries: <mailto:gauzy@ever.co>
-   Please report security vulnerabilities to <mailto:security@ever.co>
-   [Gauzy Platform @ Twitter](https://twitter.com/gauzyplatform)
-   [Gauzy Platform @ Facebook](https://www.facebook.com/gauzyplatform)

## 🔐 Security

Ever® Gauzy™ follows good security practices, but 100% security cannot be guaranteed in any software!
Ever® Gauzy™ is provided AS IS without any warranty. Use at your own risk!
See more details in the [LICENSE](LICENSE.md).

In a production setup, all client-side to server-side (backend, APIs) communications should be encrypted using HTTPS/WSS/SSL (REST APIs, GraphQL endpoint, Socket.io WebSockets, etc.).

If you discover any issue regarding security, please disclose the information responsibly by sending an email to <mailto:security@ever.co> or on [![huntr](https://cdn.huntr.dev/huntr_security_badge_mono.svg)](https://huntr.dev) and not by creating a GitHub issue.

## 🛡️ License

We support the open-source community. If you're building awesome non-profit/open-source projects, we're happy to help and will provide (subject to [acceptance criteria](https://github.com/ever-co/ever-gauzy/wiki/Free-license-and-hosting-for-Non-profit-and-Open-Source-projects)) Ever Gauzy Enterprise edition license and free hosting option! Feel free to contact us at <mailto:ever@ever.co> to make a request. More details are explained in our [Wiki](https://github.com/ever-co/ever-gauzy/wiki/Free-license-and-hosting-for-Non-profit-and-Open-Source-projects).

This software is available under the following licenses:

-   [Ever® Gauzy™ Platform Community Edition](https://github.com/ever-co/ever-gauzy/blob/master/LICENSE.md#gauzy-platform-community-edition-license)
-   [Ever® Gauzy™ Platform Small Business](https://github.com/ever-co/ever-gauzy/blob/master/LICENSE.md#gauzy-platform-small-business-license)
-   [Ever® Gauzy™ Platform Enterprise](https://github.com/ever-co/ever-gauzy/blob/master/LICENSE.md#gauzy-platform-enterprise-license)

#### The default Ever® Gauzy™ Platform license, without a valid Ever® Gauzy™ Platform Enterprise or Ever® Gauzy™ Platform Small Business License agreement, is the Ever® Gauzy™ Platform Community Edition License

#### Please see [LICENSE](LICENSE.md) for more information on licenses. You can also [compare our offering](https://ever.co/compare-gauzy/#compare)

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fgauzy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_large)

## ™️ Trademarks

**Ever**® is a registered trademark of [Ever Co. LTD](https://ever.co).
**Ever® Demand™**, **Ever® Gauzy™**, **Ever® Teams™**, **Ever® Recu™**, **Ever® Clokr™** and **Ever® OpenSaaS™** are all trademarks of [Ever Co. LTD](https://ever.co).

The trademarks may only be used with the written permission of Ever Co. LTD. and may not be used to promote or otherwise market competitive products or services.

All other brand and product names are trademarks, registered trademarks, or service marks of their respective holders.

## 🍺 Contribute

-   Please give us :star: on Github, it **helps**!
-   You are more than welcome to submit feature requests in the [separate repo](https://github.com/ever-co/feature-requests/issues)
-   Pull requests are always welcome! Please base pull requests against the _develop_ branch and follow the [contributing guide](.github/CONTRIBUTING.md).

## 💪 Thanks to our Contributors

See our contributors list in [CONTRIBUTORS.md](https://github.com/ever-co/ever-gauzy/blob/develop/.github/CONTRIBUTORS.md).
You can also view a full list of our [contributors tracked by Github](https://github.com/ever-co/ever-gauzy/graphs/contributors).

<img src="https://contributors-img.web.app/image?repo=ever-co/ever-gauzy" />

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ever-co/ever-gauzy&type=Date)](https://star-history.com/#ever-co/ever-gauzy&Date)

## ❤️ Powered By

<p>
  <a href="https://www.digitalocean.com/?utm_medium=opensource&utm_source=ever-co">
    <img src="https://opensource.nyc3.cdn.digitaloceanspaces.com/attribution/assets/PoweredByDO/DO_Powered_by_Badge_blue.svg" width="201px">
  </a>
</p>

## ©️ Copyright

#### Copyright © 2019-present, Ever Co. LTD. All rights reserved

[![Circle CI](https://circleci.com/gh/ever-co/ever-gauzy.svg?style=svg)](https://circleci.com/gh/ever-co/ever-gauzy)
[![codecov](https://codecov.io/gh/ever-co/ever-gauzy/branch/master/graph/badge.svg)](https://codecov.io/gh/ever-co/ever-gauzy)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/8c46f9eb9df64aa9859dea4d572059ac)](https://www.codacy.com/gh/ever-co/ever-gauzy/dashboard?utm_source=github.com&utm_medium=referral&utm_content=ever-co/ever-gauzy&utm_campaign=Badge_Grade)
[![DeepScan grade](https://deepscan.io/api/teams/3293/projects/16703/branches/363423/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=3293&pid=16703&bid=363423)
[![Known Vulnerabilities](https://snyk.io/test/github/ever-co/ever-gauzy/badge.svg)](https://snyk.io/test/github/ever-co/ever-gauzy)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fever-gauzy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_shield)
[![Crowdin](https://badges.crowdin.net/e/1d2b3405d65a56ec116d0984fd579cc9/localized.svg)](https://ever.crowdin.com/gauzy)

## 🔥 P.S

-   If you are interested in running an on-demand (delivery) or digital marketplace business, check open-source [Ever Demand Platform](https://github.com/ever-co/ever-demand)
-   [We are Hiring: remote TypeScript / NestJS / Angular developers](https://github.com/ever-co/jobs#available-positions)
