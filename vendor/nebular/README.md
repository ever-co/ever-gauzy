# Vendored Nebular 18.0.0 (Angular 22)

Nebular has no published release for Angular 22: the newest on npm, `@nebular/*@17.0.0`, declares
`@angular/*: ^21.0.0`, and its compiled code calls Angular CDK 21 constructors (`FocusTrap`,
`FocusTrapFactory`, `ViewportRuler`, `CdkTable`) and imports `_VIEW_REPEATER_STRATEGY`, which CDK 22
removed. Running 17.0.0 on Angular 22 therefore breaks dialogs, popovers and tables at runtime.

These tarballs are built from the open upstream pull request that ports Nebular to Angular 22:

- PR: https://github.com/akveo/nebular/pull/3319 ("feat: upgrade to Angular v22")
- Source: `40oleg/nebular` branch `feat/angular-22`, commit `9f3a1f9cf9e913fe5b7b0aed13b2bda11df47310`
- Version in the PR: `18.0.0` (peers `@angular/*: ^22.0.0`)

| File | Package | sha256 |
|---|---|---|
| `nebular-theme-18.0.0-ng22.9f3a1f9.tgz` | `@nebular/theme` | `c75007705f983bea380b883846590bdcd42f2fb12067d88486b96cc0e9bf94c8` |
| `nebular-auth-18.0.0-ng22.9f3a1f9.tgz` | `@nebular/auth` | `056da7064fdc544f9a77f4bfbbbf4456349e89e3b8e1e5833951f0c5c2d5fa9c` |
| `nebular-security-18.0.0-ng22.9f3a1f9.tgz` | `@nebular/security` | `cce3d4736ccc21a6d3f4aa259a9eb4e8581b0a2ff10ac61d4432bbd01493a95a` |

The root `package.json` points each package at its tarball (`file:./vendor/nebular/...`) and pins it in
`resolutions`, so every workspace resolves the same build. Every Dockerfile stage that runs
`yarn install` copies this folder first.

## How they were built

```bash
git clone --depth 1 --branch feat/angular-22 https://github.com/40oleg/nebular.git
cd nebular
npm ci --ignore-scripts
# Angular CLI 22 needs Node >= 24.15 (or 26)
npx ng build theme && npx ng build auth && npx ng build security
npx tsc -p src/framework/theme/tsconfig.schematics.json
npx sass dist/auth/styles/prebuilt dist/theme/styles/prebuilt --load-path=node_modules --style=compressed --no-source-map
(cd dist/theme && npm pack) && (cd dist/auth && npm pack) && (cd dist/security && npm pack)
```

The file name carries the source commit, so a rebuild from a newer commit changes `yarn.lock` and every
cache keyed on it.

## When to remove this

As soon as Nebular publishes an Angular 22 release to npm (watch the PR above), point `@nebular/theme`,
`@nebular/auth` and `@nebular/security` back at the registry version, drop the `resolutions` entries and
the Dockerfile `COPY vendor ./vendor` lines, and delete this folder.
