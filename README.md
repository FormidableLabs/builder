[![Travis Status][trav_img]][trav_site]

Builder
=======

Builder is a task runner.

Builder is an enhancement to `npm run TASK`.

Builder is a meta-tool for all your common build, quality, and test tasks.

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
intend to use. For example, here we install `builder` and the
[builder-react-component][] archetype:

```sh
$ npm install --save builder builder-react-component
```

and then edit `.builderrc` like:

```yaml
---
archetypes:
  - builder-react-component
```

to add archetypes. At this point, `builder` can build any production tasks,
as only production `dependencies` of archetypes are installed. However, if
you are in a **development** or CI environment, an additional manual step
is needed to install the `devDependencies` of all the archetypes:

```sh
$ builder install
```

#### Builder Commands

Display help.

```sh
$ builder help
```

Install archetype `devDependencies`.

```sh
$ builder install
```

Run a single `package.json` `scripts` task.

```sh
$ builder run foo-task
```

Run multiple `package.json` `scripts` tasks.

```sh
$ builder concurrent foo-task bar-task baz-task
```


## Tasks

The underyling concept here is that `builder` `script` commands simply _are_
NPM-friendly `package.json` `script` commands. Pretty much anything that you
can execute with `npm run FOO` can be executed with `builder run FOO`.

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

### Pre-v2 Versions

The `builder` project effectively starts at `v2.x.x`. Prior to that Builder was
a small DOM utility that fell into disuse, so we repurposed it for a new
wonderful destiny! But, because we follow semver, that means everything starts
at `v2`.

[builder-react-component]: https://github.com/FormidableLabs/builder-react-component
[trav_img]: https://api.travis-ci.org/FormidableLabs/builder.svg
[trav_site]: https://travis-ci.org/FormidableLabs/builder
