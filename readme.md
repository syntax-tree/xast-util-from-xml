# xast-util-from-xml

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

[xast][] utility to parse from XML.

## Contents

*   [What is this?](#what-is-this)
*   [When should I use this?](#when-should-i-use-this)
*   [Install](#install)
*   [Use](#use)
*   [API](#api)
    *   [`fromXml(value)`](#fromxmlvalue)
*   [Types](#types)
*   [Compatibility](#compatibility)
*   [Security](#security)
*   [Related](#related)
*   [Contribute](#contribute)
*   [License](#license)

## What is this?

This package is a utility that takes XML input and turns it into a [xast][]
syntax tree.
It uses [`sax`][sax], which turns XML into events, while it turns those events
into nodes.

## When should I use this?

If you want to handle syntax trees, use this.
Use [`sax`][sax] itself instead when you want to do other things.

The utility [`xast-util-to-xml`][xast-util-to-xml] does the inverse of this
utility.
It turns xast into XML.

## Install

This package is [ESM only][esm].
In Node.js (version 12.20+, 14.14+, 16.0+, or 18.0+), install with [npm][]:

```sh
npm install xast-util-from-xml
```

In Deno with [`esm.sh`][esmsh]:

```js
import {fromXml} from 'https://esm.sh/xast-util-from-xml@2'
```

In browsers with [`esm.sh`][esmsh]:

```html
<script type="module">
  import {fromXml} from 'https://esm.sh/xast-util-from-xml@2?bundle'
</script>
```

## Use

Say our document `example.xml` contains:

```xml
<album id="123">
  <name>Born in the U.S.A.</name>
  <artist>Bruce Springsteen</artist>
  <releasedate>1984-04-06</releasedate>
</album>
```

…and our module `example.js` looks as follows:

```js
import fs from 'node:fs/promises'
import {fromXml} from 'xast-util-from-xml'

const tree = fromXml(await fs.readFile('example.xml'))

console.log(tree)
```

…now running `node example.js` yields (positional info removed for brevity):

```js
{
  type: 'root',
  children: [
    {
      type: 'element',
      name: 'album',
      attributes: {id: '123'},
      children: [
        {type: 'text', value: '\n  '},
        {
          type: 'element',
          name: 'name',
          attributes: {},
          children: [{type: 'text', value: 'Born in the U.S.A.'}]
        },
        {type: 'text', value: '\n  '},
        {
          type: 'element',
          name: 'artist',
          attributes: {},
          children: [{type: 'text', value: 'Bruce Springsteen'}]
        },
        {type: 'text', value: '\n  '},
        {
          type: 'element',
          name: 'releasedate',
          attributes: {},
          children: [{type: 'text', value: '1984-04-06'}]
        },
        {type: 'text', value: '\n'}
      ]
    },
    {type: 'text', value: '\n'}
  ]
}
```

## API

This package exports the identifier `fromXml`.
There is no default export.

### `fromXml(value)`

Turn XML into a syntax tree.

##### Parameters

###### `value`

Value to parse (`string` or `Buffer` in UTF-8).

##### Returns

[`Root`][root].

## Types

This package is fully typed with [TypeScript][].
It exports no additional types.

## Compatibility

Projects maintained by the unified collective are compatible with all maintained
versions of Node.js.
As of now, that is Node.js 12.20+, 14.14+, 16.0+, and 18.0+.
Our projects sometimes work with older versions, but this is not guaranteed.

## Security

XML can be a dangerous language: don’t trust user-provided data.

## Related

*   [`xast-util-to-xml`](https://github.com/syntax-tree/xast-util-to-xml)
    — serialize xast to XML
*   [`hast-util-to-xast`](https://github.com/syntax-tree/hast-util-to-xast)
    — transform hast (html, svg) to xast (xml)
*   [`xastscript`](https://github.com/syntax-tree/xastscript)
    — create xast trees

## Contribute

See [`contributing.md`][contributing] in [`syntax-tree/.github`][health] for
ways to get started.
See [`support.md`][support] for ways to get help.

This project has a [code of conduct][coc].
By interacting with this repository, organization, or community you agree to
abide by its terms.

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[build-badge]: https://github.com/syntax-tree/xast-util-from-xml/workflows/main/badge.svg

[build]: https://github.com/syntax-tree/xast-util-from-xml/actions

[coverage-badge]: https://img.shields.io/codecov/c/github/syntax-tree/xast-util-from-xml.svg

[coverage]: https://codecov.io/github/syntax-tree/xast-util-from-xml

[downloads-badge]: https://img.shields.io/npm/dm/xast-util-from-xml.svg

[downloads]: https://www.npmjs.com/package/xast-util-from-xml

[size-badge]: https://img.shields.io/bundlephobia/minzip/xast-util-from-xml.svg

[size]: https://bundlephobia.com/result?p=xast-util-from-xml

[sponsors-badge]: https://opencollective.com/unified/sponsors/badge.svg

[backers-badge]: https://opencollective.com/unified/backers/badge.svg

[collective]: https://opencollective.com/unified

[chat-badge]: https://img.shields.io/badge/chat-discussions-success.svg

[chat]: https://github.com/syntax-tree/unist/discussions

[npm]: https://docs.npmjs.com/cli/install

[esm]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c

[esmsh]: https://esm.sh

[typescript]: https://www.typescriptlang.org

[license]: license

[author]: https://wooorm.com

[health]: https://github.com/syntax-tree/.github

[contributing]: https://github.com/syntax-tree/.github/blob/main/contributing.md

[support]: https://github.com/syntax-tree/.github/blob/main/support.md

[coc]: https://github.com/syntax-tree/.github/blob/main/code-of-conduct.md

[xast]: https://github.com/syntax-tree/xast

[root]: https://github.com/syntax-tree/xast#root

[sax]: https://github.com/isaacs/sax-js

[xast-util-to-xml]: https://github.com/syntax-tree/xast-util-to-xml
