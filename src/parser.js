'use strict';

const TEXT = 1, RAW = 2, OPEN = 3, ATTR = 4;
const ATTR_KEY = 5, ATTR_KEY_WS = 6;
const ATTR_VALUE_WS = 7, ATTR_VALUE = 8;
const ATTR_VALUE_SQ = 9, ATTR_VALUE_DQ = 10;
const COMMENT = 11;

const ESC_RE = /^\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4}))?/;

function Parser() {
  this.tokens = [];
  this.state = TEXT;
  this.tag = '';
}

Parser.prototype.parseChunk = function(chunk) {
  let state = this.state;
  let tokens = this.tokens;
  let attrPart = (state === ATTR_VALUE_DQ || state === ATTR_VALUE_SQ);
  let a = 0;
  let b = 0;

  function move(s, shift) {
    state = s;
    a = shift ? b : b + 1;
  }

  function push(type, value) {
    tokens.push([type, value === undefined ? chunk.slice(a, b) : value]);
    a = b;
  }

  for (; b < chunk.length; ++b) {
    let c = chunk[b];
    if (state === RAW) {
      if (c === '>' && rmatch(chunk, b, '</' + this.tag)) {
        b -= this.tag.length + 3; // Rewind to closing tag
        state = TEXT;
      }
    } else if (state === COMMENT) {
      if (c === '>' && rmatch(chunk, b, '--')) {
        if (b - 2 > a) {
          push('comment', chunk.slice(a, b - 2));
        }
        move(TEXT);
      }
    } else if (c === '\\') {
      // Unescape
      chunk = chunk.slice(0, b) + chunk.slice(b).replace(ESC_RE, (m, x, y) =>
        m === '\\' ? '' : String.fromCharCode(parseInt(x || y, 16))
      );
    } else if (state === TEXT) {
      if (c === '<') {
        if (b > a) {
          push('text');
        }
        move(OPEN);
      }
    } else if (state === ATTR_VALUE_SQ) {
      if (c === "'") {
        push(attrPart ? 'attr-part' : 'attr-value');
        attrPart = false;
        move(ATTR);
      }
    } else if (state === ATTR_VALUE_DQ) {
      if (c === '"') {
        push(attrPart ? 'attr-part' : 'attr-value');
        attrPart = false;
        move(ATTR);
      }
    } else if (c === '>') {
      if (state === OPEN) {
        push('tag-start', this.tag = chunk.slice(a, b));
      } else if (state === ATTR_KEY) {
        push('attr-key');
      } else if (state === ATTR_VALUE) {
        push('attr-value');
      }
      if (rmatch(chunk, b, '/') && this.tag[0] !== '/') {
        push('tag-end', '/');
        move(TEXT);
      } else {
        push('tag-end', '');
        move(rawTag(this.tag) ? RAW : TEXT);
      }
    } else if (state === OPEN) {
      if (c === '-' && chunk.slice(a, b) === '!-') {
        move(COMMENT);
      } else if (c === '/' && b === a) {
        // Allow leading slash
      } else if (!attrChar(c)) {
        push('tag-start');
        move(ATTR);
      }
    } else if (state === ATTR) {
      if (attrChar(c)) {
        move(ATTR_KEY, true);
      }
    } else if (state === ATTR_KEY) {
      if (c === '=') {
        push('attr-key');
        move(ATTR_VALUE_WS);
      } else if (!attrChar(c)) {
        push('attr-key');
        move(ATTR_KEY_WS);
      }
    } else if (state === ATTR_KEY_WS) {
      if (c === '=') {
        move(ATTR_VALUE_WS);
      } else if (attrChar(c)) {
        move(ATTR_KEY, true);
      }
    } else if (state === ATTR_VALUE_WS) {
      if (c === '"') {
        move(ATTR_VALUE_DQ);
      } else if (c === "'") {
        move(ATTR_VALUE_SQ);
      } else if (attrChar(c)) {
        move(ATTR_VALUE, true);
      }
    } else if (state === ATTR_VALUE) {
      if (!attrChar(c)) {
        push('attr-value');
        move(ATTR);
      }
    }
  }

  if (state === TEXT || state === RAW) {
    if (a < b) {
      push('text');
    }
  } else if (state === COMMENT) {
    if (a < b) {
      push('comment');
    }
  } else if (state === OPEN) {
    if (a < b) {
      push('tag-start');
      move(ATTR);
    }
  } else if (state === ATTR_KEY) {
    push('attr-key');
    move(ATTR);
  } else if (state === ATTR_KEY_WS) {
    move(ATTR);
  } else if (state === ATTR_VALUE) {
    push('attr-value');
    move(ATTR);
  } else if (state === ATTR_VALUE_SQ || state === ATTR_VALUE_DQ) {
    if (a < b) {
      push('attr-part');
    }
  }

  this.state = state;
};

Parser.prototype.pushValue = function(value) {
  let state = this.state;
  let tokens = this.tokens;
  let type = '';

  switch (state) {
    case TEXT:
    case RAW:
      type = 'text';
      break;
    case COMMENT:
      type = 'comment'
      break;
    case OPEN:
      type = 'tag-start';
      state = ATTR;
      break;
    case ATTR:
      type = 'attr-map';
      break;
    case ATTR_VALUE_WS:
      type = 'attr-value';
      state = ATTR;
      break;
    case ATTR_VALUE_SQ:
    case ATTR_VALUE_DQ:
      type = 'attr-part';
      break;
  }

  if (type) {
    tokens.push([type, value]);
  }

  this.state = state;
};

Parser.prototype.end = function() {
  let tokens = this.tokens;
  let a = 0;
  let b = tokens.length;

  if (b === 0) {
    return tokens;
  }

  if (wsToken(tokens[0])) { a++; }
  if (wsToken(tokens[b - 1])) { b--; }

  return a === 0 && b === tokens.length ? tokens : tokens.slice(a, b);
};

function wsToken(t) {
  return t[0] === 'text' && typeof t[1] === 'string' && (!t[1] || !t[1].trim());
}

function rmatch(s, end, t) {
  return end >= t.length && s.slice(end - t.length, end) === t;
}

function wsChar(c) {
  switch (c) {
    case ' ':
    case '\n':
    case '\r':
    case '\t':
    case '\f':
    case '\v':
      return true;
  }
  return c.charCodeAt(0) > 128 && /\s/.test(c);
}

function attrChar(c) {
  return !wsChar(c) && c !== '"' && c !== "'" && c !== '=' && c !== '/';
}

function rawTag(tag) {
  return tag === 'script' || tag === 'style';
}

module.exports = Parser;
