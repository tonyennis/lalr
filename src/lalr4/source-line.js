"use strict";

var SourceLine = module.exports = function SourceLine() {
	this.text = "";
	this.next = "";
};

/**
 * The odd rotation below with 'next' addresses the fact that we are fetching the
 * text based upon a reduction, and the reduction only happens when we read too far.
 * Thus if we have a production A=B+C and scan A, =, B, + C, }
 * we reduce thre input when we see the }. if we just tacked the } onto the string without being careful,
 * the text produced for the reduction would include the } and look funny:  ; A = A + B }
 * This was the character that triggered the reduction does not get lumped into it.
 * @param token
 */
SourceLine.prototype.add = function (token) {
	if (!token) throw new Error("Assertion - add() called with no token.");
	// Build up a line of source
	// Add a space if there is already text and there is something to add, so we get "A B" instead of "AB"
	if (this.text.length > 0) this.text += " ";
	this.text += this.next;
	this.next = token.val;
};

SourceLine.prototype.get = function () {
	return this.text;
};

SourceLine.prototype.clear = function () {
	var tmp = this.text;
	this.text = this.next;
	this.next = "";
	return tmp;
};