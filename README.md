# Gauzy Platform

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/ever-co/gauzy)
[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/gauzy)
[![Gitter](https://badges.gitter.im/JoinChat.svg)](https://gitter.im/ever-co/gauzy?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Get help on Codementor](https://cdn.codementor.io/badges/get_help_github.svg)](https://www.codementor.io/evereq?utm_source=github&utm_medium=button&utm_term=evereq&utm_campaign=github)

Gauzy™ Platform - **Open-Source Business Management Platform** focused on **Fairness** and **Transparency** for freelancers, modern agencies, studios and in-house teams.

You are welcome to check more information about the platform at our official website - **<https://ever.co/features-gauzy-platform>**.

Gauzy Platform includes multiple ERP/CRM features, usually available in the _accounting_, _human resources_, _invoicing_, _time management_ and _project management_ software:

-   Dashboard (provides overview of different metrics, such as company income / expenses, employees bonuses, etc.)
-   Contacts Management (Clients / Customers / Leads / etc.)
-   Employees Management (register of company employees / contractors, rates of employees, etc.)
-   Employees Onboarding / Candidates Interviews
-   Time Management / Time Tracking / Activity Tracking / Timesheets
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
-   Organization Departments and Teams
-   Organization Clients and Vendors
-   Help Center / Knowledge Base
-   Multiple Organizations Management
-   Tags / Labels
-   Reports
-   Organization and Employee Public Pages
-   Integrations (Upwork, HubStaff, etc.)
-   Email History / Email Templates
-   Data Import / Export
-   Roles / Permissions
-   Multi-currency
-   Multi-language
-   Dark / Light / Corporate and other Themes

So, while initially the primary purpose of Gauzy Platform was to allow transparent and fair accounting, profits sharing and bonuses calculation, today you can also use Gauzy software as the modern and intelligent platform to run your **Outsourcing/Freelance Agency or Studio business** in a completely new, open way.

In addition, we encourage individual **Freelancers** to join our "Gauzy" revolution and use the platform to jump start your open business!

Read more [About Gauzy](https://github.com/ever-co/gauzy/wiki/About-Gauzy) and [How to use it](https://github.com/ever-co/gauzy/wiki/How-to-use-Gauzy) at your freelance business, agency, studio or in-house teams.

## Demos, Testing and Production

<!--
-   Gauzy Platform Demo at <https://demo.gauzy.co> (login `admin@ever.co` and password: `admin`)
-   Gauzy Platform Dev builds (using CI/CD, from the `develop` branch) at <https://app.gauzy.dev> (temporary deployed manually)
-   Gauzy Platform SaaS at <https://app.gauzy.co> (not used yet in production, it's same as demo.gauzy.co for now)
-->

### Desktop App

-   Download Gauzy Desktop App for your OS. Currently you can get latest release on <https://github.com/ever-co/gauzy/releases/tag/v0.1.0>.
-   Setup Gauzy Desktop App and run it
-   Select "Local", "Sqlite" and "Default" (that set port 3000 value for API). Click "Save" and after a couple of seconds (minutes) it will create local Sqlite DB for testing of Gauzy.
-   Gauzy Desktop App is ready to use. 
-   You can login with `admin@ever.co` and password `admin` to check Admin functionality. Note: such Admin user is not an employee, so you will not be able to track time.
-   You can login with `ruslan@ever.co` and password `admin` to check Desktop Timer and other functionality from "Employee" perspective (such user is an Employee).

Note: Desktop App can connect to [ActivityWatch](https://activitywatch.net)[*](https://github.com/ever-co/gauzy/blob/develop/README.md#legal-notice) API to collect more statistics related to running apps and visited Urls. If you need that functionality, you can install [ActivityWatch](https://activitywatch.net)[*](https://github.com/ever-co/gauzy/blob/develop/README.md#legal-notice) and make sure it's running and you selected "ActivityWatch" checkbox in Gauzy Desktop App. 

## Quick Start

### With Docker Compose

-   Clone repo
-   Make sure you have Docker Compose [installed locally](https://docs.docker.com/compose/install)
-   Run `docker-compose up`
-   :coffee: time...
-   Open <http://localhost:8080> in your browser
-   Login with email `admin@ever.co` and password: `admin`
-   Enjoy

Note: together with Gauzy, Docker Compose will run following:

-   Cross-platform client for PostgreSQL DBs [pgweb](https://github.com/sosedoff/pgweb), on <http://localhost:8081>
-   [Franchise](https://github.com/HVF/franchise), lightweight but powerful SQL tool with a notebook interface, on <http://localhost:8082>
-   [OmniDb](https://github.com/OmniDB/OmniDB), on <http://localhost:8083> and using default credentials (admin:admin) configure connection string `postgres://postgres:root@db:5432/postgres?sslmode=disable`.
-   [Adminer](https://www.adminer.org) Database management in a single PHP file, on <http://localhost:8084>

### Manually

-   Install and run latest [PostgreSQL](https://www.postgresql.org) (optionally, other DB can be configured manually).
-   Install [Yarn](https://github.com/yarnpkg/yarn) (if you don't have it) with `npm i -g yarn`
-   Install NPM packages with `yarn install`
-   Optionally, if you want to seed a lot of fake data for demo testing, run `yarn seed:all`
-   Run API with `yarn start:api` (by default runs on <http://localhost:3000/api>)
-   Run Gauzy front-end with `yarn start`
-   Open <http://localhost:4200> in your browser
-   Login with email `admin@ever.co` and password: `admin`
-   Enjoy

Notes:

-   during the first API start, DB will be automatically seed with minimum set of initial data if no users found.
-   you can run seed any moment manually (e.g. if you changed entities schemas) with `yarn seed` command to re-initialize DB (warning: unsafe for production!).
-   it is possible to run generation of extremely large amount of fake data for demo purposes / testing with `yarn seed:all` (warning: takes ~10 min to complete)

### Production

-   Check [Gauzy Pulumi](https://github.com/ever-co/gauzy-pulumi) project, it makes Clouds deployments possible with a single command (`pulumi up`)

Note: it currently supports AWS EKS (Kubernetes) for development and production (recommended) with Application Load Balancers and AWS RDS Serverless PostgreSQL DB deployments. In addition, we implemented deployments to ECS EC2 and Fargate Clusters.

## Technology Stack

-   [TypeScript](https://www.typescriptlang.org)
-   [Node.js](https://nodejs.org)
-   [Nx](https://nx.dev)
-   [Angular](https://angular.io)
-   [Nest](https://github.com/nestjs/nest)
-   [RxJS](http://reactivex.io/rxjs)
-   [TypeORM](https://github.com/typeorm/typeorm)
-   [Ngx-admin](https://github.com/akveo/ngx-admin)
-   [PostgreSQL](https://www.postgresql.org)

Note: thanks to TypeORM, Gauzy will support lots of DBs: MySql, MariaDb, PostgreSQL, CockroachDb, sqlite, MS SQL, Oracle, MongoDb and others, with minimal changes.

#### See also README.md and CREDITS.md files in relevant folders for lists of libraries and software included in the Platform, information about licenses and other details.

### How to use Nx

Please see our [Wiki page](https://github.com/ever-co/gauzy/wiki/How-to-use-Nx) about Nx usage

## Contribute

-   Please give us :star: on Github, it **helps**!
-   You are more than welcome to submit feature requests
-   Pull requests are always welcome! Please base pull requests against the _develop_ branch and follow the [contributing guide](.github/CONTRIBUTING.md).

## Collaborators and Contributors

### Development Team

#### Core

-   Ruslan Konviser ([Evereq](https://github.com/evereq))
-   Rachit Magon ([rmagon](https://github.com/rmagon))

#### Developers (alphabetical order)

-   Alish Meklyov ([Alish](https://github.com/AlishMekliov931))
-   Blagovest Gerov ([BlagovestGerov](https://github.com/BlagovestGerov))
-   Elvis Arabadjiyski ([Dreemsuncho](https://github.com/Dreemsuncho))
-   Hristo Hristov ([hrimar](https://github.com/hrimar))
-   Pavel Denchev ([PavelDenchev](https://github.com/PavelDenchev))
-   Tsvetelina Yordanova ([tsvetelina-e-y](https://github.com/tsvetelina-e-y))
-   Valentin Peshev ([valiopld](https://github.com/valiopld))
-   Yavor Grancharov ([YavorGrancharov](https://github.com/YavorGrancharov))

#### Designers & QA

-   [Julia Konviser](https://www.linkedin.com/in/julia-konviser-8b917552) (Graphic Designer, QA)
-   [Yordan Genovski](https://services.ever.co/teammembers/yordan-genovski) (UX/UI/Product Designer)

### Contributors

View full list of our [contributors](https://github.com/ever-co/gauzy/graphs/contributors).

## Contact Us

-   [Ever.co Website Contact Us page](https://ever.co/contacts)
-   [Slack Community](https://join.slack.com/t/gauzy/shared_invite/enQtNzc5MTA5MDUwODg2LTI0MGEwYTlmNWFlNzQzMzBlOWExNTk0NzAyY2IwYWYwMzZjMTliYjMwNDI3NTJmYmM4MDQ4NDliMDNiNDY1NWU)
-   [Discord Chat](https://discord.gg/hKQfn4j)
-   [Spectrum Community](https://spectrum.chat/gauzy)
-   [Gitter Chat](https://gitter.im/ever-co/gauzy)
-   [CodeMentor](https://www.codementor.io/evereq)
-   For business inquiries: <mailto:gauzy@ever.co>
-   Please report security vulnerabilities to <mailto:security@ever.co>
-   [Gauzy Platform @ Twitter](https://twitter.com/gauzyplatform)
-   [Gauzy Platform @ Facebook](https://www.facebook.com/gauzyplatform)

## Security

Gauzy™ follows good security practices, but 100% security cannot be guaranteed in any software!  
Gauzy™ is provided AS IS without any warranty. Use at your own risk!  
See more details in the [LICENSE](LICENSE).

In a production setup, all client-side to server-side (backend, APIs) communications should be encrypted using HTTPS/WSS/SSL (REST APIs, GraphQL endpoint, Socket.io WebSockets, etc.).

## License

This software is available under following licenses:

-   [Gauzy™ Platform Community Edition](https://github.com/ever-co/gauzy/blob/master/LICENSE.md#gauzy-platform-community-edition-license)
-   [Gauzy™ Platform Small Business](https://github.com/ever-co/gauzy/blob/master/LICENSE.md#gauzy-platform-small-business-license)
-   [Gauzy™ Platform Enterprise](https://github.com/ever-co/gauzy/blob/master/LICENSE.md#gauzy-platform-enterprise-license)

#### The default Gauzy™ Platform license, without a valid Gauzy™ Platform Enterprise or Gauzy™ Platform Small Business License agreement, is the Gauzy™ Platform Community Edition License.

#### Please see [LICENSE.md](LICENSE.md) for more information on licenses. You can also [compare our offering](https://ever.co/compare-gauzy/#compare).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fgauzy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_large)

## Trademarks

Gauzy™ is a trademark of Ever Co. LTD.  
All other brand and product names are trademarks, registered trademarks or service marks of their respective holders.

## Legal Notice

The links to third-party software are being provided as a convenience and for informational purposes only; they do not constitute an endorsement or an approval of any of the products, services or opinions of the corporation or organization or individual. Ever Co. LTD bears no responsibility for the accuracy, legality or content of the external sites or applications or for that of subsequent links. Contact the external site or application vendor for answers to questions regarding its content.

Please see the list of third-party software below:

- [ActivityWatch](https://activitywatch.net)

## Copyright

#### Copyright © 2019-present, Ever Co. LTD. All rights reserved.

![visitors](https://visitor-badge.laobi.icu/badge?page_id=ever-co.gauzy-platform)
[![Circle CI](https://circleci.com/gh/ever-co/gauzy.svg?style=svg)](https://circleci.com/gh/ever-co/gauzy)
[![codecov](https://codecov.io/gh/ever-co/gauzy/branch/master/graph/badge.svg)](https://codecov.io/gh/ever-co/gauzy)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8e0f1c13c3d94f18b1523b896d4500aa)](https://www.codacy.com/manual/Ever/gauzy?utm_source=github.com&utm_medium=referral&utm_content=ever-co/gauzy&utm_campaign=Badge_Grade)
[![DeepScan grade](https://deepscan.io/api/teams/3293/projects/8540/branches/103786/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=3293&pid=8540&bid=103786)
[![Known Vulnerabilities](https://snyk.io/test/github/ever-co/gauzy/badge.svg)](https://snyk.io/test/github/ever-co/gauzy)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/ever-co/gauzy.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ever-co/gauzy/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/ever-co/gauzy.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ever-co/gauzy/context:javascript)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fgauzy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_shield)

## P.S.

-   If you interested to run on-demand (delivery) or digital marketplace business, check open-source [Ever Platform](https://github.com/ever-co/ever)
-   [We are Hiring: remote TypeScript / NestJS / Angular developers](https://github.com/ever-co/jobs#available-positions)
