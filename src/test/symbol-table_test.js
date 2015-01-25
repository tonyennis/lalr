"use strict;"

var assert = require("assert"),
	SymbolTable = require("../lalr4/symbol-table");

describe.only("symbol-table", function () {
	var st;
	var make = function (v) {
		return v + ":numeric_temp";
	};
	beforeEach(function () {
		st = new SymbolTable();
	});
	describe("addId()", function () {
		it("should find a known entry", function () {
			var v = st.addId("1", SymbolTable.NUMERIC_TYPE, true);
			var entry = st.get(v);
			assert(entry);
			assert(entry.isConstant);
			assert(entry.constantValue === "1");
			assert(entry.type === SymbolTable.NUMERIC_TYPE, true);
		});
		it("should not find an unknown entry", function () {
			var v = st.addId("1", SymbolTable.NUMERIC_TYPE, true);
			assert(typeof st.get("zoot") === 'undefined');
		});
		it("should find a known variable by the symbol name", function () {
			var v2 = st.addId("1", SymbolTable.NUMERIC_TYPE, true);
			var v = st.get("1");
			assert(v);
			assert.equal(v.name, v2);
		});
		it("should allocate a temp variable", function () {
			var name = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			assert(name);
			var e = st.get(name);
			assert(e);
			assert(e.type === SymbolTable.NUMERIC_TYPE);
			assert(!e.isConst);
		});
		it("should allocate several temp variables without reusing any", function () {
			var store = [];
			var count = 10;
			for (var i = 0; i < count; i++) {
				var v = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
				store[v] = v;
			}
			assert(Object.keys(store).length === count);
		});
		it("should reuse a temp variable", function () {
			var v = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			assert(v);
			st.free(v);
			var v2 = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			assert(v2);
			assert(v2.name === v.name);
		});
		it("should fail if too many temp variables are allocated", function () {
			for (var i = 0; i < SymbolTable.MAX; i++) {
				var v = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			}
			assert(true);
			assert.throws(function () {
				st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			});
		});
		it("should fail if the type is unknown", function(){
			assert.throws(function(){
				st.addId(undefined, "zoot");
			});
		});
		it("should fail if the usage is unknown", function(){
			assert.throws(function(){
				st.addId(undefined, SymbolTable.NUMERIC_TYPE, false, undefined, "zoot");
			});
		});
		it("should default with gusto", function(){
			var e = st.get(st.addId());
			assert(e);
			assert(e.type === SymbolTable.NUMERIC_TYPE);
			assert(e.usage === SymbolTable.LOCAL_VARIABLE_TYPE);
			assert(e.isTemp);
			assert(!e.isArray);
			assert(!e.isConst);
			assert.equal(e.name, (SymbolTable.MAX-1)+":"+SymbolTable.NUMERIC_TYPE);
		});
	});
	describe("get()", function () {
		it("should get by name", function(){
			var v = st.addId(undefined, SymbolTable.NUMERIC_TYPE, false);
			assert(v);
			var e = st.get(v);
			assert(e);
		});
		it("should get by symbol name", function(){
			var v = st.addId("zoot", SymbolTable.NUMERIC_TYPE, false);
			assert(v);
			var e1 = st.get("zoot");
			assert(e1.symbolName === "zoot");
			assert(e1.name === v);
		});
	});
	describe("calculateArrayIndexMultipliers()", function(){
		it ("should calculate when there is one index", function(){
			var v = st.addId("zoot", SymbolTable.NUMERIC_TYPE, false);
			st.setSymbolArrayBounds(v, [5]);
			var e = st.get(v);
			assert(e);
			SymbolTable.calculateArrayIndexMultipliers(e);
			assert(e.boundsMult.length === 1);
			assert(e.boundsMult[0] === 1);
		});
		it ("should calculate when there are many indexes", function(){
			var v = st.addId("zoot", SymbolTable.NUMERIC_TYPE, false);
			st.setSymbolArrayBounds(v, [5,7,8,9]);
			var e = st.get(v);
			assert(e);
			SymbolTable.calculateArrayIndexMultipliers(e);
			assert(e.boundsMult.length === 4);
			assert(e.boundsMult[0] === 7*8*9*1);
			assert(e.boundsMult[1] === 8*9*1);
			assert(e.boundsMult[2] === 9*1);
			assert(e.boundsMult[3] === 1);

		});
	});
});