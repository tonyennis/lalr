var assert = require("assert");
var First = require("../lalr4/first");
var Grammar = require("../lalr4/grammar");
var Production = require("../lalr4/Production");

describe("first", function () {
	var first;
	beforeEach(function () {
		first = new First();
	});
	describe("init", function () {
		it("should initialize an empty name", function () {
			first.init("empty");
			assert.equal(first.first.empty.symbols.length, 0);
			assert.equal(first.first.empty.hasEpsilon, false);
		});
		it("should not initialize a non-empty name", function () {
			first.init("empty");
			first.first.empty.symbols = ['a'];
			first.init("empty");
			assert.equal(first.first.empty.symbols.length, 1);
		});
	});
	describe("hasEpsilon", function () {
		it("should return epsilon when true", function () {
			first.init("A");
			first.first["A"].hasEpsilon = true;
			assert(first.hasEpsilon("A"));
		});
		it("should return epsilon when false", function () {
			first.init("A");
			assert(!first.hasEpsilon("A"));
		});
	});
	describe("add", function () {
		it("should add a symbol", function () {
			first.add("name", "a", false);
			assert.equal(first.first["name"].symbols.length, 1);
			assert.deepEqual(first.first["name"].symbols, ["a"]);
			assert.equal(first.hasEpsilon("name"), false);
		});
		it("should not add duplicates", function () {
			first.add("name", "a", false);
			first.add("name", "a", false);
			assert.equal(first.first["name"].symbols.length, 1);
		});
		it("should set the epsilon flag", function () {
			first.add("name", First.EPSILON, true);
			assert.equal(first.hasEpsilon("name"), true);
		});
		it("should not set the epsilon flag", function () {
			first.add("name", "", false);
			assert.equal(first.hasEpsilon("name"), false);
		});
	});
	describe("addNonterm", function () {
		it("should add one first set to another", function () {
			first.add("name", "a", false);
			first.add("zoot", "b", false);
			first.add("zoot", "c", false);
			first.add("zoot", "d", false);
			first.addNonterm("name", "zoot");
			assert.equal(first.first["name"].symbols.length, 4);
		});
	});
	describe("calc", function () {
		it("should calculate simple first sets", function () {
			var g = new Grammar([
				new Production("A", ["a"]),
				new Production("A", ["b"]),
				new Production("A", ["c"])
			]);
			first.calc(g);
			assert.deepEqual(first.first["A"].symbols, ["a", "b", "c"]);
		});
		it("should calculate indirect first sets", function () {
			var g = new Grammar([
				new Production("A", ["B", "C", "D"]),
				new Production("B", ["D"]),
				new Production("C", ["c"]),
				new Production("D", ["x"])
			]);
			first.calc(g);
			assert.deepEqual(first.first["A"].symbols, ["x"]);
		});
		it("should calculate indirect first sets with epsilons", function () {
			var g = new Grammar([
				new Production("A", ["B", "C", "D"]),
				new Production("B", [""]),
				new Production("C", [""]),
				new Production("D", ["x"])
			]);
			first.calc(g);
			assert.deepEqual(first.first["A"].symbols, ["x"]);
		});
		it("should set epsilon if all rhs produce epsilon", function () {
			var g = new Grammar([
				new Production("A", ["B", "C", "D"]),
				new Production("B", ["D"]),
				new Production("C", [""]),
				new Production("D", [""]),
				new Production("D", ["x"])
			]);
			first.calc(g);
			assert.deepEqual(first.first["A"].symbols, ["x"]);
			assert(first.hasEpsilon("A")); // multiple non-terms
			assert(first.hasEpsilon("B")); // One non-term
		});
	});
});
