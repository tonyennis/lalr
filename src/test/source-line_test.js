"use strict;"

var assert = require("assert"),
	Token = require("../lalr4/token"),
	SourceLine = require("../lalr4/source-line");


describe.only("source-line", function () {
	var sl,
		t1 = new Token("c1", "v1"),
		t2 = new Token("c2", "v2"),
		t3 = new Token("c3", "v3");

	beforeEach(function () {
		sl = new SourceLine();
	});

	it("should have no value when one value is added", function () {
		sl.add(t1);
		assert(sl.get()==="");
		assert(sl.next==="v1");
	});
	it("should have a value when the second value is added", function () {
		sl.add(t1);
		sl.add(t2);
		assert(sl.get()==="v1");
		assert(sl.next==="v2");
	});
	it("should append values", function () {
		sl.add(t1);
		sl.add(t2);
		sl.add(t3);
		assert.equal(sl.get(),"v1 v2");
		assert(sl.next==="v3");
	});
	it("should return the text on clear (1)", function(){
		assert(sl.clear() === "");
	});
	it("should return the text on clear (2)", function(){
		sl.add(t1);
		sl.add(t2);
		sl.add(t3);
		assert(sl.clear() === "v1 v2");
		assert(sl.next === "");
		assert(sl.text === "v3");
	});
});