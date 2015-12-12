History
=======

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

[@ryan-roemer]: https://github.com/ryan-roemer
