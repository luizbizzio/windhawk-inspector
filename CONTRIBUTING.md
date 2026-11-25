# Contributing to Windhawk Inspector

Use Node.js 22 or newer and npm. Run `npm ci`, `npm run dev`, `npm test`, `npm run test:catalog`, and `npm run build`. The [README](README.md) covers browser checks, catalog generation, and deployment.

## Review a change

- For analyzer changes, add a minimal C++ fixture with the expected finding or a case that should stay clear. Test line references and show how the finding reads in the UI.
- For catalog or version comparison changes, use fixtures for missing records and compare two known revisions. Run the catalog tests for generator changes.
- For browser changes, check the affected workflow with a known mod and a local file. Verify that loading, analysis, and source comparison behave as expected without executing the mod.

Include the analyzer rule or UI path, a safe source excerpt, and the affected browser in the pull request.
