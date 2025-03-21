const STATE_TEXT = 'STATE_TEXT';
const STATE_START = 'STATE_START';
const STATE_OBJECT = 'STATE_OBJECT';
const STATE_KEY_QUOTED = 'STATE_KEY_QUOTED';
const STATE_KEY_UNQUOTED = 'STATE_KEY_UNQUOTED';
const STATE_AFTER_KEY = 'STATE_AFTER_KEY';
const STATE_VALUE = 'STATE_VALUE';
const STATE_VALUE_QUOTED = 'STATE_VALUE_QUOTED';
const STATE_VALUE_NUMBER = 'STATE_VALUE_NUMBER';
const STATE_VALUE_LITERAL = 'STATE_VALUE_LITERAL';
const STATE_ARRAY = 'STATE_ARRAY';
const STATE_AFTER_VALUE = 'STATE_AFTER_VALUE';

class EventEmitter {
	constructor() {
		this.events = {};
	}
	on(event, listener) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(listener);
	}
	emit(event, ...args) {
		if (this.events[event])
			this.events[event].forEach(listener => listener(...args));
	}
}

class JSONStreamingParser extends EventEmitter {
	constructor() {
		super();
		this.buffer = "";
		this.pos = 0;
		this.mode = "TEXT"; // "TEXT" or "JSON"
		this.currentState = STATE_TEXT;
		this.textBuffer = "";
		this.stack = []; // JSON contexts in progress
		this.currentToken = "";
		this.currentKey = null;
		this.entities = []; // Completed entities
		this.currentEntity = { finished: false, value: null, id: null };
		this.hasEndBeenCalled = false;
		this._processing = false;
	}

	write(chunk) {
		this.buffer += chunk;
		this._processBuffer();
		return this._waitForProcessingComplete();
	}

	isEscaped(buffer, i) {
		let count = 0, j = i - 1;
		while (j >= 0 && buffer[j] === '\\') { count++; j--; }
		return count % 2 === 1;
	}

	_processBuffer() {
		if (this._processing) return;
		this._processing = true;
		let i = this.pos;
		const self = this;
		function processChunk() {
			const len = self.buffer.length;
			while (i < len) {
				const char = self.buffer[i];
				if (self.mode === "TEXT") {
					if (self.currentState === STATE_TEXT) {
						// If there is a backslash followed by {, [, } or ], add only the next character.
						if (
							char === "\\" &&
							i + 1 < len &&
							(self.buffer[i + 1] === "{" ||
								self.buffer[i + 1] === "[" ||
								self.buffer[i + 1] === "}" ||
								self.buffer[i + 1] === "]")
						) {
							self.textBuffer += self.buffer[i + 1];
							i += 2;
							continue;
						}
						// On encountering { or [ without escape, switch to JSON mode.
						if ((char === "{" || char === "[") && !self.isEscaped(self.buffer, i)) {
							if (self.textBuffer) {
								self.entities.push({ finished: true, value: self.textBuffer });
								self.textBuffer = "";
							}
							self.mode = "JSON";
							self.currentState = STATE_START;
							self.currentEntity = { finished: false, value: null, id: self.entities.length };
							continue;
						} else {
							self.textBuffer += char;
							i++;
						}
					}
				} else if (self.mode === "JSON") {
					switch (self.currentState) {
						case STATE_START:
							if (/\s/.test(char)) {
								i++;
							} else if (char === "{") {
								const obj = {};
								self.currentEntity.value = obj;
								self.stack.push({ type: "object", value: obj, parent: null, key: null });
								self.currentState = STATE_OBJECT;
								i++;
							} else if (char === "[") {
								const arr = [];
								self.currentEntity.value = arr;
								self.stack.push({ type: "array", value: arr, parent: null, key: null });
								self.currentState = STATE_ARRAY;
								i++;
							} else {
								i++;
							}
							break;
						case STATE_OBJECT:
							if (/\s/.test(char)) {
								i++;
							} else if (char === "}") {
								self.stack.pop();
								if (self.stack.length === 0) {
									self.currentEntity.finished = true;
									self.entities.push(self.currentEntity);
									self.mode = "TEXT";
									self.currentState = STATE_TEXT;
								} else {
									self.currentState = STATE_AFTER_VALUE;
								}
								i++;
							} else if (char === '"') {
								self.currentKey = "";
								self.currentState = STATE_KEY_QUOTED;
								i++;
							} else if (/[A-Za-z_$]/.test(char)) {
								self.currentKey = char;
								self.currentState = STATE_KEY_UNQUOTED;
								i++;
							} else if (char === ",") {
								i++;
							} else {
								i++;
							}
							break;
						case STATE_KEY_QUOTED:
							if (char === "\\") {
								if (i + 1 < len) {
									let nextChar = self.buffer[i + 1];
									// Handle escape sequences properly.
									if (nextChar === 'n') self.currentKey += "\n";
									else if (nextChar === 'r') self.currentKey += "\r";
									else if (nextChar === 't') self.currentKey += "\t";
									else self.currentKey += nextChar;
									i += 2;
								} else {
									i = len;
								}
							} else if (char === '"') {
								self.currentState = STATE_AFTER_KEY;
								i++;
							} else {
								self.currentKey += char;
								i++;
							}
							break;
						case STATE_KEY_UNQUOTED:
							if (char === ":" || /\s/.test(char)) {
								self.currentState = STATE_AFTER_KEY;
							} else if (/[A-Za-z0-9_$]/.test(char)) {
								self.currentKey += char;
								i++;
							} else {
								self.currentState = STATE_AFTER_KEY;
							}
							break;
						case STATE_AFTER_KEY:
							if (/\s/.test(char)) {
								i++;
							} else if (char === ":") {
								self.currentState = STATE_VALUE;
								i++;
							} else {
								self.currentState = STATE_VALUE;
							}
							break;
						case STATE_VALUE:
							if (/\s/.test(char)) {
								i++;
							} else if (char === '"') {
								self.currentToken = "";
								self.currentState = STATE_VALUE_QUOTED;
								i++;
							} else if (char === "{") {
								const obj = {};
								const container = self.stack[self.stack.length - 1];
								if (container.type === "object") {
									container.value[self.currentKey] = obj;
									self.stack.push({ type: "object", value: obj, parent: container, key: self.currentKey });
									self.currentKey = null;
								} else if (container.type === "array") {
									container.value.push(obj);
									self.stack.push({ type: "object", value: obj, parent: container, key: container.value.length - 1 });
								}
								self.currentState = STATE_OBJECT;
								i++;
							} else if (char === "[") {
								const arr = [];
								const container = self.stack[self.stack.length - 1];
								if (container.type === "object") {
									container.value[self.currentKey] = arr;
									self.stack.push({ type: "array", value: arr, parent: container, key: self.currentKey });
									self.currentKey = null;
								} else if (container.type === "array") {
									container.value.push(arr);
									self.stack.push({ type: "array", value: arr, parent: container, key: container.value.length - 1 });
								}
								self.currentState = STATE_ARRAY;
								i++;
							} else if (/[0-9\-]/.test(char)) {
								self.currentToken = char;
								self.currentState = STATE_VALUE_NUMBER;
								i++;
							} else if (/[tfn]/.test(char)) {
								self.currentToken = char;
								self.currentState = STATE_VALUE_LITERAL;
								i++;
							} else {
								i++;
							}
							break;
						case STATE_VALUE_QUOTED:
							if (char === "\\") {
								if (i + 1 < len) {
									let nextChar = self.buffer[i + 1];
									if (nextChar === 'n') self.currentToken += "\n";
									else if (nextChar === 'r') self.currentToken += "\r";
									else if (nextChar === 't') self.currentToken += "\t";
									else self.currentToken += nextChar;
									i += 2;
								} else {
									i = len;
								}
							} else if (char === '"') {
								const val = self.currentToken;
								self.currentToken = "";
								const container = self.stack[self.stack.length - 1];
								if (container.type === "object") {
									container.value[self.currentKey] = val;
									self.currentKey = null;
								} else if (container.type === "array") {
									container.value.push(val);
								}
								self.currentState = STATE_AFTER_VALUE;
								i++;
							} else {
								self.currentToken += char;
								i++;
							}
							break;
						case STATE_VALUE_NUMBER:
							if (/[0-9eE\.\+\-]/.test(char)) {
								self.currentToken += char;
								i++;
							} else {
								const num = Number(self.currentToken);
								self.currentToken = "";
								const container = self.stack[self.stack.length - 1];
								if (container.type === "object") {
									container.value[self.currentKey] = num;
									self.currentKey = null;
								} else if (container.type === "array") {
									container.value.push(num);
								}
								self.currentState = STATE_AFTER_VALUE;
							}
							break;
						case STATE_VALUE_LITERAL:
							if (/[a-zA-Z]/.test(char)) {
								self.currentToken += char;
								i++;
							} else {
								let lit = self.currentToken;
								if (lit === "true") lit = true;
								else if (lit === "false") lit = false;
								else if (lit === "null") lit = null;
								const container = self.stack[self.stack.length - 1];
								if (container.type === "object") {
									container.value[self.currentKey] = lit;
									self.currentKey = null;
								} else if (container.type === "array") {
									container.value.push(lit);
								}
								self.currentToken = "";
								self.currentState = STATE_AFTER_VALUE;
							}
							break;
						case STATE_ARRAY:
							if (/\s/.test(char)) {
								i++;
							} else if (char === "]") {
								self.stack.pop();
								if (self.stack.length === 0) {
									self.currentEntity.finished = true;
									self.entities.push(self.currentEntity);
									self.mode = "TEXT";
									self.currentState = STATE_TEXT;
								} else {
									self.currentState = STATE_AFTER_VALUE;
								}
								i++;
							} else {
								self.currentState = STATE_VALUE;
								continue;
							}
							break;
						case STATE_AFTER_VALUE:
							if (/\s/.test(char)) {
								i++;
							} else if (char === ",") {
								const container = self.stack[self.stack.length - 1];
								self.currentState = (container.type === "object") ? STATE_OBJECT : STATE_ARRAY;
								i++;
							} else if (
								(char === "}" && self.stack[self.stack.length - 1].type === "object") ||
								(char === "]" && self.stack[self.stack.length - 1].type === "array")
							) {
								self.stack.pop();
								if (self.stack.length === 0) {
									self.currentEntity.finished = true;
									self.entities.push(self.currentEntity);
									self.mode = "TEXT";
									self.currentState = STATE_TEXT;
								} else {
									self.currentState = STATE_AFTER_VALUE;
								}
								i++;
							} else {
								i++;
							}
							break;
						default:
							i++;
							break;
					}
				}
			}
			self.pos = i;
			if (i >= self.buffer.length) {
				self.buffer = "";
				self.pos = 0;
				self._processing = false;
			}
			self.emit("updateObject", self.getPreview());
			if (i < self.buffer.length) setTimeout(processChunk, 0);
		}
		processChunk();
	}

	_waitForProcessingComplete() {
		return new Promise(resolve => {
			const check = () => {
				if (!this.buffer && !this._processing) resolve();
				else setTimeout(check, 5);
			};
			check();
		});
	}

	flush() {
		this._processBuffer();
		return this._waitForProcessingComplete();
	}

	// getPreview emits intermediate values with the current property properly placed.
	getPreview() {
		const preview = this.entities.slice();
		if (this.mode === "TEXT" && this.textBuffer) {
			preview.push({ finished: true, value: this.textBuffer });
		} else if (this.mode === "JSON" && !this.currentEntity.finished) {
			if (this.currentState === STATE_VALUE_QUOTED) {
				let partialValue;
				try {
					partialValue = JSON.parse(JSON.stringify(this.currentEntity.value));
				} catch (e) {
					partialValue = this.currentEntity.value;
				}
				if (this.stack.length > 0 && this.currentKey !== null) {
					let currentClone = partialValue;
					for (let i = 1; i < this.stack.length; i++) {
						const entry = this.stack[i];
						if (entry.key !== null && currentClone) {
							currentClone = currentClone[entry.key];
						}
					}
					if (this.stack[this.stack.length - 1].type === "object") {
						currentClone[this.currentKey] = this.currentToken;
					} else if (this.stack[this.stack.length - 1].type === "array") {
						if (!Array.isArray(currentClone)) currentClone = [this.currentToken];
						else if (currentClone.length === 0 || currentClone[currentClone.length - 1] !== this.currentToken) {
							currentClone.push(this.currentToken);
						}
					}
				}
				preview.push({ ...this.currentEntity, value: partialValue });
			} else {
				preview.push(this.currentEntity);
			}
		}
		return { complete: this.hasEndBeenCalled, entities: preview };
	}

	end({ reset = true } = {}) {
		this.hasEndBeenCalled = true;
		return this.flush().then(() => {
			if (this.mode === "TEXT" && this.textBuffer) {
				this.entities.push({ finished: true, value: this.textBuffer });
				this.textBuffer = "";
			} else if (this.mode === "JSON" && !this.currentEntity.finished) {
				this.currentEntity.finished = true;
				if (!this.entities.includes(this.currentEntity))
					this.entities.push(this.currentEntity);
			}
			const finalState = this.getPreview();
			this.emit("updateObject", finalState);
			if (reset) this.reset();
			return finalState;
		});
	}

	reset() {
		this.buffer = "";
		this.pos = 0;
		this.mode = "TEXT";
		this.currentState = STATE_TEXT;
		this.textBuffer = "";
		this.stack = [];
		this.currentToken = "";
		this.currentKey = null;
		this.entities = [];
		this.currentEntity = { finished: false, value: null, id: null };
		this.hasEndBeenCalled = false;
		this._processing = false;
	}

	waitForEvents() {
		return new Promise(resolve => {
			this.on('updateObject', (obj) => {
				if (obj.complete) {
					resolve(obj);
				}
			});
		});
	}
}

module.exports = JSONStreamingParser;