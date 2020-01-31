# Gauzy

[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/gauzy)
[![Gitter](https://badges.gitter.im/JoinChat.svg)](https://gitter.im/ever-co/gauzy?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Get help on Codementor](https://cdn.codementor.io/badges/get_help_github.svg)](https://www.codementor.io/evereq?utm_source=github&utm_medium=button&utm_term=evereq&utm_campaign=github)

Gauzy™ - Open-Source Profits Sharing Platform for modern agencies, studios and in-house teams. 

-   **Open-Source Software** solving **fair sharing of technology**.
-   **Stock Options** solving **fair sharing of profits _in the future_**.
-   **Gauzy** solving **fair sharing of profits _today_**.

Gauzy supports following schemas for Employee Bonus calculations:

-  **Profit-based**, when employees get bonuses based on profits of the company from work done by given employee. 
-  **Revenue-based**, when employees get bonuses based on revenue (gross income) from work done by given employee.

In order to allow bonuses calculations, Gauzy Platform includes multiple features, usually available in the *accounting*, *invoicing*, *time management* and *project management* software:
- Dashboard (provides overview of different metrics, such as company income / expenses, employees bonuses, etc.)
- Employees Management (register of company employees / contractors, rates of employees, etc.)
- Employees Onboarding (WIP)
- Income / Expenses Management
- Proposals
- Sales Pipelines (WIP)
- Multiple Organizations Management
- Organization Departments and Teams
- Organization Clients and Vendors
- Days Off Management
- Equipment Sharing (WIP)
- Project Management (WIP)
- Invoicing (WIP)
- Billing (WIP)
- Payments (WIP)
- Time Management/Tracking (WIP)
- Multi-currency

So, while the primary purpose of Gauzy Platform is to allow transparent and fair bonuses calculation, you can also use Gauzy software as a **Platform to run your outsourcing/freelance agency or studio business**. 

Read more [About Gauzy](https://github.com/ever-co/gauzy/wiki/About-Gauzy) and [How to use it](https://github.com/ever-co/gauzy/wiki/How-to-use-Gauzy) at your agency, studio or in-house teams

Feel free to test:

- Gauzy Platform SaaS at <https://app.gauzy.co> (currently working as demo, login with `admin@ever.co` and password: `admin`)
- Gauzy Platform Demo at <https://demo.gauzy.co> (temporary shutdown)
- Gauzy Platform Dev builds (using CI/CD, from the `develop` branch) at <https://app.gauzy.dev> (temporary shutdown)

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
-   Run API with `yarn start:api` (by default runs on <http://localhost:3000/api>)
-   Run Gauzy front-end with `yarn start`
-   Open <http://localhost:4200> in your browser
-   Login with email `admin@ever.co` and password: `admin`
-   Enjoy

Note: during the first API start, DB will be automatically seed with initial data if no users found.
You can run seed any moment manually (e.g. if you changed entities schemas) with `yarn run seed` command to re-initialize DB (warning: unsafe for production!).

### Production

-   Check [Gauzy Pulumi](https://github.com/ever-co/gauzy-pulumi) project, it will make Clouds deployments possible with a single command (`pulumi up`)

Note: it's WIP, currently supports AWS EKS (Kubernetes) and Fargate Clusters (for web app and backend api), Application Load Balancers and AWS RDS Serverless PostgreSQL DB deployments.

## Technology Stack

-   [TypeScript](https://www.typescriptlang.org)
-   [Node.js](https://nodejs.org)
-   [Nx](https://nx.dev)
-   [Angular 8](https://angular.io)
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

#### Developers (alphabetical order)

-   Aleksandar Tasev ([AlexTasev](https://github.com/AlexTasev))
-   Alish Meklyov ([Alish](https://github.com/AlishMekliov931))
-   Blagovest Gerov ([BlagovestGerov](https://github.com/BlagovestGerov))
-   Boyan Stanchev ([boyanstanchev](https://github.com/boyanstanchev))
-   Elvis Arabadjiyski ([Dreemsuncho](https://github.com/Dreemsuncho))
-   Emil Momchilov ([jew-er](https://github.com/jew-er))
-   Hristo Hristov ([hrimar](https://github.com/hrimar))

#### Designers & QA

-   [Julia Konviser](https://www.linkedin.com/in/julia-konviser-8b917552) (Graphic Designer, QA)

### Contributors

-   Rachit Magon ([rmagon](https://github.com/rmagon))
-   [Milena Dimova](https://www.linkedin.com/in/dimova-milena-31010414) (UI/UX Designer)

View full list of our [contributors](https://github.com/ever-co/gauzy/graphs/contributors).

## Contact Us

-   [Slack Community](https://join.slack.com/t/gauzy/shared_invite/enQtNzc5MTA5MDUwODg2LTI0MGEwYTlmNWFlNzQzMzBlOWExNTk0NzAyY2IwYWYwMzZjMTliYjMwNDI3NTJmYmM4MDQ4NDliMDNiNDY1NWU)
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

This software is available under [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.txt)

This program is free software: you can redistribute it and/or modify it under the terms of the corresponding licenses described in the LICENSE files located in software sub-folders and under the terms of licenses described in individual files.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

You should have received a copy of the relevant GNU Licenses along with this program. If not, see http://www.gnu.org/licenses/.

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fgauzy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_large)

## Trademarks

Gauzy™ is a trademark of Ever Co. LTD.  
All other brand and product names are trademarks, registered trademarks or service marks of their respective holders.

#### Copyright © 2019-present, Ever Co. LTD. All rights reserved.

[![Circle CI](https://circleci.com/gh/ever-co/gauzy.svg?style=svg)](https://circleci.com/gh/ever-co/gauzy)
[![codecov](https://codecov.io/gh/ever-co/gauzy/branch/master/graph/badge.svg)](https://codecov.io/gh/ever-co/gauzy)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8e0f1c13c3d94f18b1523b896d4500aa)](https://www.codacy.com/manual/Ever/gauzy?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=ever-co/gauzy&amp;utm_campaign=Badge_Grade)
[![DeepScan grade](https://deepscan.io/api/teams/3293/projects/8540/branches/103786/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=3293&pid=8540&bid=103786)
[![Known Vulnerabilities](https://snyk.io/test/github/ever-co/gauzy/badge.svg)](https://snyk.io/test/github/ever-co/gauzy)
[![Greenkeeper badge](https://badges.greenkeeper.io/ever-co/gauzy.svg)](https://greenkeeper.io)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fever-co%2Fgauzy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fever-co%2Fgauzy?ref=badge_shield)
