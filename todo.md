Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO
All Rights Reserved.

# GUIHO Mirror TODO List

## Parent TODO

- Parent: [../guiho/TODO.md](../guiho/TODO.md)
- Parent AGENTS: [../guiho/AGENTS.md](../guiho/AGENTS.md)
- Local AGENTS: [./AGENTS.md](./AGENTS.md)
- Local context: Semantic project versioning and release workflow package for @guiho/mirror.


## Python Versioning Support

Add support for reading and updating Python package versions in Mirror. Initial planning should clarify which Python metadata files are in scope, such as `pyproject.toml`, `setup.cfg`, `setup.py`, package `__init__.py`, or another project convention.

## Python Source-To-Target Version Sync

Add an option for Python version propagation from a source project to a target project. Initial planning should define what "source" and "target" mean for Python projects, how the target version is selected or derived, and whether this should be a CLI option, configuration field, or both.
