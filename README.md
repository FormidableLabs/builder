Builder
=======

Builder is a task runner.

Builder is an enhancement to `npm run TASK`.

Builder is a meta-tool for all your commond build, quality, test tasks.

## Overview

At a high level `builder` is a tool for consuming `package.json` `scripts`
commands, providing sensible / flexible defaults, and support various scenarios
("archetypes") for your common use cases across multiple projects.

## Archetypes

Archetypes deal with common scenarios for your projects. Like:

* [builder-react-component][]: A React component
* A React application server
* A Chai / jQuery / VanillaJS widget

Archetypes typically provide:

* A `package.json` with `builder`-friendly `script` tasks.
* Dependencies and dev dependencies to build, test, etc.
* Configuration files for all `script` tasks.

In most cases, you won't need to override anything. But, if you do, pick the
most granular `scripts` command in the archetype you need to override and
define _just that_ in your project's `package.json` `script` section. Copy
any configuration files that you need to tweak and re-define the command.

### Special Archetype Tasks

Archetypes use conventional `scripts` task names, except for the following
special cases:

* `"npm:postinstall"
* `"npm:preversion"
* `"npm:version"
* `"npm:test"`

These tasks are specifically actionable during the `npm` lifecycle, and
consequently, the archetype mostly ignores those for installation by default,
offering them up for actual use in _your_ project.

As an **additional restriction**, non-`npm:FOO`-prefixed tasks with the same
name (e.g., `FOO`) _may_ call then `npm:`-prefixed task, but _not_ the other
way around. So

```js
// Good / OK
"npm:test": "builder run test-frontend",
"test": "builder run npm:test",

// Bad
"npm:test": "builder run test",
"test": "builder run test-frontend",
````

## Package Script Commands

The underyling concept here is that `builder` `script` commands simple _are_
NPM-friendly `package.json` `script` commands. Pretty much anything that you
can execute with `npm run FOO` can be executed with `builder run FOO`.

### Tips & Tricks

#### Terminal Color

Builder uses `exec` under the hood with piped `stdout` and `stderr`. Programs
typically interpret the piped environment as "doesn't support color" and
disable color. Consequently, you typically need to set a "**force color**"
option on your executables in `scripts` commands if they exist.

#### Project Root

Builder uses some magic to enhance `NODE_PATH` to look in the root of your
project (normal) and in the installed modules of builder archetypes. This
latter path enhancement sometimes throws tools / libraries for a loop. We
recommend using `require.resolve("LIBRARY_OR_REQUIRE_PATH")` to get the
appropriate installed file path to a dependency.

This comes up in situations including:

* Webpack loaders
* Karma included files

The other thing that comes up in our Archetype configuration file is the
general _requirement_ that builder is running from the project root, not
relative to an archetype. However, some libraries / tools will interpret
`"./"` as relative to the _configuration file_ which may be in an archetype.

So, for these instances and instances where you typically use `__dirname`,
and archetype may need to use `process.cwd()` and be constrained to **only**
ever running from the project root. Some scenarios where the `process.cwd()`
path base is necessary include:

* Webpack entry points, aliases
* Karma included files (that cannot be `require.resolve`-ed)

#### Other Process Execution

The execution of tasks generally must _originate_ from Builder, because of all
of the environment enhancements it adds. So, for things that themselves exec
or spawn processes, like `concurrently`, this can be a problem. Typically, you
will need to have the actual command line processes invoked _by_ Builder.

[builder-react-component]: https://github.com/FormidableLabs/builder-react-component
