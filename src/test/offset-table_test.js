"use strict;"

var assert = require("assert"),
	OffsetTable = require("../lalr4/offset-table"),
	SymbolTable = require("../lalr4/symbol-table");

describe("offset-table", function () {
	var ot;

	beforeEach(function () {
		ot = new OffsetTable();
	});
	describe("addId()", function () {
		it("should add a variable", function () {
			var name = "abc";
			//var type = SymbolTable.INTEGER_CONST_TYPE;
			type = "def";
			combined = name + ":" + type;
			var e = ot.addId(combined);
			assert(e);
			assert(e.name === combined);
			assert(e.symbol === name);
			assert(e.type === type);
		});
	});
	describe("orderedAdd()", function () {
		it("should add with arg usage", function () {
			assert(ot.firstArg);
			assert(ot.insertionOrder === 0);
			var e = ot.orderedAdd("x:y", "arg");
			assert(!ot.firstArg);
			assert(ot.insertionOrder === 2);
			assert(e);
			assert(e.name === "x:y");
			assert(e.symbol === "x");
			assert(e.type === "y");
			assert(e.usage = "arg");
			assert.equal(e.offset, 1);
		});
		it("should add with arg usage twice", function () {
			var e1 = ot.orderedAdd("x:y", "notarg");
			var e2 = ot.orderedAdd("y:y", "arg");
			var e3 = ot.orderedAdd("z:y", "arg");
			assert(e1.offset === 0);
			assert(e2.offset === 2);	// skipping 1 as it is the first 'arg'
			assert(e3.offset === 3);	// this time we don't have to skip
		});
		it("should add without arg usage", function () {
			var e1 = ot.orderedAdd("x:y", "notarg");
			var e2 = ot.orderedAdd("y:y", "notarg");
			var e3 = ot.orderedAdd("z:y", "notarg");
			assert(e1.offset === 0);
			assert(e2.offset === 1);
			assert(e3.offset === 2);
		});
		it("should not add duplicates and the dup should be ignored", function(){
			var e1 = ot.orderedAdd("x:y", "notarg");
			var e2 = ot.orderedAdd("x:y", "ignore");
			assert(e1.offset === e2.offset);
		});
		it("should reject constant args", function(){
			assert.throws(function(){
				ot.orderedAdd("1:integer_const", "arg");
			});
		});
		it ("should not add offsets to constants, or change the offset counter", function(){
			var e1 = ot.orderedAdd("1:integer_const", "something");
			assert(e1.isConst);
			assert(typeof e1.offset === 'undefined');
			assert.equal(e1.symbol, "1");
			assert(ot.insertionOrder === 0);
		});
	});
	describe("addWithoutOffset()", function () {
		it("should add an arg without adding the stack offset", function () {
			var e1 = ot.addWithoutOffset("x:y", "arg");
			assert.equal(typeof e1.offset, 'undefined');
			assert(e1.usage === 'arg');
		});
	});
	describe("getRelativeLabel()", function () {
		it("should return a label entry", function () {
			var e1 = ot.getRelativeLabel();
			assert.equal(e1.name, "L0:label");
			assert(e1.type === 'label');
			assert(e1.usage === 'label');
		});
	});
	describe("isConst", function () {
		it("should recognize int", function () {
			var e = ot.addId("a:" + SymbolTable.INTEGER_CONST_TYPE);
			assert(ot.isConst(e.name));
		});
		it("should recognize float", function () {
			var e = ot.addId("a:" + SymbolTable.FLOATING_CONST_TYPE);
			assert(ot.isConst(e.name));
		});
		it("should not recognize others", function () {
			var e = ot.addId("a:" + SymbolTable.NUMERIC_TEMP_TYPE);
			assert(!ot.isConst(e.name));
		});
	});
	describe("get()", function () {
		it("should get like you think it would", function () {
			ot.orderedAdd("a:y", "notarg");
			ot.orderedAdd("b:y", "notarg");
			ot.orderedAdd("c:y", "notarg");
			assert(ot.get("a:y").symbol === "a");
			assert(ot.get("b:y").symbol === "b");
			assert(ot.get("a:y").symbol === "a");
			assert(ot.get("c:y").symbol === "c");
			assert(ot.get("a:y").symbol === "a");
		});
	});
	describe("clearVariables()", function () {
		it("should remove everything from the table related to functions", function () {
			ot.orderedAdd("a1:y", "arg");
			ot.orderedAdd("b:y", "notarg");
			ot.orderedAdd("a2:y", "arg");
			ot.orderedAdd("c:y", "notarg");
			ot.orderedAdd("a3:y", "arg");
			ot.orderedAdd("d:y", "notarg");
			var l1 = ot.getRelativeLabel();
			var l2 = ot.getRelativeLabel();
			ot.clearVariables();
			assert(!ot.get("a1:y"));
			assert(!ot.get("a2:y"));
			assert(!ot.get("a3:y"));
			assert(ot.get(l1.name));
			assert(ot.get(l2.name));
			assert(ot.get("b:y"));
			assert(ot.get("c:y"));
			assert(ot.get("d:y"));
		});
	});
});
