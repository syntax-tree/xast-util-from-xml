'use strict'

var Parser = require('sax').SAXParser
var Message = require('vfile-message')

module.exports = fromXml

var fromCharCode = String.fromCharCode

var search = /\r?\n|\r/g

function fromXml(doc) {
  var parser = new Parser(true, {position: true, strictEntities: true})
  var stack = [{type: 'root', children: []}]
  var position = now()

  parser.ondoctype = ondoctype
  parser.onsgmldeclaration = onsgmldeclaration
  parser.onprocessinginstruction = onprocessinginstruction
  parser.ontext = ontext
  parser.oncomment = oncomment
  parser.onopencdata = oncdataopen
  parser.oncdata = oncdatavalue
  parser.onclosecdata = exit
  parser.onopentag = onopen
  parser.onclosetag = exit
  parser.onerror = onerror

  parser.write(doc).close()

  return stack[0]

  function onerror(err) {
    var index = err.message.indexOf('\nLine')
    /* istanbul ignore next
     * - The substring should always be included, but this guards against
     * changes in newer sax versions */
    fail(index === -1 ? err.message : err.message.slice(0, index), 'sax')
  }

  function onsgmldeclaration() {
    fail('Unexpected SGML declaration', 'unexpected-sgml')
  }

  function ondoctype(value) {
    var node = {type: 'doctype', name: '', public: null, system: null}
    var index = -1
    var state = 'BEGIN'
    var returnState
    var buffer
    var bufferIndex
    var start
    var marker
    var code

    while (++index <= value.length) {
      code = index === value.length ? null /* EOF */ : value.charCodeAt(index)

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
            state = 'IN_NAME'
            start = index
          } else {
            fail('Expected start of doctype name', 'doctype-name')
          }

          break
        case 'IN_NAME':
          if (isNameChar(code)) {
            // As expected.
          } else if (isSpace(code) || code === null /* EOF */) {
            state = 'AFTER_NAME'
            node.name = value.slice(start, index)
          } else if (code === 91 /* `[` */) {
            fail('Unexpected internal subset', 'doctype-internal-subset')
          } else {
            fail(
              'Expected doctype name character, whitespace, or doctype end',
              'doctype-name'
            )
          }

          break
        case 'AFTER_NAME':
          if (code === null /* EOF */) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else if (code === 80 /* `P` */) {
            state = 'IN_EID'
            returnState = 'AFTER_PUBLIC'
            buffer = 'PUBLIC'
            bufferIndex = 0
          } else if (code === 83 /* `S` */) {
            state = 'IN_EID'
            returnState = 'AFTER_SYSTEM'
            buffer = 'SYSTEM'
            bufferIndex = 0
          } else if (code === 91 /* `[` */) {
            fail('Unexpected internal subset', 'doctype-internal-subset')
          } else {
            fail(
              'Expected external identifier (`PUBLIC` or `SYSTEM`), whitespace, or doctype end',
              'doctype-external-identifier'
            )
          }

          break
        case 'IN_EID':
          if (code === buffer.charCodeAt(++bufferIndex)) {
            if (bufferIndex === buffer.length - 1) {
              state = returnState
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
          } else if (code === 34 /* `"` */ || code === 39 /* `'` */) {
            state = 'IN_PUBLIC_LITERAL'
            start = index + 1
            marker = code
          } else {
            fail(
              'Expected quote or apostrophe to start public literal',
              'doctype-public-literal'
            )
          }

          break
        case 'IN_PUBLIC_LITERAL':
          if (code === marker) {
            state = 'AFTER_PUBLIC_LITERAL'
            node.public = value.slice(start, index)
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
          } else if (code === 34 /* `"` */ || code === 39 /* `'` */) {
            state = 'IN_SYSTEM_LITERAL'
            start = index + 1
            marker = code
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
           * versions. */
          if (code === null /* EOF */) {
            fail(
              'Expected quote or apostrophe to end system literal',
              'doctype-system-literal'
            )
          } else if (code === marker) {
            state = 'AFTER_SYSTEM_LITERAL'
            node.system = value.slice(start, index)
          } else {
            // As expected.
          }

          break

        case 'AFTER_SYSTEM_LITERAL':
          if (code === null /* EOF */) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else if (code === 91 /* `[` */) {
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

    enter(node)
    exit()
  }

  function onprocessinginstruction(value) {
    enter({
      type: 'instruction',
      name: String(value.name),
      value: String(value.body)
    })
    exit()
  }

  function oncomment(value) {
    var node = {type: 'comment', value: value}

    // Comment has a positional bug… 😢
    // They end right before the last character (`>`), so let’s add that:
    var actualEnd = now()
    actualEnd.column++
    actualEnd.offset++

    enter(node)
    exit()

    node.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  function oncdataopen() {
    enter({type: 'cdata', value: ''})
  }

  function oncdatavalue(value) {
    stack[stack.length - 1].value += value
  }

  function ontext(value) {
    var node = {type: 'text', value: value}
    // Text has a positional bug… 😢
    // When they are added, the position is already at the next token.
    // So let’s reverse that.
    var actualEnd = Object.assign({}, position)
    var start = 0
    var match

    while (start < value.length) {
      search.lastIndex = start
      match = search.exec(value)

      if (match) {
        actualEnd.line++
        actualEnd.column = 1
        start = match.index + match[0].length
      } else {
        actualEnd.column += value.length - start
        start = value.length
      }
    }

    actualEnd.offset += value.length

    enter(node)
    exit()

    node.position.end = Object.assign({}, actualEnd)
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

  function enter(node) {
    node.position = {start: Object.assign({}, position)}
    stack[stack.length - 1].children.push(node)
    stack.push(node)
    position = now()
  }

  function exit() {
    position = now()
    stack.pop().position.end = Object.assign({}, position)
  }

  function now() {
    return {
      line: parser.line + 1,
      column: parser.column + 1,
      offset: parser.position
    }
  }

  function fail(reason, id) {
    throw new Message(reason, now(), 'xast-util-from-xml:' + id)
  }
}

// See: <https://www.w3.org/TR/xml/#NT-NameStartChar>
function isNameStartChar(code) {
  return /[:A-Z_a-z\xc0-\xd6\xd8-\xf6\xf8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]/.test(
    fromCharCode(code)
  )
}

// See: <https://www.w3.org/TR/xml/#NT-NameChar>
function isNameChar(code) {
  return (
    isNameStartChar(code) ||
    /[-.\d\xb7\u0300-\u036f\u203f\u2040]/.test(fromCharCode(code))
  )
}

function isSpace(code) {
  return /[\t\n\r ]/.test(fromCharCode(code))
}

function isPubidChar(code) {
  return /[\n\r !#$%'-;=?-Z_a-z]/.test(fromCharCode(code))
}
