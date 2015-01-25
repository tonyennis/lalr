'use strict';

var Itemsets = require("./itemsets");
var Grammar = require("./grammar");
var First = require("./first");
var Follow = require("./follow");
var Util = require("./util");

var LALR1 = module.exports = function LALR1() {
};

LALR1.prototype.build = function (prods) {
	var grammar = new Grammar(prods);
	grammar.productions.forEach(function (p) {
		if (typeof p.reductionId === 'undefined') throw new Error("assert - expected all grammar productions to have reduction IDs. " + JSON.stringify(p));
	});
	var itemsets = new Itemsets();

	itemsets.construct(grammar.productions, Itemsets.initialKernel(grammar.startingProd));
	this.first = new First();
	this.follow = new Follow();
	this.first.calc(grammar);
	this.follow.calc(grammar, this.first);

	this.sortedSymbols = grammar.calcSortedSymbols();
	itemsets.buildTable(this.sortedSymbols, this.follow);

	this.table = itemsets.table;
	this.productions = grammar.productions;
	this.sets = itemsets;

	return this;
};

LALR1.prototype.firstFollowToString = function(){
	var s = this.first.toString();
	s += this.follow.toString();
	return s;
};

LALR1.prototype.productionsString = function () {
	var s = Util.box("Productions");
	for (var i = 0; i < this.productions.length; i++) {
		s += this.productions[i].toString()+"\n";
	}
	return s;
};
LALR1.prototype.tableString = function () {
	var s = Util.box("Action Table"),
		j;
	s += ",";

	for (j = 0; j < this.sortedSymbols.length; j++) {
		s += this.sortedSymbols[j] + ",";
	}
	s += "\n";
	for (var i = 0; i < this.table.length; i++) {
		s += i + ",";
		for (j = 0; j < this.sortedSymbols.length; j++) {
			s += this.table[i][this.sortedSymbols[j]].nice() + ",";
		}
		s += "\n";
	}
	return s;
};
