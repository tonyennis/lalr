"use strict";

/**
 * Context is intended to be a bucket into which reductions lob something similar to 3 addr code.
 * Each element in the context would be an array, for now.
 * I'd expect that in the case of (new context, "a + b"), the reduction code would grab the context for "a",
 * copy it into the new context, do the same for "b", and then write to the new context the 3-addr code that
 * uses the last value of each of those individual contexts.
 * @type {Function}
 */

var Context = module.exports = function Context() {
	this.d = [];			// This is an array of user-defined information. It could be a mix of comments and 3-address code, for example.

	// this is the 'value' of the context.  If his context represented the result of an expression, the handle would
	// be the name of the result and would be used by the next expression.
	// Consider this source: a = b * c * d * e
	// this breaks down into individual math operations that generally look like  tmpx = var1 OP var2
	// When reducing one of these (or any other expression), the handle gives you a way to know what the
	// result of the entire subtree is. The reduction just uses the handle as though it were a scalar.
	this.handle = undefined;
};

Context.prototype.setHandle = function (h) {
	this.handle = h;
};

Context.prototype.getHandle = function () {
	return this.handle;
};

// This is probably a hack for something.
Context.prototype.last = function () {
	return this.d[this.d.length - 1];
};

Context.prototype.append = function (threeAddrCodes) {
	for (var i = 0; i < threeAddrCodes.length; i++) {
		this.d.push(threeAddrCodes[i]);
	}
};

/**
 * Replace the last result of the context if it is the same as the handle. This allows
 * unnecessary assignment statements to be omitted.
 * ADD tmp, 1, 2
 * ASSIGN v, tmp
 *
 * if the handle is "tmp", the context now becomes
 *
 * ADD v, 1, 2
 *
 * @param v
 * @returns {boolean}
 * TODO this probably does not belong here. Why are optimizations here??
 */
Context.prototype.backpatch = function (v) {
	if (this.d.length === 0) return false;
	var last = this.d[this.d.length - 1];
	// last[1] is the 'object' of the instruction.  That is, "tmp" and "v" in the examples in the comment.
	if (last[1] === this.getHandle()) {
		last[1] = v;
		this.setHandle(v);
		return true;
	} else {
		return false;
	}
};

Context.prototype.appendCode = function (code, newHandle) {
	if (!(code instanceof Array)) throw new Error("Assertion - expected an instance of Array, saw " + code);
	this.append([code]);
	if (newHandle) this.setHandle(newHandle);
};

Context.prototype.appendContext = function (aNewContext) {
	if (!(aNewContext instanceof Context)) throw new Error("Assertion - expected an instance of Context, saw " + aNewContext);
	this.append(aNewContext.d);
//	if (!aNewContext.getHandle())
//		throw new Error("Assertion - expected the new context to have a handle.");
	this.handle = aNewContext.getHandle() || "(No context supplied)";
};

/**
 * This is a generic function.  It will find all nonterms and append their contexts to the given context.
 * @param context
 * @param stack
 * @param options
 */
Context.straightCopy = function (context, stack, options) {
	var foundOne = false;
	for (var i = 0; i < stack.length; i++) {
		if (stack[i].isNonterm()) {
			context.appendContext(stack[i].val);
			foundOne = true;
			//return;
		}
	}
	if (!foundOne) throw new Error("Unable to find a nonterminal " + stack);
};

Context.prototype.toString = function () {
	var s = "";
	for (var i = 0; i < this.d.length; i++) {
		//var threeAddr = this.d[i];
		//s += threeAddr.join(", ");
		s += this.d[i]+"\n";
	}
	return s;
};
//Context.prototype.addText = function (newText) {
//	if (newText instanceof 'Array') {
//		for (var i = 0; i < newText.length; i++) this.text.push(newText[i]);
//	} else {
//		this.text.push(newText);
//	}
//};
//Context.prototype.concatText = function (newText) {
//	if (this.text.length > 0) {
//		this.text[this.text.length - 1] += newText;
//	} else {
//		this.addText(newText);
//	}
//};
//Context.prototype.getText = function () {
//	return this.text;
//};
//Context.prototype.clearText = function () {
//	this.text = [];
//};
