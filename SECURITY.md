# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| latest release and `main` | yes |
| older releases | no |

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub:
[Security → Report a vulnerability](https://github.com/BioVisForge/phoskintime-vis/security/advisories/new).

Include the affected version, the browser and operating system, steps to reproduce and, if you
can, a minimal bundle. Never attach unpublished or personal data: a synthetic bundle from
`npm run fixtures` is preferred.

The maintainer will acknowledge the report and assess it. No response time is guaranteed.

## What is in scope

The viewer runs entirely in your browser. Its Content-Security-Policy allows no network access
except the page's own origin and an engine on `127.0.0.1`/`localhost` that you connect to
yourself. Reports of particular interest:

- a crafted bundle that executes script, escapes the page or reaches the network;
- a file that passes sha256 verification although it differs from the manifest;
- data leaving the browser.

The mock engine (`scripts/mock-engine.mjs`) is a development tool and is not meant to be exposed
beyond the local machine.
