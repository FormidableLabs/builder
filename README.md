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

* A React component
* A React application server
* A Chai / jQuery / VanillaJS widget

Archetypes typically provide:

* `package.json`: Pre-defined `scripts` for common use cases of building,
  linting, testing, etc.
* `config/`: Configuration files for the common use cases.

In most cases, you won't need to override anything. But, if you do, pick the
most granular `scripts` command in the archetype you need to override and
define _just that_ in your project's `package.json` `script` section. Copy
any configuration files that you need to tweak and re-define the command.

**TODO: Document more.**

**TODO: Give actual override _example_**

**TODO: How to install / configure an archetype**
