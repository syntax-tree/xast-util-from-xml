'use strict'

var fs = require('fs')
var path = require('path')
var test = require('tape')
var negate = require('negate')
var hidden = require('is-hidden')
var fromXml = require('..')

var join = path.join

test('xast-util-from-xml', function(t) {
  t.equal(typeof fromXml, 'function', 'should expose a function')

  try {
    fromXml('<root unquoted=attribute>')
    t.fail('should fail (1)')
  } catch (error) {
    t.deepEqual(
      error,
      {
        message: 'Unquoted attribute value',
        name: '1:17',
        reason: 'Unquoted attribute value',
        line: 1,
        column: 17,
        location: {
          start: {line: 1, column: 17, offset: 16},
          end: {line: null, column: null}
        },
        source: 'xast-util-from-xml',
        ruleId: 'sax'
      },
      'should throw messages'
    )
  }

  try {
    fromXml('<!ENTITY>')
    t.fail('should fail (2)')
  } catch (error) {
    t.deepEqual(
      error,
      {
        message: 'Unexpected SGML declaration',
        name: '1:10',
        reason: 'Unexpected SGML declaration',
        line: 1,
        column: 10,
        location: {
          start: {line: 1, column: 10, offset: 9},
          end: {line: null, column: null}
        },
        source: 'xast-util-from-xml',
        ruleId: 'unexpected-sgml'
      },
      'should throw for SGML directives'
    )
  }

  try {
    fromXml('<root>&foo;</root>')
    t.fail('should fail (3)')
  } catch (error) {
    t.deepEqual(
      error,
      {
        message: 'Invalid character entity',
        name: '1:12',
        reason: 'Invalid character entity',
        line: 1,
        column: 12,
        location: {
          start: {line: 1, column: 12, offset: 11},
          end: {line: null, column: null}
        },
        source: 'xast-util-from-xml',
        ruleId: 'sax'
      },
      'should throw for unknown entities (1)'
    )
  }

  try {
    fromXml('<root>&copy;</root>')
    t.fail('should fail (4)')
  } catch (error) {
    t.deepEqual(
      error,
      {
        message: 'Invalid character entity',
        name: '1:13',
        reason: 'Invalid character entity',
        line: 1,
        column: 13,
        location: {
          start: {line: 1, column: 13, offset: 12},
          end: {line: null, column: null}
        },
        source: 'xast-util-from-xml',
        ruleId: 'sax'
      },
      'should throw for unknown entities (2)'
    )
  }

  try {
    fromXml('<root><a><b><c/></a></b></root>')
    t.fail('should fail (5)')
  } catch (error) {
    t.deepEqual(
      error,
      {
        message: 'Unexpected close tag',
        name: '1:21',
        reason: 'Unexpected close tag',
        line: 1,
        column: 21,
        location: {
          start: {line: 1, column: 21, offset: 20},
          end: {line: null, column: null}
        },
        source: 'xast-util-from-xml',
        ruleId: 'sax'
      },
      'should throw on invalid nesting'
    )
  }

  t.throws(
    function() {
      fromXml('<!doctype>')
    },
    /1:11: Expected doctype name/,
    'should throw on missing doctype name'
  )

  t.throws(
    function() {
      fromXml('<!doctype !>')
    },
    /1:13: Expected start of doctype name/,
    'should throw on invalid doctype name'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name[<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:47: Unexpected internal subset/,
    'should throw on internal subset directly after doctype name'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name [<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:48: Unexpected internal subset/,
    'should throw on internal subset after doctype name'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name!>')
    },
    /1:17: Expected doctype name character, whitespace, or doctype end/,
    'should throw on invalid character directly after doctype'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name !>')
    },
    /1:18: Expected external identifier \(`PUBLIC` or `SYSTEM`\), whitespace, or doctype end/,
    'should throw on invalid character after doctype'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name PUB>')
    },
    /1:20: Expected external identifier \(`PUBLIC` or `SYSTEM`\)/,
    'should throw on invalid external identifier (1)'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEm>')
    },
    /1:23: Expected external identifier \(`PUBLIC` or `SYSTEM`\)/,
    'should throw on invalid external identifier (2)'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name PUBLIC>')
    },
    /1:23: Expected whitespace after `PUBLIC`/,
    'should throw on missing whitespace after public identifier'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name PUBLIC !>')
    },
    /1:25: Expected quote or apostrophe to start public literal/,
    'should throw on invalid character after public identifier'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name PUBLIC "🤔">')
    },
    /1:28: Expected pubid character in public literal/,
    'should throw on invalid character in public identifier'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name PUBLIC "literal"!>')
    },
    /1:34: Expected whitespace after public literal/,
    'should throw on invalid character after public literal'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEM>')
    },
    /1:23: Expected whitespace after `SYSTEM`/,
    'should throw on missing whitespace after system identifier'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEM !>')
    },
    /1:25: Expected quote or apostrophe to start system literal/,
    'should throw on invalid character after system identifier'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEM "asd>')
    },
    /1:28: Unexpected end/,
    'should throw on unended system literal'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEM "asd" [<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:61: Unexpected internal subset/,
    'should throw on internal subset after external id'
  )

  t.throws(
    function() {
      fromXml('<!DOCTYPE name SYSTEM "asd" !>')
    },
    /1:31: Expected whitespace or end of doctype/,
    'should throw on unexpected character after external id'
  )

  t.end()
})

test('fixtures', function(t) {
  var base = join('test', 'fixtures')

  fs.readdirSync(base)
    .filter(negate(hidden))
    .forEach(each)

  t.end()

  function each(fixture) {
    var input = String(fs.readFileSync(join(base, fixture, 'index.xml')))
    var fp = join(base, fixture, 'index.json')
    var actual = fromXml(input)
    var expected

    try {
      expected = JSON.parse(fs.readFileSync(fp))
    } catch (_) {
      // New fixture.
      fs.writeFileSync(fp, JSON.stringify(actual, 0, 2) + '\n')
      return
    }

    t.deepEqual(actual, expected, fixture)
  }
})
