var assert = require("assert");
var First = require("../lalr4/first");
var Grammar = require("../lalr4/grammar");
var Production = require("../lalr4/Production");
var Follow = require("../lalr4/Follow");

describe("follow", function () {
	var follow;
	beforeEach(function () {
		follow = new Follow();
	});
	describe("init", function(){
		it("should initialize an E name", function () {
			follow.init("E");
			assert.equal(follow.followSet("E").length, 0);
		});
		it("should not initialize a non-E name", function () {
			follow.init("E");
			follow.add("E", "a");
			follow.init("E");
			assert.equal(follow.followSet("E").length, 1);
		});
	});
	describe("add", function(){
		it("should allow an add to a set that doesn't exist", function(){
			follow.add("E", "a");
			assert.equal(follow.followSet("E").length, 1);
		});
		it("should allow multiple adds to a set", function(){
			follow.add("E", "a");
			follow.add("E", "b");
			follow.add("E", "c");
			assert.deepEqual(follow.followSet("E"), ["a", "b", "c"]);
		});
		it("should allow multiple names", function(){
			follow.add("A", "a");
			follow.add("A", "b");
			follow.add("B", "c");
			follow.add("B", "d");
			assert.deepEqual(follow.followSet("A"), ["a", "b"]);
			assert.deepEqual(follow.followSet("B"), ["c", "d"]);
		});
	});
	describe("addSet", function(){
		it("should allow an unknown name to accept a set", function(){
			follow.addSet("A", ["a","b","c"]);
			assert.deepEqual(follow.followSet("A"), ["a","b","c"]);
		});
		it("should allow multiple add sets", function(){
			follow.addSet("A", ["a","b","c"]);
			follow.addSet("A", ["d","e","f"]);
			assert.deepEqual(follow.followSet("A"), ["a","b","c","d","e","f"]);
		});
	});
	describe("followSet", function(){
		it("should not blow up if the name is unknown", function(){
			assert.deepEqual(follow.followSet("hmm"), []);
		});
		it("should return a set", function(){
			// Use two different adds just to make it a little different than other tests.
			follow.init("A");
			follow.addSet("A", ["a","b","c"]);
			follow.add("A", "d");
			assert.deepEqual(follow.followSet("A"), ["a","b","c","d"]);
		});

	});
	describe("calc (tests from algorithms presented at http://web.cs.dal.ca/~sjackson/lalr1.html)", function(){
		var go = function(g) {
			var first = new First();
			first.calc(g);
			follow.calc(g, first);
		};
		it("rule 1. $ added to follow of start production", function(){
			go(new Grammar([
				new Production("A", ["a"])
			]));
			assert.deepEqual(follow.followSet("S'"), ["$"]);
			assert.deepEqual(follow.followSet("S'"), follow.followSet("A")); // Rule 3
		});
		it("rule 2a. If A->a*Bb and b does not have epsilon, then follow(B) includes first(b)", function(){
			go(new Grammar([
				new Production("A", ["B", "C", "D"]),
				new Production("B", ["b"]),
				new Production("C", ["c"]),
				new Production("D", ["d"])
			]));
			assert.deepEqual(follow.followSet("B"), ["c"]);	// Rule 2
			assert.deepEqual(follow.followSet("C"), ["d"]); // Rule 2
			assert.deepEqual(follow.followSet("D"), follow.followSet("A")); // Rule 3
		});
		it("rule 2b. If A->a*Bb and b produces epsilon, then follow(B) includes follow(A)", function(){
			go(new Grammar([
				new Production("A", ["B", "C", "D"]),
				new Production("B", ["b"]),
				new Production("C", ["c"]),
				new Production("D", ["d"]),
				new Production("D", [""])
			]));
			assert.deepEqual(follow.followSet("C"), ["d", "$"]);
		});
		it("rule 4. The follow set of a terminal is the empty set", function(){
			assert.deepEqual(follow.followSet("a"), []);
		});
		it("test 1", function(){});
		it("test 1", function(){});
		it("test 1", function(){});
	});
});