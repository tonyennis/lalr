"use strict";

var Token = module.exports = function Token(parserSymb, val) {
	this.parserSymb = parserSymb;	// This would be any symbol known to the parser - everything in LALR1.sortedSymbols
	this.val = val;
};
Token.prototype.toString = function () {
	//if (this.val === "??") return "[" + this.parserSymb + "]";
	//return "[" + this.parserSymb + "]";
	if (this.parserSymb === this.val) return "[" + this.parserSymb + "]";
	return "[" + this.parserSymb + ":" + this.val + "]";
};

Token.prototype.isNonterm = function() {
	return this.parserSymb >= "A" && this.parserSymb <= "Z";
};

Token.prototype.isTerm = function () {
	return !this.isNonterm();
};