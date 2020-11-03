# xast-util-from-xml

[![Build][build-badge]][build]
[![Coverage][coverage-badge]][coverage]
[![Downloads][downloads-badge]][downloads]
[![Size][size-badge]][size]
[![Sponsors][sponsors-badge]][collective]
[![Backers][backers-badge]][collective]
[![Chat][chat-badge]][chat]

**[xast][]** utility to parse from XML.

## Install

[npm][]:

```sh
npm install xast-util-from-xml
```

## Use

Say we have the following XML file, `example.xml`:

```xml
<album id="123">
  <name>Born in the U.S.A.</name>
  <artist>Bruce Springsteen</artist>
  <releasedate>1984-04-06</releasedate>
</album>
```

And our script, `example.js`, looks as follows:

```js
var fs = require('fs')
var fromXml = require('xast-util-from-xml')

var doc = fs.readFileSync('example.xml')

var tree = fromXml(doc)

console.log(tree)
```

Now, running `node example` yields (positional info removed for brevity):

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

### `fromXml(doc)`

Parse XML to a **[xast][]** tree.

##### Parameters

###### `doc`

Value to parse (`string` or `Buffer` in UTF-8).

##### Returns

[`Root`][root].

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

See [`contributing.md` in `syntax-tree/.github`][contributing] for ways to get
started.
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

[license]: license

[author]: https://wooorm.com

[contributing]: https://github.com/syntax-tree/.github/blob/HEAD/contributing.md

[support]: https://github.com/syntax-tree/.github/blob/HEAD/support.md

[coc]: https://github.com/syntax-tree/.github/blob/HEAD/code-of-conduct.md

[xast]: https://github.com/syntax-tree/xast

[root]: https://github.com/syntax-tree/xast#root
