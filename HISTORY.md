History
=======

## 2.9.1

* Refactor lodash calls to be tolerant of v3 or v4 as a temporary bandaid to
  a solution for the real underlying issue of:
  [#99](https://github.com/FormidableLabs/builder/issues/99)

## 2.9.0

* Add configurable log levels via `--log-level=LEVEL` and `--quiet`.
  [#6](https://github.com/FormidableLabs/builder/issues/6)

## 2.8.0

* Revises `PATH`, `NODE_PATH` ordering to place archetype first, then root
  project.
* Add `--expand-archetype` flag to expand `node_modules/<archetype` tokens in
  task strings.
  [builder-victory-component#23](https://github.com/FormidableLabs/builder-victory-component/issues/23)

## 2.7.1

* Propagate `--` flags via environment instead of command line mutation.
  [#92](https://github.com/FormidableLabs/builder/issues/92)

## 2.7.0

* Add support for `package.json:config` analogous to `npm`.
  [#89](https://github.com/FormidableLabs/builder/issues/89)

## 2.6.0

* Fix bug wherein `builder --version` displayed help instead of version.
* Add significantly enhanced test coverage.

## 2.5.0

* Add `builder -v|--version`.
* Add `builder -h|--help` shortcuts.
* Make `builder` (with no args) display help.
  [#61](https://github.com/FormidableLabs/builder/issues/61)

## 2.4.0

* Add `builder <action> <task> [-- <args>...]` support.
  [builder-react-component#27](https://github.com/FormidableLabs/builder-react-component/issues/27)

## 2.3.3

* Harmonize log messages with standardized command + environment strings.
* Add `builder <action> --[no-]bail` flag to control failing vs. non-failing
  concurrent tasks. ( [@exogen][] )
  [#64](https://github.com/FormidableLabs/builder/issues/64)

## 2.3.2

* Fix `stdout maxBuffer exceeded` error by bumping `exec` buffer to 32mb.
  [#62](https://github.com/FormidableLabs/builder/issues/62)

## 2.3.1

* Fix `builder run envs` on Node `v4.x` with respect to
  `_.isPlainObject(process.env)` bug. ( [@exogen][] )
  [#63](https://github.com/FormidableLabs/builder/issues/63)

## 2.3.0

* Switch to `tree-kill` to more emphatically kill off children process spawned
  within a single builder run.
* Add `builder <action> --setup` flag to run a task before and during an action.
  [#51](https://github.com/FormidableLabs/builder/issues/51)

## 2.2.2

* Fix help to work with `builder help <action|archetype(s)>`.

## 2.2.1

* Minor documentation and usage updates.

## 2.2.0

* Global `builder` script detects if local install available and switches to it.
  [#10](https://github.com/FormidableLabs/builder/issues/10)
* Add `builder envs` action for concurrent runs based on environment variables.
  [#29](https://github.com/FormidableLabs/builder/issues/29)
* Add `builder envs|concurrent --buffer` flag to buffer and display stderr and
  stdout at the _end_ of a task run for easier reading of concurrent output.

## 2.1.4

* Fix `PATH` / `NODE_PATH` resolution order to favor project root, then
  archetypes, then existing environment.
  [#47](https://github.com/FormidableLabs/builder/issues/47)

## 2.1.3

* Just use `require()` for archetype package.json loading.
  [#32](https://github.com/FormidableLabs/builder/issues/32)

## 2.1.2

* Allow archetype discovery from siblings for any npm version.
  [#30](https://github.com/FormidableLabs/builder/issues/30)

## 2.1.1

* Fix bug with archetype discovery when npm-installed and npm v3.
  [#25](https://github.com/FormidableLabs/builder/issues/25)

## 2.1.0

* Support new `ARCHETYPE` + `ARCHETYPE-dev` architecture for better NPM 2 + 3
  `devDependencies` support.
* **DEPRECATION**: Deprecate `builder install` workflow.
  [#16](https://github.com/FormidableLabs/builder/issues/16)

## 2.0.1

* Initial release.

[@exogen]: https://github.com/exogen
[@ryan-roemer]: https://github.com/ryan-roemer
