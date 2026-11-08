# Windhawk Inspector

**Understand what a Windhawk mod can do before installing it.**

Windhawk Inspector is a browser-based, open-source C++ source analyzer for [Windhawk](https://windhawk.net/) mods. It inspects code without compiling or executing it and highlights potentially sensitive operations with source-line evidence.

> This tool is independent from Windhawk and is **not** a malware detector or a safety certificate. An empty report does not mean a mod is safe.

## What it does

- Input via Windhawk catalog URL, public GitHub source URL, local `.wh.cpp`/`.cpp`/`.h`/`.hpp`/`.txt` file, or pasted C++ code.
- Classifies source-level findings across network, downloads, file system, Registry, process execution, cross-process memory, hooks, persistence, privileges, dynamic loading, input/shortcuts, sensitive data and Windhawk metadata.
- Shows exact source lines, API names, arguments (raw source text), explanations, review suggestions, process includes/excludes, SHA-256 and analysis coverage.
- Compares two versions and identifies added/removed source-level findings.
- Exports JSON and standalone HTML reports.
- Runs analysis in Web Workers. A Tree-sitter C++ WebAssembly parser is used when available, with a clearly labeled limited lexical fallback.
- Does **not** upload files, paste content or analysis results to a backend. Public URL analysis fetches source directly from GitHub.

## Design

Windhawk-inspired minimal dark interface.

## Usage

1. Open the hosted page, or run the project locally.
2. Paste a Windhawk mod URL, select a source file, or paste C++ code.
3. Optionally enable version comparison and provide the previous source.
4. Select **Analyze source**.
5. Inspect evidence, limitations and reports.

### Supported URLs

- `https://windhawk.net/mods/<mod-id>`
- `https://github.com/<owner>/<repo>/blob/<branch>/<path>.wh.cpp`
- `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>.cpp`

GitHub browser URLs with a branch name containing `/` are not currently supported. Use a raw URL with a simple ref instead. Only public GitHub sources are fetched; URLs from arbitrary hosts are blocked. CORS restrictions and unavailable source files may prevent fetching. All source inputs have a 2 MB limit.

## Local development

Prerequisites: Node.js 22+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
```

The postinstall script copies `web-tree-sitter.wasm` and `tree-sitter-cpp.wasm` into `public/wasm/`. These files are build-time runtime assets, not tracked in Git. The app is a static SPA and does not require a backend.

## Static-host deployment

The GitHub Actions workflow builds the app with a `/windhawk-inspector/` base path and deploys to GitHub Pages. Set **Settings → Pages → Build and deployment → GitHub Actions**, and confirm your repository visibility/plan permits Pages. For a custom domain at the root, set `GITHUB_PAGES_BASE=/` and configure the custom domain and DNS separately.

## How to interpret findings

- **Detected**: a matching API or declared capability is visible in the provided source.
- **Potential**: a matching source pattern exists but cannot establish intent or actual runtime behavior.
- **Not detected**: no matching rule was found in the supplied code; **never** an assurance of absence.
- **C++ syntax parsed**: the C++ syntax tree was available (but not full C++ compilation, linking, dataflow or runtime analysis).
- **Limited lexical scan**: WebAssembly parsing was unavailable; detection has reduced reliability.

Severity describes review priority, not the probability of maliciousness. Normal Windhawk hooks are marked informational. Common C++ algorithms, shortcut keys and System32 DLL loading are handled contextually to reduce false positives. Comments and ordinary string literals are excluded from lexical call matching, but macros and indirect calls can still evade detection.

## Important limitations

- Does not run the code, scan compiled binaries, load external dependencies or execute a sandbox.
- Cannot prove intent, behavior, safety, malware status, exact file paths or network destinations in general.
- Some C++ features, macros, dynamic API calls and library wrappers are not resolved.
- Mod metadata may omit process scopes or have platform-specific semantics that require manual review.
- Version comparison uses rule ID, symbol and normalized line text, so refactors can appear as changes even when behavior is identical.
- For a precise security review, manually inspect the source and any dependencies.

## Project layout

- `src/analysis/`: metadata, C++ call rule definitions, source URL validation, reports and diffing.
- `src/workers/`: C++ parsing and background scanning.
- `src/App.tsx`: accessible responsive UI, input controls and results.
- `tests/`: unit tests for detection, source URLs and HTML escaping.
- `.github/workflows/`: CI and GitHub Pages deployment.

## License

MIT. See [LICENSE](LICENSE).
