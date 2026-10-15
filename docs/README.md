# Ever Gauzy documentation

The Ever Gauzy documentation does not live in this repository. It is written in
[`ever-co/ever-gauzy-docs`](https://github.com/ever-co/ever-gauzy-docs) and published at
**[docs.gauzy.co](https://docs.gauzy.co)**. This folder only points there.

## Read

| What                            | Where                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 📖 **Platform documentation**   | **[docs.gauzy.co](https://docs.gauzy.co)**                                                                |
| 🚀 Quick start                  | [docs.gauzy.co/getting-started/quick-start](https://docs.gauzy.co/getting-started/quick-start/)           |
| 🛠️ Installation                 | [docs.gauzy.co/getting-started/installation](https://docs.gauzy.co/getting-started/installation/)         |
| 📡 API overview                 | [docs.gauzy.co/api/overview](https://docs.gauzy.co/api/overview/)                                         |
| 🧪 Live API reference (Swagger) | [api.gauzy.co/docs](https://api.gauzy.co/docs)                                                            |
| 🚢 Deployment (Kubernetes)      | [docs.gauzy.co/deployment/kubernetes](https://docs.gauzy.co/deployment/kubernetes/)                       |
| 🐳 Deployment (Docker Compose)  | [docs.gauzy.co/deployment/docker/docker-compose](https://docs.gauzy.co/deployment/docker/docker-compose/) |
| 💻 Contributing to Gauzy        | [docs.gauzy.co/development/contributing](https://docs.gauzy.co/development/contributing/)                 |
| 📚 Wiki                         | [github.com/ever-co/ever-gauzy/wiki](https://github.com/ever-co/ever-gauzy/wiki)                          |

## Use

| What                        | Where                                            |
| --------------------------- | ------------------------------------------------ |
| 🌐 Website                  | [gauzy.co](https://gauzy.co)                     |
| ⬇️ Downloads (server, apps) | [gauzy.co/downloads](https://gauzy.co/downloads) |
| ☁️ Ever Gauzy SaaS          | [app.gauzy.co](https://app.gauzy.co)             |
| 🎮 Demo (resets daily)      | [demo.gauzy.co](https://demo.gauzy.co)           |

## Write or fix a page

Open a pull request in **[`ever-co/ever-gauzy-docs`](https://github.com/ever-co/ever-gauzy-docs)**, not here:

- the site is a [Docusaurus](https://docusaurus.io/) app in `website/`; the pages are Markdown under
  `website/docs/`, one folder per section of the sidebar;
- base the pull request on `develop` (`master` is what docs.gauzy.co publishes);
- run it locally with `yarn install` then `yarn start` in `website/`.

A page that would have gone in `docs/<section>/` of this repository goes in `website/docs/<section>/` there.
Every page on docs.gauzy.co has an "Edit this page" link to its source.

## Pages that used to be here

These two pages are generated from code in this repository, and a CI check fails when a page drifts from
that code, so the copy the check reads stays beside its generator under `tools/`. The published page is a
copy of it; regenerate the copy here, then copy the change to the docs repository.

| Was                                              | Published at                                                                                                          | Copy checked by CI here                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ever-platform/outbound-calls.md`           | [docs.gauzy.co/ever-platform/outbound-calls](https://docs.gauzy.co/ever-platform/outbound-calls/)                     | [`tools/ever-platform/outbound-calls.md`](../tools/ever-platform/outbound-calls.md) (`node tools/ever-platform/outbound-calls.mjs --check`) |
| `docs/platform-extensions/design-name-triage.md` | [docs.gauzy.co/platform-extensions/design-name-triage](https://docs.gauzy.co/platform-extensions/design-name-triage/) | [`tools/scripts/design-name-triage.md`](../tools/scripts/design-name-triage.md) (`node tools/scripts/design-name-triage-check.mjs`)         |
