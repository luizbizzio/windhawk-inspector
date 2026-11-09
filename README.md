# Windhawk Inspector

**Understand what a Windhawk mod can do before installing it.**

Windhawk Inspector is a browser-based, open-source C++ source analyzer for [Windhawk](https://windhawk.net/) mods. It inspects code without compiling or executing it and highlights potentially sensitive operations with source-line evidence.

> This tool is independent from Windhawk and is **not** a malware detector or a safety certificate. An empty report does not mean a mod is safe.

## Reading a report

The first screen shows two short lists: **Worth a closer look** and **Other things found**. Each row tells you what the mod's source can access, without requiring knowledge of Windows APIs. Sensitive findings also show a practical question to check.

Choose **Details** for more context and the lines that triggered each result. The full technical report and all occurrences remain in the JSON and HTML downloads. The same source can appear on several lines without creating repeated warning paragraphs.

A source match shows that code exists, not that it ran. If a scan is incomplete, the page says so plainly. An empty report is not a security guarantee.

## What it does

- Choose a mod by searchable name or ID from a locally hosted Windhawk catalog, or enter a public Windhawk/GitHub source URL, local `.wh.cpp`/`.cpp`/`.h`/`.hpp`/`.txt` file, or pasted C++ code.
- Classifies source-level findings across network, downloads, file system, Registry, process execution, cross-process memory, hooks, persistence, privileges, dynamic loading, input/shortcuts, sensitive data and Windhawk metadata.
- Groups equivalent API findings in the interface while retaining every source occurrence, argument and line number. JSON reports keep the original per-occurrence findings for downstream tools.
- Shows exact source lines, API names, arguments (raw source text), explanations, review suggestions, process includes/excludes and SHA-256.
- Compares two versions and identifies added/removed source-level findings.
- Exports JSON and standalone HTML reports.
- Runs analysis in Web Workers. A Tree-sitter C++ WebAssembly parser is used when available, with a clearly labeled limited lexical fallback.
- Reports parser coverage diagnostics: call sites inspected, syntax error nodes, missing tokens, sample issue lines and any inspection limits reached.
- Measures the source lines and characters touched by parser recovery regions. Minor regions appear as a quiet note; larger gaps remain visible. These are parser diagnostics, not compiler errors or a safety score. The AST scan allows up to 2 million syntax nodes and 60,000 call expressions; larger scans may still fall back to a limited text scan.
- Does **not** upload files, paste content or analysis results to a backend. Public URL analysis fetches source directly from GitHub.

## Design

Windhawk-inspired minimal dark interface.

## Usage

1. Open the hosted page, or run the project locally.
2. Find a Windhawk mod by name or ID (or paste a URL, select a file or paste source code).
3. Optionally enable version comparison and provide the previous source.
4. Select **Analyze source**.
5. Inspect evidence, limitations and reports.

### Supported URLs

- `https://windhawk.net/mods/<mod-id>`
- `https://github.com/<owner>/<repo>/blob/<branch>/<path>.wh.cpp`
- `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>.cpp`

GitHub browser URLs with a branch name containing `/` are not currently supported. Use a raw URL with a simple ref instead. Only public GitHub sources are fetched; URLs from arbitrary hosts are blocked. CORS restrictions and unavailable source files may prevent fetching. All source inputs have a 50 MB limit (50,000,000 bytes). Inputs over 8 MB use a clearly labeled limited lexical scan rather than the C++ AST parser to reduce browser memory usage. Large analyses may be slower or reach the call inspection limit.

## Local development

Prerequisites: Node.js 22+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
```

The postinstall script copies `web-tree-sitter.wasm` and `tree-sitter-cpp.wasm` into `public/wasm/`. These files are build-time runtime assets, not tracked in Git. The app is a static SPA and does not require a backend.

The selectable Windhawk mod catalog is generated from the official public catalog during the GitHub Pages build. To generate it locally, run `npm run catalog` while online. The generated `public/data/catalog.json` is ignored by Git and bundled as a static file into the site. If the catalog is temporarily unavailable, manual URLs, file uploads and pasted code still work.

## Static-host deployment

The GitHub Actions workflow downloads the official Windhawk catalog on deployment and on a daily schedule, then builds the app with a `/windhawk-inspector/` base path and deploys to GitHub Pages. Set **Settings → Pages → Build and deployment → GitHub Actions**, and confirm your repository visibility/plan permits Pages. For a custom domain at the root, set `GITHUB_PAGES_BASE=/` and configure the custom domain and DNS separately.

## How to interpret findings

- **Detected**: a matching API or declared capability is visible in the provided source.
- **Potential**: a matching source pattern exists but cannot establish intent or actual runtime behavior.
- **Not detected**: no matching rule was found in the supplied code; **never** an assurance of absence.
- **C++ syntax parsed**: a syntax tree was available. Reported error regions or missing tokens may arise from macros or incomplete translation units. Counts do **not** measure percentage of source coverage, and an AST does not imply full C++ compilation, linking or dataflow analysis.
- **Mixed scan**: the C++ inspection reached a limit. A basic text check supplemented the full source, but it is less precise.
- **Basic text scan**: the source was over 8 MB or the detailed parser was unavailable; detection has reduced reliability.

Severity describes review priority, not the probability of maliciousness. Normal Windhawk hooks are marked informational. Common C++ algorithms, shortcut keys and System32 DLL loading are handled contextually to reduce false positives. Explicit read/write access flags are differentiated for common file-open APIs, and only the `runas` verb is treated as an explicit ShellExecute elevation request. Comments and ordinary string literals are excluded from lexical call matching, but macros and indirect calls can still evade detection.

## Regression coverage

Automated tests cover grouped findings with evidence retention, the Taskbar Zones false positives, and representative network, download, file, Registry, credential, process-execution and elevation API patterns. Tree-sitter tests verify both ordinary C++ parsing and syntax recovery diagnostics. These tests verify specific patterns, not complete behavior or malware detection across arbitrary C++ projects.

## Important limitations

- Does not run the code, scan compiled binaries, load external dependencies or execute a sandbox.
- Cannot prove intent, behavior, safety, malware status, exact file paths or network destinations in general.
- Some C++ features, macros, dynamic API calls and library wrappers are not resolved.
- Mod metadata may omit process scopes or have platform-specific semantics that require manual review.
- Version comparison uses rule ID, symbol and normalized line text, so refactors can appear as changes even when behavior is identical.
- For a precise security review, manually inspect the source and any dependencies.

## Project layout

- `src/analysis/`: metadata, C++ syntax diagnostics, call rules, source URL validation, grouped reports and diffing.
- `src/workers/`: C++ parsing and background scanning.
- `src/App.tsx`: accessible responsive UI, input controls and results.
- `tests/`: unit tests for detection, source URLs and HTML escaping.
- `.github/workflows/`: CI and GitHub Pages deployment.

## License

Apache License 2.0. See [LICENSE](LICENSE).
