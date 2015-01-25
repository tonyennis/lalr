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
	this.d = [];
};

/**
 * Global value and function to ensure new IDs don't get replicated.
 * @type {number}
 */
Context.id = 0;
Context.nextId = function () {
	return this.id++;
};

Context.label = 1000;
Context.nextLabel = function() {
	return this.label++;
};

Context.prototype.last = function () {
	return this.d[this.d.length-1];
};

Context.prototype.append = function (newContext) {
	var data = (newContext instanceof Context) ? newContext.d : newContext;
	var self = this;
	data.forEach(function (e) {
		self.d.push(e);
	});
};

Context.prototype.appendCode = function (code) {
	this.append([code]);
};

Context.prototype.lastResult = function () {
	return this.last()[0];
};

/**
 * This is a generic function.  It will find the first nonterm and append its context to the given context.
 * @param context
 * @param stack
 * @param options
 */
Context.straightCopy = function (context, stack, options) {
	for (var i = 0; i < stack.length; i++) {
		if (stack[i].isNonterm()) {
			context.append(stack[i].val);
			return;
		}
	}
	throw new Error("Unable to find a nonterminal " + stack);
};