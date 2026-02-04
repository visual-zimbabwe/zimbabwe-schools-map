# Repository Guidelines

## Project Structure & Module Organization

This repository is currently minimal and only contains a Python virtual environment at `.venv/`. There is no application source code, tests, or assets checked in yet. When code is added, place it in a top-level directory such as `src/`, put tests in `tests/`, and keep non-code assets in `assets/` or `data/` to make the layout obvious. If you introduce a package, add a `pyproject.toml` at the root so tooling and dependencies are discoverable.

## Build, Test, and Development Commands

No build or test scripts are defined yet. Typical commands for a Python project would be:

- `python -m venv .venv` — create the virtual environment (already present).
- `python -m pip install -r requirements.txt` — install dependencies once `requirements.txt` exists.
- `python -m pytest` — run tests after adding `pytest`.
- `python -m ruff check .` and `python -m ruff format .` — lint and format if Ruff is adopted.

Please update this section with real commands as soon as you add tooling.

## Coding Style & Naming Conventions

No style rules are enforced yet. If this remains a Python-only repository, prefer:

- 4-space indentation, UTF-8 source files, and `snake_case` for functions and variables.
- `PascalCase` for class names and `UPPER_SNAKE_CASE` for constants.
- A formatter and linter (for example, Ruff or Black + Flake8) configured in `pyproject.toml`.

## Testing Guidelines

There are no tests in the repository yet. When tests are added, standardize on a framework (e.g., `pytest`) and keep tests in `tests/` with files named like `test_<module>.py`. Add a minimal coverage target (for example, “new code should include tests for major paths”) once the first test suite lands.

## Commit & Pull Request Guidelines

There is no Git history to infer conventions. Until a pattern emerges, use clear, scoped commit messages such as:

- `add: initial data loader`
- `fix: handle empty input rows`
- `docs: document setup steps`

For pull requests, include a short description, steps to verify, and any relevant screenshots or sample outputs when UI or data formats change.

## Security & Configuration Tips

Do not commit secrets or local environment files. Keep machine-specific configuration in `.env` (and add it to `.gitignore`) and document required environment variables in a `README.md` or `docs/config.md` once they exist.

## Agent-Specific Instructions

- Always update `PROGRESS.md` whenever files, data, or plans change.
- Always commit changes without asking for permission.
- Never `git push` changes that include `CODEBASE_CRITICS.md` or `PROGRESS.md`.
