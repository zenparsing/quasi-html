'use strict';

const Parser = require('../src/parser');
const assert = require('assert');

{ // Tags and attributes
  let parser = new Parser();
  parser.parseChunk(`
    <tag a=x b=1 c="y" d='z'></tag>
  `);
  assert.deepEqual(parser.tokens, [
    ['text', '\n    '],
    ['tag-start', 'tag'],
    ['attr-key', 'a'],
    ['attr-value', 'x'],
    ['attr-key', 'b'],
    ['attr-value', '1'],
    ['attr-key', 'c'],
    ['attr-value', 'y'],
    ['attr-key', 'd'],
    ['attr-value', 'z'],
    ['tag-end', ''],
    ['tag-start', '/tag'],
    ['tag-end', ''],
    ['text', '\n  '],
  ]);
}

{ // Explicit self-closing
  let parser = new Parser();
  parser.parseChunk('<x />');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', '/'],
  ]);
}

{ // Exclicit self-closing with no space
  let parser = new Parser();
  parser.parseChunk('<x/>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', '/'],
  ]);
}

{ // Comments are excluded
  let parser = new Parser();
  parser.parseChunk('<!--comment-->');
  assert.deepEqual(parser.tokens, []);
  parser.parseChunk('<!--');
  parser.parseChunk('hidden');
  parser.parseChunk('-->');
  assert.deepEqual(parser.tokens, []);
}

{ // Strange tag name with !--
  let parser = new Parser();
  parser.parseChunk('<a!-- />');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'a!--'],
    ['tag-end', '/'],
  ]);
}

{ // Attribute key WS before />
  let parser = new Parser();
  parser.parseChunk('<x a />');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-key', 'a'],
    ['tag-end', '/'],
  ]);
}

{ // Raw tag: script
  let parser = new Parser();
  parser.parseChunk('<script>console.log("<tag>")</script>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'script'],
    ['tag-end', ''],
    ['text', 'console.log("<tag>")'],
    ['tag-start', '/script'],
    ['tag-end', ''],
  ]);
}

{ // Raw tag with values
  let parser = new Parser();
  parser.parseChunk('<script>a');
  parser.pushValue('b');
  parser.parseChunk('c</script>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'script'],
    ['tag-end', ''],
    ['text', 'a'],
    ['text', 'b'],
    ['text', 'c'],
    ['tag-start', '/script'],
    ['tag-end', ''],
  ]);
}

{ // Raw self-closing
  let parser = new Parser();
  parser.parseChunk('<script /><x></x>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'script'],
    ['tag-end', '/'],
    ['tag-start', 'x'],
    ['tag-end', ''],
    ['tag-start', '/x'],
    ['tag-end', ''],
  ]);
}

{ // Raw tag: style
  let parser = new Parser();
  parser.parseChunk('<style>a { content: "<tag>" }</style>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'style'],
    ['tag-end', ''],
    ['text', 'a { content: "<tag>" }'],
    ['tag-start', '/style'],
    ['tag-end', ''],
  ]);
}

{ // Character escapes
  let parser = new Parser();
  parser.parseChunk('<x>\\<tag\\></x>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', ''],
    ['text', '<tag>'],
    ['tag-start', '/x'],
    ['tag-end', ''],
  ]);
}

{ // Hex escapes
  let parser = new Parser();
  parser.parseChunk('<x>\\x40</x>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', ''],
    ['text', '@'],
    ['tag-start', '/x'],
    ['tag-end', ''],
  ]);
}

{ // Unicode escapes
  let parser = new Parser();
  parser.parseChunk('<x>\\u0040</x>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', ''],
    ['text', '@'],
    ['tag-start', '/x'],
    ['tag-end', ''],
  ]);
}

{ // No escapes in raw
  let parser = new Parser();
  parser.parseChunk('<script>\\x40</script>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'script'],
    ['tag-end', ''],
    ['text', '\\x40'],
    ['tag-start', '/script'],
    ['tag-end', ''],
  ]);
}

{ // Double backslash
  let parser = new Parser();
  parser.parseChunk('\\\\x\\\\y');
  assert.deepEqual(parser.tokens, [['text', '\\x\\y']]);
}

{ // Strange
  let parser = new Parser();
  parser.parseChunk('<a b=/>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'a'],
    ['attr-key', 'b'],
    ['tag-end', '/'],
  ]);
}

{ // Strange
  let parser = new Parser();
  parser.parseChunk('<x /=y=1></x>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-key', 'y'],
    ['attr-value', '1'],
    ['tag-end', ''],
    ['tag-start', '/x'],
    ['tag-end', ''],
  ]);
}

{ // Missing closing tag name
  let parser = new Parser();
  parser.parseChunk('<x>a</>');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['tag-end', ''],
    ['text', 'a'],
    ['tag-start', '/'],
    ['tag-end', ''],
  ]);
}

{ // Attribute parts DQ
  let parser = new Parser();
  parser.parseChunk('<x y="a');
  parser.pushValue('b');
  parser.parseChunk('c');
  parser.pushValue('d');
  parser.parseChunk('e" />');
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-key', 'y'],
    ['attr-part', 'a'],
    ['attr-part', 'b'],
    ['attr-part', 'c'],
    ['attr-part', 'd'],
    ['attr-part', 'e'],
    ['tag-end', '/'],
  ]);
}

{ // Attribute parts SQ
  let parser = new Parser();
  parser.parseChunk(`<x y='a`);
  parser.pushValue('b');
  parser.parseChunk('c');
  parser.pushValue('d');
  parser.parseChunk(`e' />`);
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-key', 'y'],
    ['attr-part', 'a'],
    ['attr-part', 'b'],
    ['attr-part', 'c'],
    ['attr-part', 'd'],
    ['attr-part', 'e'],
    ['tag-end', '/'],
  ]);
}

{ // Attribute parts must be quoted
  let parser = new Parser();
  parser.parseChunk(`<x y=a`);
  parser.pushValue('b');
  parser.parseChunk(`c />`);
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-key', 'y'],
    ['attr-value', 'a'],
    ['attr-map', 'b'],
    ['attr-key', 'c'],
    ['tag-end', '/'],
  ]);
}

{ // Attribute maps
  let parser = new Parser();
  parser.parseChunk(`<x`);
  parser.pushValue('map');
  parser.parseChunk(`/>`);
  assert.deepEqual(parser.tokens, [
    ['tag-start', 'x'],
    ['attr-map', 'map'],
    ['tag-end', '/'],
  ]);
}