var Token = module.exports = function Token(parserSymb, val) {
	this.parserSymb = parserSymb;	// This would be any symbol known to the parser - everything in LALR1.sortedSymbols
	this.val = val;
};
Token.prototype.toString = function () {
	return "[" + this.parserSymb + ":" + this.val + "]";
};
