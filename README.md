[![Travis Status][trav_img]][trav_site]
[![Coverage Status][cov_img]][cov_site]

Builder
=======

Builder takes your `npm` tasks and makes them composable, controllable from
a single point, and flexible.

`npm` is fantastic for controlling tasks (via `scripts`) and general project
workflows. But a project-specific `package.json` simply doesn't scale when
you're managing many (say 5-50) very similar repositories.

_Enter Builder._ Builder is "almost" `npm`, but provides for off-the-shelf
"archetypes" to provide central sets of `package.json` `scripts` tasks, and
`dependencies` and `devDependencies` for those tasks. The rest of this page will
dive into the details and machinations of the tool, but first here are a few of
the rough goals and motivations behind the project.

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
* **A Few "Nice to Haves" Over `npm run <task>`**: Setting aside archetypes and
  multi-project management, `builder` provides cross-OS compatible helpers for
  common task running scenarios like concurrent execution (`concurrent`) and
  spawning the _same_ tasks in parallel with different environment variables
  (`env`). It also provides useful controls for task retries, buffered output,
  setup tasks, etc.

## Overview

At a high level `builder` is a tool for consuming `package.json` `scripts`
commands, providing sensible / flexible defaults, and supporting various scenarios
("archetypes") for your common use cases across multiple projects.

Builder is not opinionated, although archetypes _are_ and typically dictate
file structure, standard configurations, and dev workflows. Builder supports
this in an agnostic way, providing essentially the following:

* `NODE_PATH`, `PATH` enhancements to run, build, import from archetypes so
  task dependencies and configurations don't have to be installed directly in a
  root project.
* A task runner capable of single tasks (`run`) or multiple concurrent tasks
  (`concurrent`).
* An intelligent merging of `package.json` `scripts` tasks.

... and that's about it!

### Usage

To start using builder, install and save `builder` and any archetypes you
intend to use. We'll use the [builder-react-component][] archetype as an
example.

**Note**: Most archetypes have an `ARCHETYPE` package and parallel
`ARCHETYPE-dev` npm package. The `ARCHETYPE` package contains _almost_
everything needed for the archetype (prod dependencies, scripts, etc.) except
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

To help you keep up with project-specific builder requirements, a globally-installed
`builder` will detect if a locally-installed version of `builder` is
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

However, to call `builder` from the command line you will either need to either
augment `PATH` or call the long form of the command:

##### PATH Augmentation

Our recommended approach is to augment your `PATH` variable with a shell
configuration as follows:

**Mac / Linux**

```sh
# Safer version, but if you _have_ global installs, those come first.
export PATH="${PATH}:./node_modules/.bin"

# (OR) Less safe, but guarantees local node modules come first.
export PATH="./node_modules/.bin:${PATH}"

# Check results with:
echo $PATH
```

To make these changes **permanent**, add the `export` command to your `.bashrc`
or analogous shell configuration file.

**Windows**

```sh
# Safer version, but if you _have_ global installs, those come first.
set PATH=%PATH%;node_modules\.bin

# (OR) Less safe, but guarantees local node modules come first.
set PATH=node_modules\.bin;%PATH%

# Check results with:
echo %PATH%
```

To make these changes **permanent**, please see this multi-OS article on
changing the `PATH` variable: https://www.java.com/en/download/help/path.xml
(the article is targeted for a Java executable, but it's analogous to our
situation). You'll want to paste in `;node_modules\.bin` at the end _or_
`node_modules\.bin;` at the beginning of the PATH field in the gui. If there
is no existing `PATH` then add a user entry with `node_modules\.bin` as a value.
(It is unlikely to be empty because an `npm` installation on Windows sets the
user `PATH` analogously.)

##### Full Path Invocation

Or you can run the complete path to the builder script with:

**Mac / Linux**

```sh
node_modules/.bin/builder <action> <task>
```

**Windows**

```sh
node_modules\.bin\builder <action> <task>
```

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
$ builder [-h|--help|help]
$ builder help <action>
$ builder help <archetype>
```

Run `builder help <action>` for all available options. Version information is
available with:

```sh
$ builder [-v|--version]
```

Let's dive a little deeper into the main builder actions:

##### builder run

Run a single task from `script`. Analogous to `npm run <task>`

```sh
$ builder run <task>
```

Flags:

* `--tries`: Number of times to attempt a task (default: `1`)
* `--setup`: Single task to run for the entirety of `<action>`
* `--quiet`: Silence logging
* `--log-level`: Level to log at (`info`, `warn`, `error`, `none`)
* `--expand-archetype`: Expand `node_modules/<archetype>` with full path (default: `false`)
* `--builderrc`: Path to builder config file (default: `.builderrc`)

##### builder concurrent

Run multiple tasks from `script` concurrently. Roughly analogous to
`npm run <task1> & npm run <task2> & npm run <task3>`, but kills all processes on
first non-zero exit (which makes it suitable for test tasks), unless `--no-bail`
is provided.

```sh
$ builder concurrent <task1> <task2> <task3>
```

Flags:

* `--tries`: Number of times to attempt a task (default: `1`)
* `--setup`: Single task to run for the entirety of `<action>`
* `--queue`: Number of concurrent processes to run (default: unlimited - `0|null`)
* `--[no-]buffer`: Buffer output until process end (default: `false`)
* `--[no-]bail`: End all processes after the first failure (default: `true`)
* `--quiet`: Silence logging
* `--log-level`: Level to log at (`info`, `warn`, `error`, `none`)
* `--expand-archetype`: Expand `node_modules/<archetype>` with full path (default: `false`)
* `--builderrc`: Path to builder config file (default: `.builderrc`)

Note that `tries` will retry _individual_ tasks that are part of the concurrent
group, not the group itself. So, if `builder concurrent --tries=3 foo bar baz`
is run and bar fails twice, then only `bar` would be retried. `foo` and `baz`
would only execute _once_ if successful.

##### builder envs

Run a single task from `script` concurrently for each item in an array of different
environment variables. Roughly analogous to:

```sh
$ FOO=VAL1 npm run <task> & FOO=VAL2 npm run <task> & FOO=VAL3 npm run <task>
```

... but kills all processes on first non-zero exit (which makes it suitable for
test tasks), unless `--no-bail` is provided. Usage:

```sh
$ builder envs <task> <json-array>
$ builder envs <task> --envs-path=<path-to-json-file>
```

Examples:

```sh
$ builder envs <task> '[{ "FOO": "VAL1" }, { "FOO": "VAL2" }, { "FOO": "VAL3" }]'
$ builder envs <task> '[{ "FOO": "VAL1", "BAR": "VAL2" }, { "FOO": "VAL3" }]'
```

Flags:

* `--tries`: Number of times to attempt a task (default: `1`)
* `--setup`: Single task to run for the entirety of `<action>`
* `--queue`: Number of concurrent processes to run (default: unlimited - `0|null`)
* `--[no-]buffer`: Buffer output until process end (default: `false`)
* `--[no-]bail`: End all processes after the first failure (default: `true`)
* `--envs-path`: Path to JSON env variable array file (default: `null`)
* `--quiet`: Silence logging
* `--log-level`: Level to log at (`info`, `warn`, `error`, `none`)
* `--expand-archetype`: Expand `node_modules/<archetype>` with full path (default: `false`)
* `--builderrc`: Path to builder config file (default: `.builderrc`)

_Note_: The environments JSON array will overwrite **existing** values in the
environment.

###### Custom Flags

Just like [`npm run <task> [-- <args>...]`](https://docs.npmjs.com/cli/run-script),
flags after a ` -- ` token in a builder task or from the command line are passed
on to the underlying tasks. This is slightly more complicated for builder in
that composed tasks pass on the flags _all the way down_. So, for tasks like:

```js
"scripts": {
  "down": "echo down",
  "way": "builder run down -- --way",
  "the": "builder run way -- --the",
  "all": "builder run the -- --all"
}
```

We can run some basics (alone and with a user-added flag):

```sh
$ builder run down
down

$ builder run down -- --my-custom-flag
down --my-custom-flag
```

If we run the composed commands, the `--` flags are accumulated:

```sh
$ builder run all
down --way --the --all

$ builder run all -- --my-custom-flag
down --way --the --all --my-custom-flag
```

The rough heuristic here is if we have custom arguments:

1. If a `builder <action>` command, pass through using builder-specific
   environment variables. (Builder uses `_BUILDER_ARGS_CUSTOM_FLAGS`).
2. If a non-`builder` command, then append without ` -- ` token.

###### Expanding the Archetype Path

Builder tasks often refer to configuration files in the archetype itself like:

```js
"postinstall": "webpack --bail --config node_modules/<archetype>/config/webpack/webpack.config.js",
```

In npm v2 this wasn't a problem because dependencies were usually nested. In
npm v3, this all changes with aggressive
[flattening](https://docs.npmjs.com/cli/dedupe) of dependencies. With flattened
dependencies, the chance that the archetype and its dependencies no longer have
a predictable contained structure increases.

Thus, commands like the above succeed if the installation ends up like:

```
node_modules/
  <a module>/
    node_modules/
      <archetype>/
        node_modules/
          webpack/
```

If npm flattens the tree like:

```
node_modules/
  <a module>/
  <archetype>/
  webpack/
```

Then `builder` can still find `webpack` due to its `PATH` and `NODE_PATH`
mutations. But an issue arises with something like a `postinstall` step after
this flattening in that the current working directory of the process will be
`PATH/TO/node_modules/<a module>/`, which in this flattened scenario would
**not** find the file:

```
node_modules/<archetype>/config/webpack/webpack.config.js
```

because relative to `node_modules/<a module>/` it is now at:

```
../<archetype>/config/webpack/webpack.config.js
```

To address this problem `builder` has an `--expand-archetype` flag that will
replace an occurrence of the specific `node_modules/<archetype>` in one of the
archetype commands with the _full path_ to the archetype, to guarantee
referenced files are correctly available.

The basic heuristic of things to replace is:

* `^node_modules/<archetype>`: Token is very first string.
* `[\s\t]node_modules/<archetype>`: Whitespace before token.
* `['"]node_modules/<archetype>`: Quotes before token.
    * _Note_ that the path coming back from the underlying
     `require.resolve(module)` will likely be escaped, so things like
     whitespace in a path + quotes around it may not expand correctly.

Some notes:

* The only real scenario you'll need this is for a module that needs to run
  a `postinstall` or something as part of an install in a larger project.
  Root git clone projects controlled by an archetype should work just fine
  because the archetype will be predictably located at:
  `node_modules/<archetype>`
* The `--expand-archetype` flag gets propagated down to all composed `builder`
  commands internally.
* The `--expand-archetype` only expands the specific archetype string for its
  **own** commands and not those in the root projects or other archetypes.
* The replacement assumes you are using `/` forward slash characters which
  are the recommended cross-platform way to construct file paths (even on
  windows).
* The replacement only replaces at the _start_ of a command string or after
  whitespace. This means it _won't_ replace `../node_modules/<archetype>` or
  even `./node_modules/<archetype>`. (In the last case, just omit the `./`
  in front of a path -- it's a great habit to pick up as `./` breaks on Windows
  and omitting `./` works on all platforms!)

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


## npm Config

`builder` supports `package.json` `config` properties the same way that `npm`
does, with slight enhancements in consideration of multiple `package.json`'s
in play.

### `npm` Config Overview

As a refresher, `npm` utilizes the `config` field of `package.json` to make
"per-package" environment variables to `scripts` tasks. For example, if you
have:

```js
{
  "config": {
    "my_name": "Bob"
  },
  "scripts": {
    "get-name": "echo Hello, ${npm_package_config_my_name}."
  }
}
```

and ran:

```sh
$ npm run get-name
Hello, Bob.
```

More documentation about how `npm` does per-package configuration is at:

* https://docs.npmjs.com/files/package.json#config
* https://docs.npmjs.com/misc/config#per-package-config-settings


### Builder Configs

In `builder`, for a single `package.json` this works essentially the same in
the above example.

```sh
$ builder run get-name
Hello, Bob.
```

However, `builder` has the added complexity of adding in `config` variables
from archetypes and the environment. So the basic resolution order for a
config environment variable is:

1. Look to `npm_package_config_<VAR_NAME>=<VAR_VAL>` on command line.
2. If not set, then use `<root>/package.json:config:<VAR_NAME>` value.
3. If not set, then use `<archetype>/package.json:config:<VAR_NAME>` value.

So, let's dive in to a slightly more complex example:

```js
// <archetype>/package.json
{
  "config": {
    "my_name": "ARCH BOB"
  },
  "scripts": {
    "get-name": "echo Hello, ${npm_package_config_my_name}."
  }
}

// <root>/package.json
{
  "config": {
    "my_name": "ROOT JANE"
  }
}
```

When we run the `builder` command, the `<root>` value overrides:

```sh
$ builder run get-name
Hello, ROOT JANE.
```

We can inject a command line flag to override even this value:

```sh
$ npm_package_config_my_name="CLI JOE" builder run get-name
Hello, CLI JOE.
```

_Note_ that the ability to override via the process environment is unique
to `builder` and not available in real `npm`.

### Config Notes

#### Tip - Use String Values

Although `config` properties can be something like:

```js
"config": {
  "enabled": true
}
```

We strongly recommend that you always set _strings_ like:

```js
"config": {
  "enabled": "true"
}
```

And deal just with _string values_ in your tasks, and files. The reasoning here
is that when overriding values from the command line, the values will always
be strings, which has a potential for messy, hard-to-diagnose bugs if the
overridden value is not also a string.

#### npmrc Configuration

`npm` has additional functionality for `config` values that are **not**
presently supported, such as issuing commands like
`npm config set <pkg-name>:my_name Bill` that store values in `~/.npmrc` and
then override the `package.json` values at execution time. We _may_ extend
support for this as well, but not at the present.

#### Command Line Environment Variables

`npm` does **not** support overriding `config` environment variables from the
actual environment. So doing something in our original example like:

```sh
$ npm_package_config_my_name=George npm run get-name
Hello, Bob.
```

In fact, npm will refuse to even add environment variables starting with
`npm_package_config` to the `npm run` environment. E.g.

```js
{
  "config": {},
  "scripts": {
    "get-npm-val": "echo NPM VAR: ${npm_package_config_var}",
    "get-env-val": "echo ENV VAR: ${env_var}"
  }
}
```

The `npm` config variable doesn't make it through:

```sh
$ npm_package_config_var=SET npm run get-npm-val
NPM VAR:
```

While a normal environment variable will:

```sh
$ env_var=SET npm run get-env-val
ENV VAR: SET
```

By contrast, `builder` _does_ pass through environment variables already
existing on the command line, and moreover those overrides takes precedence over
the root and archetype package.json values. Those same examples with `builder`
show that the environment variables _do_ make it through:

```sh
$ npm_package_config_var=SET builder run get-npm-val
NPM VAR: SET

$ env_var=SET builder run get-env-val
ENV VAR: SET
```

Things are a little more complex when using with `builder envs`, but the
rough rule is that the environment JSON array wins when specified, otherwise
the existing environment is used:

```sh
$ npm_package_config_var=CLI builder envs get-npm-val --queue=1 \
  '[{}, {"npm_package_config_var":"This Overrides"}]'
NPM VAR: CLI
NPM VAR: This Overrides
```

## Archetypes

Archetypes deal with common scenarios for your projects. Like:

* [builder-react-component][]: A React component
* A React application server
* A Chai / jQuery / VanillaJS widget

Archetypes typically provide:

* A `package.json` with `builder`-friendly `script` tasks.
* Dependencies and dev dependencies for all of the archetype `script` tasks.
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
* If found `foo`, check if it is a "pass-through" task, which means it delegates
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

We strongly recommend entirely
[avoiding npm lifecycle task names](#avoid-npm-lifecycle-commands)
in your archetype `package.json` files. So, instead of having:

```js
// <archetype>/package.json
// Bad
"test": "builder concurrent --buffer test-frontend test-backend"
```

We recommend something like:

```js
// <archetype>/package.json
// Good / OK
"npm:test": "builder run test-all",
"test-all": "builder concurrent --buffer test-frontend test-backend"

// Also OK
"npm:test": "builder concurrent --buffer test-frontend test-backend"
```

and then in your `<root>/package.json` using the _real_ lifecycle task name.

```js
"test": "builder run npm:test"
```

### Creating an Archetype

Moving common tasks into an archetype is fairly straightforward and requires
just a few tweaks to the paths defined in configuration and scripts in order
to work correctly.

#### Initializing your project

An archetype is simply a standard npm module with a valid `package.json`. To set
up a new archetype from scratch, make a directory for your new archetype,
initialize `npm` and link it for ease of development.

```sh
$ cd path/to/new/archetype
$ npm init
$ npm link
```

From your consuming project, you can now link to the archetype directly for ease
of development after including it in your `dependencies` and creating a
`.builderrc` as outlined above in [configuration](#configuration).

```sh
$ cd path/to/consuming/project
$ npm link new-archetype-name
```

#### Managing the `dev` Archetype

Because `builder` archetypes are included as simple npm modules, two separate
npm modules are required for archetypes: one for normal dependencies and one for
dev dependencies. Whereas in a non-builder-archetype project you'd specify dev
dependencies in `devDependencies`, with `builder` all dev dependencies must be
regular `dependencies` on a separate dev npm module.

`builder` is designed so that when defining which archetypes to use in a
consuming project's `.builderrc`, `builder` will look for two modules, one named
appropriately in `dependencies` (ex: `my-archetype`) and one in
`devDependencies` but with `-dev` appended to the name (ex: `my-archetype-dev`).

To help with managing these while building a builder archetype, install
[`builder-support`](https://github.com/FormidableLabs/builder-support)
to create and manage a `dev/` directory within your archetype project with it's
own `package.json` which can be published as a separate npm module.
`builder-support` will not only create a `dev/package.json` with an appropriate
package name, but will also keep all the other information from your archetype's
primary `package.json` up to date as well as keep `README.md` and `.gitignore`
in parity for hosting the project as a separate npm module.

Get started by installing and running `builder-support gen-dev`:

```sh
$ npm install builder-support --save-dev
$ ./node_modules/.bin/builder-support gen-dev
```

_TIP: Create a task called `"builder:gen-dev": "builder-support gen-dev"` in
your archetype to avoid having to type out the full path each time you update
your project's details._

For ease of development, `npm link` the dev dependency separately:

```sh
$ cd dev
$ npm link
```

Then from your consuming project, you can link to the dev package.

```sh
$ cd path/to/consuming/project
$ npm link new-archetype-name-dev
```

Read the [`builder-support` docs](https://github.com/FormidableLabs/builder-support)
to learn more about how dev archetypes are easily managed with
`builder-support gen-dev`.

#### NOTE: Application vs. Archetype Dependencies

While we would love to have `builder` manage _all_ the dependencies of an
application, the practical realities of how npm works is that archetypes can
only manage dependencies for `scripts` commands **run by a `builder` command**.
`builder` mutates `PATH` and `NODE_PATH` to include archetype dependencies, but
without this `builder` magic, ordinary code won't otherwise be able to use
archetype dependencies.

Most notably, this means that if your _application_ code includes a dependency
like `lodash`:

```js
// <root>/src/index.js
var _ = require("lodash");

module.exports = _.camelCase("Hi There");
```

and the root project is consumed in _anything besides a `builder` command_,
then it **must** have a dependency like:

```js
// <root>/package.json
"dependencies": {
  "lodash": "^4.2.1"
}
```

And, _even if_ your `<archetype>/package.json` also includes the exact same
dependency.

This rule applies to even simple scenarios such as the root project being
published to npm, after which other users will rely on the code outside of
`builder` processes.

#### Moving `dependencies` and `scripts` to a New Archetype

Once everything is configured and `npm link`'d, it should be easy to move
scripts to your archetype and quickly test them out from a consuming project.

##### Moving `dependencies` and `devDependencies` from an Existing `package.json`

* copy `dependencies` to `package.json` `dependencies`.
* copy `devDependencies` to `dev/package.json` `dependencies`.

_Note_ that you should only copy `dependencies` from `<root>/package.json` to
`<archetype>/package.json` that are needed within the archetype itself for:

* Execution of a script. (E.g., the `istanbul` script).
* Required by a configuration file in the archetype. (E.g., `webpack` if a
  webpack configuration calls `require("webpack")`).

You can then remove any dependencies _only_ used by the `scripts` tasks that
you have moved to the archetype. However, take care to
[not remove real application dependencies](#note-application-vs-archetype-dependencies).

##### Moving `scripts` and Config Files

All scripts defined in archetypes will be run from the root of the project
consuming the archetype. This means you have to change all paths in your scripts
to reference their new location within the archetype.

An example script and config you may be moving to an archetype would look like:

```js
"test-server-unit": "mocha --opts test/server/mocha.opts test/server/spec"
```

When moving this script to an archetype, we'd also move the config from
`test/server/mocha.opts` within the original project to within the
archetype such as `config/mocha/server/mocha.opts`.

For this example script, we'd need to update the path to `mocha.opts` as so:

```js
"test-server-unit": "mocha --opts node_modules/new-archetype-name/config/mocha/server/mocha.opts test/server/spec"
```

Any paths that reference files expected in the consuming app (in this example
`test/server/spec`) do not need to change.

##### Updating Path and Module References in Config Files

Any JavaScript files run from within an archetype (such as config files) require
a few changes related to paths now that the files are being run from within
an npm module. This includes all `require()` calls referencing npm modules and
all paths to files that aren't relative.

For example, `karma.conf.js`:

```js
module.exports = function (config) {
  require("./karma.conf.dev")(config);

  config.set({
    preprocessors: {
      "test/client/main.js": ["webpack"]
    },
    files: [
      "sinon/pkg/sinon",
      "test/client/main.js"
    ],
  });
};
```

All non-relative paths to files and npm modules need to be full paths, even ones
not in the archetype directory. For files expected to be in the consuming
project, this can be achieved by prepending `process.cwd()` to all paths. For
npm modules, full paths can be achieved by using
[`require.resolve()`](https://nodejs.org/api/globals.html#globals_require_resolve).

An updated config might look like:

```js
var path = require("path");
var ROOT = process.cwd();
var MAIN_PATH = path.join(ROOT, "test/client/main.js");

module.exports = function (config) {
  require("./karma.conf.dev")(config);

  config.set({
    preprocessors: {
      [MAIN_PATH]: ["webpack"]
    },
    files: [
      require.resolve("sinon/pkg/sinon"),
      MAIN_PATH
    ],
  });
};
```

#### Example `builder` Archetype Project Structure

```
.
├── CONTRIBUTING.md
├── HISTORY.md
├── LICENSE.txt
├── README.md
├── config
│   ├── eslint
│   ├── karma
│   ├── mocha
│   │   ├── func
│   │   │   ├── mocha.dev.opts
│   │   │   └── mocha.opts
│   │   └── server
│   │       └── mocha.opts
│   └── webpack
│       ├── webpack.config.coverage.js
│       ├── webpack.config.dev.js
│       ├── webpack.config.hot.js
│       ├── webpack.config.js
│       └── webpack.config.test.js
├── dev
│   └── package.json
└── package.json
```

## Tips, Tricks, & Notes

### PATH, NODE_PATH Resolution

Builder uses some magic to enhance `PATH` and `NODE_PATH` to look in the
installed modules of builder archetypes and in the root of your project (per
normal). We mutate both of these environment variables to resolve in the
following order:

`PATH`:

1. `<cwd>/node_modules/<archetype>/.bin`
2. `<cwd>/node_modules/.bin`
3. Existing `PATH`

`NODE_PATH`:

1. `<cwd>/node_modules/<archetype>/node_modules`
2. `<cwd>/node_modules`
3. Existing `NODE_PATH`

The order of resolution doesn't often come up, but can sometimes be a factor
in diagnosing archetype issues and script / file paths, especially when using
`npm` v3.

### Project Root

The enhancements to `NODE_PATH` that `builder` performs can throw tools /
libraries for a loop. Generally speaking, we recommend using
`require.resolve("LIBRARY_OR_REQUIRE_PATH")` to get the appropriate installed
file path to a dependency.

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

### Avoid npm Lifecycle Commands

We recommend _not_ using any of the special `npm` `scripts` commands listed in
https://docs.npmjs.com/misc/scripts such as:

* prepublish, postinstall
* test
* stop, start

in your archetype `scripts`. This is due to the fact that the archetype
`package.json` files are themselves consumed by `npm` for publishing (which
can lead to tasks executing for the _archetype_ instead of the project _using_
the archetype) and potentially lead to awkward recursive composed task
scenarios.

Instead, we recommend adding an `npm:<task>` prefix to your tasks to identify
them as usable in root projects for real `npm` lifecycle tasks.

We plan on issuing warnings for archetypes that do implement lifecycle tasks
in: https://github.com/FormidableLabs/builder/issues/81

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
* Copy all `ARCHETYPE/package.json:config` variables to your
  `PROJECT/package.json:config`.
* Copy all `ARCHETYPE-dev/package.json:dependencies` to your
  `PROJECT/package.json:devDependencies`
  (e.g., from `builder-react-component-dev`)
* Copy all configuration files used in your `ARCHETYPE` into the root project.
  For example, for `builder-react-component` you would need to copy the
  `builder-react-component/config` directory to `PROJECT/config` (or a renamed
  directory).
* Review all of the combined `scripts` tasks and:
    * resolve duplicate task names
    * revise configuration file paths for the moved files
    * replace instances of `builder run <task>` with `npm run <task>`
    * for `builder concurrent <task1> <task2>` tasks, first install the
      `concurrently` package and then rewrite to:
      `concurrent 'npm run <task1>' 'npm run <task2>'`

... and (with assuredly a few minor hiccups) that's about it! You are
Builder-free and back to a normal `npm`-controlled project.

### Versions v1, v2, v3

The `builder` project effectively starts at `v2.x.x`. Prior to that Builder was
a small DOM utility that fell into disuse, so we re-purposed it for a new
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
