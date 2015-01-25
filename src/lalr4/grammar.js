"use strict;"

var Production = require("./production");
var Util = require("./util");

var Grammar = module.exports = function Grammar(productions, start, artificial) {
	this.start = artificial || "S'"; // Note the artificial state is becoming the start state.
	this.startingProd = new Production(this.start, [start ? start : productions[0].name]);
	var tmp = [];
	tmp.push(this.startingProd);
	this.productions = tmp.concat(productions);
	for(var i = 0; i<this.productions.length; i++) this.productions[i].reductionId = i;
};

Grammar.prototype.toString = function() {
	var s = "";
	this.productions.forEach(function(p){
		s += p.toString() + "\n";
	});
	return s;
};

Grammar.prototype.calcSortedSymbols = function() {
	var symbols = {};
	symbols['$'] = '$';
	this.productions.forEach(function(p){
		p.rhs.forEach(function(s){
			symbols[s] = s;
		});
	});
	return Object.keys(symbols).sort(function(a, b){
		if (a === '$') return -1;
		if (b === '$') return 1;
		if (!Util.isNonterminal(a) && Util.isNonterminal(b)) return -1;
		if (Util.isNonterminal(a) && !Util.isNonterminal(b)) return 1;
		return a < b ? -1 : 1;
	});
};
