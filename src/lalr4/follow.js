"use strict;"

var Util = require("./util");

var Follow = module.exports = function Follow() {
	this.follow = {};
};

Follow.prototype.init = function (name) {
	this.follow[name] = this.follow[name] || {symbols: []};
};

Follow.prototype.add = function (name, symbol) {
	if (Util.isTerminal(name)) return;	// Nyet.
	this.init(name);
	if (this.follow[name].symbols.indexOf(symbol) < 0) this.follow[name].symbols.push(symbol);
};

Follow.prototype.addSet = function (name, set) {
	for (var i = 0; i < set.length; i++) {
		this.add(name, set[i]);
	}
};

Follow.prototype.followSet = function(name) {
	return (this.follow[name] && this.follow[name].symbols) || [];
};

Follow.prototype.calc = function (grammar, first) {
	var PANIC = 100,
		panic = 0,
		i,
		j,
		oldFollow = "";

	this.add(grammar.start, "$");
	while (panic++ < PANIC && JSON.stringify(this) !== oldFollow) {
		oldFollow = JSON.stringify(this);
		for (i = 0; i < grammar.productions.length; i++) {
			var p = grammar.productions[i];
			// The -1 is not a mistake. There is a different rule for the last symbol in a production
			for (j = 0; j < p.rhs.length - 1; j++) {
				var objSymb = p.rhs[j];
				var nextSymb = p.rhs[j + 1];
				if (Util.isTerminal(nextSymb)) {
					this.add(objSymb, nextSymb);
				}
				else {
					this.addSet(objSymb, first.symbols(nextSymb));
				}
			}
			// Now, if the last symbol can produce epsilon, add follow(name) to follow(second-to-last)
			if (first.hasEpsilon(p.rhs[p.rhs.length-1])) {
				this.addSet(p.rhs[p.rhs.length-2], this.followSet(p.name));
			}
			// If the last symbol is a nonterm, then anything that can follow this production can follow
			// the last symbol.
			if (Util.isNonterminal(p.rhs[p.rhs.length-1])) {
				this.addSet(p.rhs[p.rhs.length-1], this.followSet(p.name));
			}
		}
	}
	if (panic === PANIC) throw new Error("Panic in follow " + this.toString());

};

Follow.prototype.toString = function () {
	var s = Util.box("Follow sets");
	var self = this;
	Object.keys(this.follow).forEach(function (x) {
		var set = self.followSet(x);
		s += x + " { ";
		set.forEach(function (y) {
			s += y + " ";
		});
		s += "}\n";
	});
	return s;
};