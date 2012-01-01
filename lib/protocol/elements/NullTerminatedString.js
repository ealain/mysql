var Util          = require('util');
var Element       = require('./Element');
var StringDecoder = require('string_decoder').StringDecoder;
var BufferList    = require('../util/BufferList');

// "Null-Terminated String: used for some variable-length character strings.
// The value '\0' (sometimes written 0x00) denotes the end of the string."
// -- http://forge.mysql.com/wiki/MySQL_Internals_ClientServer_Protocol#Elements

module.exports = NullTerminatedString;
Util.inherits(NullTerminatedString, Element);
function NullTerminatedString(encoding, value) {
  Element.call(this);

  this.encoding = encoding;
  this.value    = value;

  if (value === undefined) {
    this.length = undefined;
  } else if (!encoding) {
    this.length = value.length;
  } else {
    this.length = Buffer.byteLength(value, encoding) + 1;
  }

  // Created by #write as needed
  this._writer = null;
}

NullTerminatedString.prototype.copy = function(buffer, offset) {
  buffer.write(this.value, offset, this.encoding);
  buffer[offset + this.length - 1] = 0x00;
};

NullTerminatedString.prototype.write = function(buffer, start, end) {
  if (!this._writer) {
    this._writer = (this.encoding)
      ? new StringWriter(this)
      : new BufferWriter(this);
  }

  return this._writer.write(buffer, start, end);
};

NullTerminatedString.indexOfNullByte = function(buffer, start, end) {
  for (var i = start; i < end; i++) {
    if (buffer[i] === 0x00) return i;
  }
};

function StringWriter(target) {
  this._target  = target;
  this._decoder = new StringDecoder(target.encoding);
}

StringWriter.prototype.write = function(buffer, start, end) {
  var target = this._target;

  var nullIndex = NullTerminatedString.indexOfNullByte(buffer, start, end);
  if (nullIndex !== undefined) end = nullIndex;

  var characters = this._decoder.write(buffer.slice(start, end));

  if (target.value === undefined) {
    target.value = characters;
  } else {
    target.value += characters;
  }

  var length = end - start;
  if (nullIndex !== undefined) length += 1;

  target.bytesWritten += length;
  if (nullIndex === undefined) return false;

  target.length = target.bytesWritten;
  return true;
};

function BufferWriter(target) {
  this._target     = target;
  this._bufferList = new BufferList();
}

BufferWriter.prototype.write = function(buffer, start, end) {
  var target = this._target;

  var nullIndex = NullTerminatedString.indexOfNullByte(buffer, start, end);
  if (nullIndex !== undefined) end = nullIndex;

  this._bufferList.push(buffer.slice(start, end));

  var length = end - start;
  if (nullIndex !== undefined) length += 1;

  target.bytesWritten += length;
  if (nullIndex === undefined) return false;

  target.length = target.bytesWritten;
  target.value  = this._bufferList.toBuffer();

  return true;
};