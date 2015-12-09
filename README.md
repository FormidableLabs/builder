[![Travis Status][trav_img]][trav_site]
[![Coverage Status][cov_img]][cov_site]

Builder
=======

Builder takes your `npm` tasks and makes them composable, controllable from
a single point, and flexible.

`npm` is fantastic for controlling dependencies, tasks (via `scripts`) and
general project workflows. But a project-specific `package.json` simply doesn't
scale when you're managing many (say 5-50) very similar repositories.

_Enter Builder._ Builder is "almost" `npm`, but provides for off-the-shelf
"archetypes" to provide central sets of `package.json` `scripts`,
`dependencies` and `devDependencies`. The rest of this page will dive into
the details and machinations of the tool, but first here are a few of the
rough goals and motivations behind the project.

* **Single Point of Control**: A way to define a specific set of tasks /
  configs / etc. for one "type" of project. For example, we have an
  ever-expanding set of related repos for our
  [Victory](https://github.com/FormidableLabs/?utf8=%E2%9C%93&query=victory)
  project which all share a nearly-identical dev / prod / build workflow.
* **Flexibility**: There are a number of meta tools for controlling JavaScript
  workflows / development lifecycles. However, most are of the "buy the farm"
  nature. This works great when everything is within the workflow but falls
  apart once you want to be "just slightly" different. Builder solves this by
  allowing fine grain task overriding by name, where the larger composed tasks
  still stay the same and allow a specific repo's deviation from "completely off
  the shelf" to be painless.
* **You Can Give Up**: One of the main goals of builder is to remain very
  close to a basic `npm` workflow. So much so, that we include a section in this
  guide on how to abandon the use of Builder in a project and revert everything
  from archetypes back to vanilla `npm` `package.json` `scripts`, `dependencies`
  and `devDependencies`.

## Overview

At a high level `builder` is a tool for consuming `package.json` `scripts`
commands, providing sensible / flexible defaults, and support various scenarios
("archetypes") for your common use cases across multiple projects.

Builder is not opinionated, although archetypes _are_ and typically dictate
file structure, standard configurations, and dev workflows. Builder supports
this in an agnostic way, providing essentially the following:

* `NODE_PATH`, `PATH` enhancements to run, build, import from archetypes so
  dependencies and configurations don't have to be installed directly in a
  root project.
* A task runner capable of single tasks (`run`) or multiple concurrent tasks
  (`concurrent`).
* An intelligent merging of `package.json` `scripts` tasks.

... and that's about it!

### Usage

To start using builder, install and save `builder` and any archetypes you
intend to use. We'll use the [builder-react-component][] archetype as an
example.

**Note**: Most archetypes have an `ARCHTEYPE` package and parallel
`ARCHETYPE-dev` npm package. The `ARCHETYPE` package contains _almost_
everything needed for the archtype (prod dependencies, scripts, etc.) except
for the `devDependencies` which the latter `ARCHETYPE-dev` package is solely
responsible for bringing in.

#### Global Install

For ease of use, one option is to globally install `builder` and locally install
archetypes:

```sh
$ npm install -g builder
$ npm install --save builder-react-component
$ npm install --save-dev builder-react-component-dev
```

Like a global install of _any_ Node.js meta / task runner tool (e.g., `eslint`,
`mocha`, `gulp`, `grunt`) doing a global install is painful because:

* You are tied to _just one_ version of the tool for all projects.
* You must also globally install the tool in CI, on servers, etc.

... so instead, we **strongly recommend** a local install described in the
next section!

To help you keep up with project-specific builder requirements, a globally-
installed `builder` will detect if a locally-installed version of `builder` is
available and switch to that instead:

```
$ /GLOBAL/PATH/TO/builder
[builder:local-detect] Switched to local builder at: ./node_modules/builder/bin/builder-core.js

... now using local builder! ...
```

#### Local Install

To avoid tying yourself to a single, global version of `builder`, the option
that we endorse is locally installing both `builder` and archetypes:

```sh
$ npm install --save builder
$ npm install --save builder-react-component
$ npm install --save-dev builder-react-component-dev
```

However, to call `builder` from the command line you will either need to
augment your `PATH` variable with a shell configuration (Mac/Linux) like:

```sh
export PATH="./node_modules/.bin:${PATH}"
# ... OR ...
export PATH="${PATH}:./node_modules/.bin"
```

or call the longer `./node_modules/.bin/builder` instead of `builder` from the
command line.


#### Configuration

After `builder` is available, you can edit `.builderrc` like:

```yaml
---
archetypes:
  - builder-react-component
```

to bind archetypes.

... and from here you are set for `builder`-controlled meta goodness!

#### Builder Actions

Display general or command-specific help (which shows available specific flags).

```sh
$ builder help
$ builder help <action>
```

Run `builder help <action>` for all available options. For a quick overview:

##### builder run

Run a single task from `script`. Analogous to `npm run <task>`

```sh
$ builder run <task>
```

Flags:

* `--builderrc`: Path to builder config file (default: `.builderrc`)
* `--tries`: Number of times to attempt a task (default: `1`)

##### builder concurrent

Run multiple tasks from `script` concurrently. Roughly analogous to
`npm run <task1> | npm run <task2> | npm run <task3>`, but kills all processes on
first non-zero exit (which makes it suitable for test tasks).

```sh
$ builder concurrent <task1> <task2> <task3>
```

Flags:

* `--builderrc`: Path to builder config file (default: `.builderrc`)
* `--tries`: Number of times to attempt a task (default: `1`)
* `--queue`: Number of concurrent processes to run (default: unlimited - `0|null`)
* `--[no-]buffer`: Buffer output until process end (default: `false`)

Note that `tries` will retry _individual_ tasks that are part of the concurrent
group, not the group itself. So, if `builder concurrent --tries=3 foo bar baz`
is run and bar fails twice, then only `bar` would be retried. `foo` and `baz`
would only execute _once_ if successful.

##### builder envs

Run a single task from `script` concurrently for item in an array of different
environment variables. Roughly analogous to:

```sh
$ FOO=VAL1 npm run <task> | FOO=VAL2 npm run <task> | FOO=VAL3 npm run <task>
```

... but kills all processes on first non-zero exit (which makes it suitable for
test tasks). Usage:

```sh
$ builder envs <task> <json-array>
$ builder envs <task> --envs-path=<path-to-json-file>
```

Examples:

```sh
$ builder envs <task> '[{ "FOO": "VAL1" }, { "FOO": "VAL2" }, { "ENV1": "VAL3" }]'
$ builder envs <task> '[{ "FOO": "VAL1", "BAR": "VAL2" }, { "FOO": "VAL3" }]'
```

Flags:

* `--builderrc`: Path to builder config file (default: `.builderrc`)
* `--tries`: Number of times to attempt a task (default: `1`)
* `--queue`: Number of concurrent processes to run (default: unlimited - `0|null`)
* `--[no-]buffer`: Buffer output until process end (default: `false`)
* `--envs-path`: Path to JSON env variable array file (default: `null`)

## Tasks

The underlying concept here is that `builder` `script` commands simply _are_
npm-friendly `package.json` `script` commands. Pretty much anything that you
can execute with `npm run <task>` can be executed with `builder run <task>`.

Builder can run 1+ tasks based out of `package.json` `scripts`. For a basic
scenario like:

```js
{
  "scripts": {
    "foo": "echo FOO",
    "bar": "echo BAR"
  }
}
```

Builder can run these tasks individually:

```sh
$ builder run foo
$ builder run bar
```

Sequentially via `||` or `&&` shell helpers:

```sh
$ builder run foo && builder run bar
```

Concurrently via the Builder built-in `concurrent` command:

```sh
$ builder concurrent foo bar
```

With `concurrent`, all tasks continue running until they all complete _or_
any task exits with a non-zero exit code, in which case all still alive tasks
are killed and the Builder process exits with the error code.

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

### Task Resolution

The easiest bet is to just have _one_ archetype per project. But, multiple are
supported. In terms of `scripts` tasks, we end up with the following example:

```
ROOT/package.json
ROOT/node_modules/ARCHETYPE_ONE/package.json
ROOT/node_modules/ARCHETYPE_TWO/package.json
```

Say we have a `.builderrc` like:

```yaml
---
archetypes:
  - ARCHETYPE_ONE
  - ARCHETYPE_TWO
```

The resolution order for a `script` task (say, `foo`) present in all three
`package.json`'s would be the following:

* Look through `ROOT/package.json` then the configured archetypes in _reverse_
  order: `ARCHETYPE_TWO/package.json`, then `ARCHETYPE_ONE/package.json` for
  a matching task `foo`
* If found `foo`, check if it is a "passthrough" task, which means it delegates
  to a later instance -- basically `"foo": "builder run foo"`. If so, then look
  to next instance of task found in order above.

### Special Archetype Tasks

Archetypes use conventional `scripts` task names, except for the following
special cases:

* `"npm:postinstall"`
* `"npm:preversion"`
* `"npm:version"`
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
```

## Tips, Tricks, & Notes

### Project Root

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
an archetype may need to use `process.cwd()` and be constrained to **only**
ever running from the project root. Some scenarios where the `process.cwd()`
path base is necessary include:

* Webpack entry points, aliases
* Karma included files (that cannot be `require.resolve`-ed)

### Other Process Execution

The execution of tasks generally must _originate_ from Builder, because of all
of the environment enhancements it adds. So, for things that themselves exec
or spawn processes, like `concurrently`, this can be a problem. Typically, you
will need to have the actual command line processes invoked _by_ Builder.

### Terminal Color

Builder uses `exec` under the hood with piped `stdout` and `stderr`. Programs
typically interpret the piped environment as "doesn't support color" and
disable color. Consequently, you typically need to set a "**force color**"
option on your executables in `scripts` commands if they exist.

### Why Exec?

So, why `exec` and not `spawn` or something similar that has a lot more process
control and flexibility? The answer lies in the fact that most of what Builder
consumes is shell strings to execute, like `script --foo --bar "Hi there"`.
_Parsing_ these arguments into something easily consumable by `spawn` and always
correct is quite challenging. `exec` works easily with straight strings, and
since that is the target of `scripts` commands, that is what we use for Builder.

### I Give Up. How Do I Abandon Builder?

Builder is designed to be as close to vanilla npm as possible. So, if for
example you were using the `builder-react-component` archetype with a project
`package.json` like:

```js
"scripts": {
  "postinstall": "builder run npm:postinstall",
  "preversion": "builder run npm:preversion",
  "version": "builder run npm:version",
  "test": "builder run npm:test",
  /* other deps */
},
"dependencies": {
  "builder": "v2.0.0",
  "builder-react-component": "v0.0.5",
  /* other deps */
},
"devDependencies": {
  "builder-react-component-dev": "v0.0.5",
  /* other deps */
}
```

and decided to _no longer_ use Builder, here is a rough set of steps to unpack
the archetype into your project and remove all Builder dependencies:

* Copy all `ARCHETYPE/package.json:dependencies` to your
  `PROJECT/package.json:dependencies` (e.g., from `builder-react-component`).
  You _do not_ need to copy over `ARCHETYPE/package.json:devDependencies`.
* Copy all `ARCHETYPE/package.json:scripts` to your
  `PROJECT/package.json:scripts` that do not begin with the `builder:` prefix.
  Remove the `npm:` prefix from any `scripts` tasks and note that you may have
  to manually resolve tasks of the same name within the archetype and also with
  your project.
* Copy all `ARCHETYPE-dev/package.json:dependencies` to your
  `PROJECT/package.json:devDependencies`
  (e.g., from `builder-react-component-dev`)
* Copy all configuration files used in your `ARCHETYPE` into the root project.
  For example, for `builder-react-component` you would need to copy the
  `builder-react-component/config` directory to `PROJECT/config` (or a renamed
  directory).
* Review all of the combined `scripts` tasks and:
    * resolve duplicate tasks names
    * revise configuration file paths for the moved files
    * replace instances of `builder run <task>` with `npm run <task>`
    * for `builder concurrent <task1> <task2>` tasks, first install the
      `concurrently` package and then rewrite to:
      `concurrent 'npm run <task1>' 'npm run <task2>'`

... and (with assuredly a few minor hiccups) that's about it! You are
Builder-free and back to a normal `npm`-controlled project.

### Versions v1, v2, v3

The `builder` project effectively starts at `v2.x.x`. Prior to that Builder was
a small DOM utility that fell into disuse, so we repurposed it for a new
wonderful destiny! But, because we follow semver, that means everything starts
at `v2` and as a helpful tip / warning:

> Treat `v2.x` as a `v0.x` release

We'll try hard to keep it tight, but at our current velocity there are likely
to be some bumps and API changes that won't adhere strictly to semver until
things settle down in `v3.x`-on.

[builder-react-component]: https://github.com/FormidableLabs/builder-react-component
[trav_img]: https://api.travis-ci.org/FormidableLabs/builder.svg
[trav_site]: https://travis-ci.org/FormidableLabs/builder
[cov]: https://coveralls.io
[cov_img]: https://img.shields.io/coveralls/FormidableLabs/builder.svg
[cov_site]: https://coveralls.io/r/FormidableLabs/builder
