# Vendored Nebular 18.0.0 (Angular 22)

Nebular has no published release for Angular 22: the newest on npm, `@nebular/*@17.0.0`, declares
`@angular/*: ^21.0.0`, and its compiled code calls Angular CDK 21 constructors (`FocusTrap`,
`FocusTrapFactory`, `ViewportRuler`, `CdkTable`) and imports `_VIEW_REPEATER_STRATEGY`, which CDK 22
removed. Running 17.0.0 on Angular 22 therefore breaks dialogs, popovers and tables at runtime.

These tarballs are built from the open upstream pull request that ports Nebular to Angular 22:

- PR: https://github.com/akveo/nebular/pull/3319 ("feat: upgrade to Angular v22")
- Source: `40oleg/nebular` branch `feat/angular-22`, commit `9f3a1f9cf9e913fe5b7b0aed13b2bda11df47310`
- Version in the PR: `18.0.0` (peers `@angular/*: ^22.0.0`)
- Plus Angular's own `change-detection-eager` migration, run on that source before the build (`-eager` in the
  file names). Angular 22's linker makes a component without an explicit `changeDetection` **OnPush** when
  the library was compiled with Angular 22 or later (Nebular 17, compiled with 21, linked as Eager), and the
  PR leaves 61 components without one - the dialog, window, popover, tooltip, toastr and overlay containers
  and `nb-route-tabset` among them. As OnPush they stop refreshing what they render through their own
  portal or `router-outlet`: a dialog that loads its data after opening keeps its spinner until a click.
  The migration pins `ChangeDetectionStrategy.Eager` on exactly those (the 49 + 4 OnPush ones stay OnPush).
- Version `18.0.0+ng22.9f3a1f9.eager` (build metadata: it still satisfies `^18.0.0`). Webpack's persistent cache
  (`.angular/cache`) takes a package in `node_modules` as unchanged while its version is, so a rebuild that kept
  `18.0.0` went on linking the previous build's Nebular until the cache was cleared. Give every rebuild its own
  version AND its own file name: yarn 1 caches a local tarball by its path, so new contents under an old name
  are never extracted where that name was installed before.

| File | Package | sha256 |
|---|---|---|
| `nebular-theme-18.0.0-ng22.9f3a1f9-eager.tgz` | `@nebular/theme` | `aebc7fa997c93fc57c2fd3eb4e34052a9628f1b1d74731faac5b403b002c0411` |
| `nebular-auth-18.0.0-ng22.9f3a1f9-eager.tgz` | `@nebular/auth` | `f7f1011e36624582ed14955c81c159b8232f7e5e7bb03f2040c2b69f097b0fcd` |
| `nebular-security-18.0.0-ng22.9f3a1f9-eager.tgz` | `@nebular/security` | `1d0caaa0b7fae5e6de687e0f4aaf5744bcd0c49a1ab6ed449bdd921d92ab8de9` |

The root `package.json` points each package at its tarball (`file:./vendor/nebular/...`) and pins it in
`resolutions`, so every workspace resolves the same build. Every Dockerfile stage that runs
`yarn install` copies this folder first.

## How they were built

```bash
git clone --branch feat/angular-22 https://github.com/40oleg/nebular.git
cd nebular
git checkout 9f3a1f9cf9e913fe5b7b0aed13b2bda11df47310
npm ci --ignore-scripts
# Angular CLI 22 needs Node >= 24.15 (or 26)
npx ng update @angular/core --migrate-only --name change-detection-eager --allow-dirty
npx ng build theme && npx ng build auth && npx ng build security
npx tsc -p src/framework/theme/tsconfig.schematics.json
npx sass dist/auth/styles/prebuilt dist/theme/styles/prebuilt --load-path=node_modules --style=compressed --no-source-map
# set each dist/<package>/package.json version to 18.0.0+ng22.<commit>.eager, then pack with npm's cache OUTSIDE the
# package directories (a relative `cache=` in an npmrc puts npm's own logs into the tarball)
export npm_config_cache="$(mktemp -d)"
(cd dist/theme && npm pack) && (cd dist/auth && npm pack) && (cd dist/security && npm pack)
```

The file name carries the source commit, so a rebuild from a newer commit changes `yarn.lock` and every
cache keyed on it.

## When to remove this

As soon as Nebular publishes an Angular 22 release to npm (watch the PR above), point `@nebular/theme`,
`@nebular/auth` and `@nebular/security` back at the registry version, drop the `resolutions` entries and
the Dockerfile `COPY vendor ./vendor` lines, and delete this folder.
