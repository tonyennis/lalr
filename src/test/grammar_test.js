var assert = require("assert");
var Grammar = require("../lalr4/grammar");
var Production = require("../lalr4/Production");

describe("Grammar", function () {
	describe("calcSortedSymbols", function () {
		it("should sort terminals properly", function () {
			var g = new Grammar([
				new Production("A", ["c","b","a"]),
				new Production("B", ["c","d","a"])
			]);
			assert.deepEqual(g.calcSortedSymbols(), ["$", "a", "b", "c", "d", "A"]);
		});
		it("should sort nonterminals properly", function () {
			var g = new Grammar([
				new Production("A", ["C","D","A"]),
				new Production("B", ["M","Z","D","B"])
			]);
			assert.deepEqual(g.calcSortedSymbols(), ["$", "A", "B", "C", "D", "M", "Z"]);
		});
		it("should sort of mix of terms and nonterms properly", function(){
			var g = new Grammar([
				new Production("A", ["Z","z","Y", "y"]),
				new Production("B", ["!!","d","D","B","b"])
			]);
			assert.deepEqual(g.calcSortedSymbols(), ["$", "!!", "b", "d", "y", "z", "A", "B", "D", "Y", "Z"]);
		});
	});
});