'use strict'

var Parser = require('sax').SAXParser
var Message = require('vfile-message')

module.exports = fromXml

var origin = 'xast-util-from-xml'

// Character codes:
var eof = null
var tab = 9 // '\t'
var lineFeed = 10 // '\n'
var carriageReturn = 13 // '\r'
var space = 32 // ' '
var exclamationMark = 33 // '!'
var quotationMark = 34 // '"'
var numberSign = 35 // '#'
var dollarSign = 36 // '$'
var percentSign = 37 // '%'
var apostrophe = 39 // '''
var leftParenthesis = 40 // '('
var rightParenthesis = 41 // ')'
var asterisk = 42 // '*'
var plusSign = 43 // '+'
var comma = 44 // ','
var dash = 45 // '-'
var dot = 46 // '.'
var slash = 47 // '/'
var digit0 = 48 // '0'
var digit9 = 57 // '9'
var colon = 58 // ':'
var semicolon = 59 // ';'
var equalsTo = 61 // '='
var questionMark = 63 // '?'
var atSign = 64 // '@'
var uppercaseA = 65 // 'A'
var uppercaseB = 66 // 'B'
var uppercaseC = 67 // 'C'
var uppercaseE = 69 // 'E'
var uppercaseI = 73 // 'I'
var uppercaseL = 76 // 'L'
var uppercaseM = 77 // 'M'
var uppercaseP = 80 // 'P'
var uppercaseS = 83 // 'S'
var uppercaseT = 84 // 'T'
var uppercaseU = 85 // 'U'
var uppercaseY = 89 // 'Y'
var uppercaseZ = 90 // 'Z'
var leftSquareBracket = 91 // '['
var underscore = 95 // '_'
var lowercaseA = 97 // 'a'
var lowercaseZ = 122 // 'z'

function fromXml(doc) {
  var parser = new Parser(true, {position: true, strictEntities: true})
  var node = {type: 'root', children: []}
  var stack = [node]
  var position = now()

  parser.ondoctype = ondoctype
  parser.onsgmldeclaration = onsgmldeclaration
  parser.onprocessinginstruction = onprocessinginstruction
  parser.ontext = ontext
  parser.oncomment = oncomment
  parser.onopencdata = oncdataopen
  parser.oncdata = oncdatavalue
  parser.onclosecdata = oncdataclose
  parser.onopentag = onopen
  parser.onclosetag = onclose
  parser.onerror = onerror

  parser.write(doc).close()

  return node

  function onerror(err) {
    var reason = err.message
    var lineIndex = reason.indexOf('\nLine')
    /* istanbul ignore next
     * - The substring should always be included, but this guards against
     * changes in newer sax versions */
    reason = lineIndex === -1 ? reason : reason.slice(0, lineIndex)
    fail(reason, 'sax')
  }

  function onsgmldeclaration() {
    fail('Unexpected SGML declaration', 'unexpected-sgml')
  }

  function ondoctype(value) {
    var index = -1
    var length = value.length + 1
    var state = 'BEGIN'
    var nameStart
    var nameEnd
    var pubStart
    var pubEnd
    var sysStart
    var sysEnd
    var nextState
    var expect
    var expected
    var code
    var offset

    while (++index < length) {
      code = index === value.length ? eof : value.charCodeAt(index)

      switch (state) {
        case 'BEGIN':
          if (isSpace(code)) {
            state = 'BEFORE_NAME'
          } else {
            fail('Expected doctype name', 'doctype-name')
          }

          break
        case 'BEFORE_NAME':
          if (isSpace(code)) {
            // As expected.
          } else if (isNameStartChar(code)) {
            nameStart = index
            state = 'IN_NAME'
          } else {
            fail('Expected start of doctype name', 'doctype-name')
          }

          break
        case 'IN_NAME':
          if (isNameChar(code)) {
            // As expected.
          } else if (isSpace(code)) {
            nameEnd = index
            state = 'AFTER_NAME'
          } else if (code === eof) {
            nameEnd = index
          } else if (code === leftSquareBracket) {
            fail('Unexpected internal subset', 'doctype-internal-subset')
          } else {
            fail(
              'Expected doctype name character, whitespace, or doctype end',
              'doctype-name'
            )
          }

          break
        case 'AFTER_NAME':
          if (code === eof) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else if (code === uppercaseP) {
            expect = [
              uppercaseP,
              uppercaseU,
              uppercaseB,
              uppercaseL,
              uppercaseI,
              uppercaseC
            ]
            state = 'IN_EID'
            offset = 0
            nextState = 'AFTER_PUBLIC'
          } else if (code === uppercaseS) {
            expect = [
              uppercaseS,
              uppercaseY,
              uppercaseS,
              uppercaseT,
              uppercaseE,
              uppercaseM
            ]
            state = 'IN_EID'
            offset = 0
            nextState = 'AFTER_SYSTEM'
          } else if (code === leftSquareBracket) {
            fail('Unexpected internal subset', 'doctype-internal-subset')
          } else {
            fail(
              'Expected external identifier (`PUBLIC` or `SYSTEM`), whitespace, or doctype end',
              'doctype-external-identifier'
            )
          }

          break
        case 'IN_EID':
          expected = expect[++offset]

          if (code === expected) {
            if (offset === expect.length - 1) {
              state = nextState
            }
          } else {
            fail(
              'Expected external identifier (`PUBLIC` or `SYSTEM`)',
              'doctype-external-identifier'
            )
          }

          break
        case 'AFTER_PUBLIC':
          if (isSpace(code)) {
            state = 'BEFORE_PUBLIC_LITERAL'
          } else {
            fail('Expected whitespace after `PUBLIC`', 'doctype-public-literal')
          }

          break
        case 'AFTER_SYSTEM':
          if (isSpace(code)) {
            state = 'BEFORE_SYSTEM_LITERAL'
          } else {
            fail('Expected whitespace after `SYSTEM`', 'doctype-system-literal')
          }

          break
        case 'BEFORE_PUBLIC_LITERAL':
          if (isSpace(code)) {
            // As expected.
          } else if (code === quotationMark || code === apostrophe) {
            state = 'IN_PUBLIC_LITERAL'
            expected = code
            pubStart = index + 1
          } else {
            fail(
              'Expected quote or apostrophe to start public literal',
              'doctype-public-literal'
            )
          }

          break
        case 'IN_PUBLIC_LITERAL':
          if (code === expected) {
            pubEnd = index
            state = 'AFTER_PUBLIC_LITERAL'
          } else if (isPubidChar(code)) {
            // As expected.
          } else {
            fail(
              'Expected pubid character in public literal',
              'doctype-public-literal'
            )
          }

          break
        case 'AFTER_PUBLIC_LITERAL':
          if (isSpace(code)) {
            // As expected.
            state = 'BEFORE_SYSTEM_LITERAL'
          } else {
            fail(
              'Expected whitespace after public literal',
              'doctype-system-literal'
            )
          }

          break
        case 'BEFORE_SYSTEM_LITERAL':
          if (isSpace(code)) {
            // As expected.
          } else if (code === quotationMark || code === apostrophe) {
            state = 'IN_SYSTEM_LITERAL'
            expected = code
            sysStart = index + 1
          } else {
            fail(
              'Expected quote or apostrophe to start system literal',
              'doctype-system-literal'
            )
          }

          break
        case 'IN_SYSTEM_LITERAL':
          /* istanbul ignore next
           * - Handled by SAX, but keep it to guard against changes in newer sax
           versions */
          if (code === eof) {
            fail(
              'Expected quote or apostrophe to end system literal',
              'doctype-system-literal'
            )
          } else if (code === expected) {
            sysEnd = index
            state = 'AFTER_SYSTEM_LITERAL'
          } else {
            // As expected.
          }

          break

        case 'AFTER_SYSTEM_LITERAL':
          if (code === eof) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else if (code === leftSquareBracket) {
            fail('Unexpected internal subset', 'internal-subset')
          } else {
            fail('Expected whitespace or end of doctype', 'system-literal')
          }

          break
        /* istanbul ignore next - Guard against new states */
        default:
          throw new Error('Unhandled state `' + state + '`')
      }
    }

    enterExit({
      type: 'doctype',
      name: value.slice(nameStart, nameEnd),
      public: pubStart === undefined ? null : value.slice(pubStart, pubEnd),
      system: sysStart === undefined ? null : value.slice(sysStart, sysEnd)
    })
  }

  function onprocessinginstruction(value) {
    enterExit({
      type: 'instruction',
      name: String(value.name),
      value: String(value.body)
    })
  }

  function oncomment(value) {
    var child = {type: 'comment', value: value}

    // Comment has a positional bug… 😢
    // They end right before the last character (`>`), so let’s add that:
    var actualEnd = now()
    actualEnd.column++
    actualEnd.offset++

    enterExit(child)

    child.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  function oncdataopen() {
    enter({type: 'cdata', value: ''})
  }

  function oncdatavalue(value) {
    node.value += value
  }

  function oncdataclose() {
    exit()
  }

  function ontext(value) {
    var child = {type: 'text', value: value}

    // Text has a positional bug… 😢
    // When they are added, the position is already at the next token.
    // So let’s reverse that.
    var actualEnd = Object.assign({}, position)
    var index = -1
    var length = value.length

    while (++index < length) {
      if (value.charCodeAt(index) === lineFeed) {
        actualEnd.line++
        actualEnd.column = 1
      } else {
        actualEnd.column++
      }

      actualEnd.offset++
    }

    enterExit(child)
    child.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  function onopen(value) {
    enter({
      type: 'element',
      name: value.name,
      attributes: value.attributes,
      children: []
    })
  }

  function onclose(/* name */) {
    exit()
  }

  function enter(child) {
    var end = now()

    child.position = {start: Object.assign({}, position)}

    node.children.push(child)
    stack.push(child)
    node = child
    position = end
  }

  function exit() {
    var end = now()

    node.position.end = Object.assign({}, end)
    stack.pop()
    node = stack[stack.length - 1]
    position = end
  }

  function enterExit(child) {
    var end = now()

    child.position = {
      start: Object.assign({}, position),
      end: Object.assign({}, end)
    }

    node.children.push(child)
    position = end
  }

  function now() {
    return {
      line: parser.line + 1,
      column: parser.column + 1,
      offset: parser.position
    }
  }

  function fail(reason, id) {
    throw new Message(reason, now(), origin + ':' + id)
  }
}

// See: <https://www.w3.org/TR/xml/#NT-NameStartChar>
function isNameStartChar(code) {
  /* istanbul ignore next - superfluous to cover every branch */
  return (
    code === colon ||
    code === underscore ||
    (code >= uppercaseA && code <= uppercaseZ) ||
    (code >= lowercaseA && code <= lowercaseZ) ||
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0x2ff) ||
    (code >= 0x370 && code <= 0x37d) ||
    (code >= 0x37f && code <= 0x1fff) ||
    (code >= 0x200c && code <= 0x200d) ||
    (code >= 0x2070 && code <= 0x218f) ||
    (code >= 0x2c00 && code <= 0x2fef) ||
    (code >= 0x3001 && code <= 0xd7ff) ||
    (code >= 0xf900 && code <= 0xfdcf) ||
    (code >= 0xfdf0 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0xeffff)
  )
}

// See: <https://www.w3.org/TR/xml/#NT-NameChar>
function isNameChar(code) {
  /* istanbul ignore next - superfluous to cover every branch */
  return (
    isNameStartChar(code) ||
    code === dash ||
    code === dot ||
    code === 0xb7 ||
    (code >= digit0 && code <= digit9) ||
    (code >= 0x300 && code <= 0x36f) ||
    (code >= 0x203f && code <= 0x2040)
  )
}

function isSpace(code) {
  return (
    code === tab ||
    code === lineFeed ||
    code === carriageReturn ||
    code === space
  )
}

function isPubidChar(code) {
  return (
    code === lineFeed ||
    code === carriageReturn ||
    code === space ||
    code === exclamationMark ||
    code === numberSign ||
    code === dollarSign ||
    code === percentSign ||
    code === apostrophe ||
    code === leftParenthesis ||
    code === rightParenthesis ||
    code === asterisk ||
    code === plusSign ||
    code === comma ||
    code === dash ||
    code === dot ||
    code === slash ||
    code === colon ||
    code === semicolon ||
    code === equalsTo ||
    code === questionMark ||
    code === atSign ||
    code === underscore ||
    (code >= uppercaseA && code <= uppercaseZ) ||
    (code >= lowercaseA && code <= lowercaseZ) ||
    (code >= digit0 && code <= digit9)
  )
}
