'use strict'

var assert = require("assert");
var lalr = require("./lalr").exports;

describe('lalr', function () {
	describe('isNonTerm', function () {
		it('should recognize A', function () {
			assert(lalr.isNonTerm("A"));
		});
		it('should recognize Z', function () {
			assert(lalr.isNonTerm("Z"));
		});
		it('should not recognize +', function () {
			assert(!lalr.isNonTerm("+"));
		});
		it('should recognize M', function () {
			assert(lalr.isNonTerm("M"));
		});
		it('should not recognize m', function () {
			assert(!lalr.isNonTerm("m"));
		});
	});
	describe('depleted', function () {
		it('should recognize that the dot is too far', function () {
			var prod = {dot: 3, rhs: [1, 2, 3]};
			assert(lalr.depleted(prod));
		});
		it('should recognize that he dot is not too far', function () {
			var prod = {dot: 2, rhs: [1, 2, 3]};
			assert(!lalr.depleted(prod));
		});
	});
	describe('advance', function () {
		it('should advance', function () {
			var prod = {dot: 2, rhs: [1, 2, 3]};
			lalr.advance(prod);
			assert(prod.dot === 3);
		});
		it('should not advance', function () {
			var prod = {dot: 3, rhs: [1, 2, 3]};
			lalr.advance(prod);
			assert(prod.dot === 3);
		});
	});
	describe('findAllNextSymbs', function () {
		it('should return a dedupped list of symbols', function () {
			var itemlist = {
				productions: [
				{dot: 0, rhs: ["A", "B"]},
				{dot: 0, rhs: ["A", "C"]},
				{dot: 1, rhs: ["A", "B"]},
				{dot: 2, rhs: ["A", "X", "B"]}
			]};
			var symbs = lalr.findAllNextSymbs(itemlist);
			assert(symbs.length == 2);
			assert(symbs.indexOf("A") >= 0);
			assert(symbs.indexOf("B") >= 0);
		});
	});
	describe("findByDotSymb", function(){
		it("should find the expected productions", function(){
			var itemlist = {
				productions: [
					{dot: 0, rhs: ["A", "B"]},
					{dot: 0, rhs: ["A", "C"]},
					{dot: 1, name: "X", rhs: ["A", "B"]},
					{dot: 2, name: "Y", rhs: ["A", "X", "B"]}]
			};
			var prods = lalr.findByDotSymb(itemlist, "B");
			assert(prods.length==2);
			assert(prods[0].name !== prods[1].name);
			assert(["X","Y"].indexOf(prods[0].name) >= 0);
			assert(["X","Y"].indexOf(prods[1].name) >= 0);
			// Now ensure we got a copy and aren't banging on itemlist.
			prods[0].dot = 100;
			prods[1].dot = 101;
			assert(itemlist.productions[2].dot === 1, "itemlist[1].dot is "+itemlist.productions[1].dot);
			assert(itemlist.productions[3].dot === 2);
		});
	});
	describe("findByName", function(){
		var prodlist = [
			{dot: 0, name: "W", rhs: ["A", "B"]},
			{dot: 0, name: "Y", rhs: ["A", "C"]},
			{dot: 1, name: "Y", rhs: ["A", "B"]},
			{dot: 2, name: "Z", rhs: ["A", "X", "B"]}];
		var prod = lalr.findByName(prodlist, "Y");
		assert(prod.length === 2);
		assert.deepEqual(prod[0].name, "Y");
		assert.deepEqual(prod[1].name, "Y");
		prod[0].dot = 100;
		assert(prodlist[1].dot === 0, "expected 0, but saw prodlist[1].dot="+prodlist[1].dot);
		prod[1].dot = 101;
		assert(prodlist[2].dot === 1, "expected 1, but saw prodlist[1].dot="+prodlist[2].dot);
	});
});
