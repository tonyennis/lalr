var assert = require("assert"),
	M3 = require("../lalr4/m3");

describe("m3", function () {
	var m3;
	beforeEach(function () {
		m3 = new M3();
	});
	describe("core functionality", function () {
		it("should fault on an unknown instruction", function () {
			var program = ["cow"];
			m3.run(program);
			assert(m3.FF);
		});
		it("should fault on an malformed address mode", function () {
			var program = ["lda", 400, "hlt"];
			m3.run(program);
			assert(m3.FF);
		});
		it("should fault on an invalid address mode", function () {
			var program = ["asl", "(#$100),Y", "hlt"];
			m3.run(program);
			assert(m3.FF);
		});
	});
	describe("addressing mode tests", function () {
		it("should load and run", function () {
			var program = ["hlt"];
			m3.run(program);
			assert(m3.FH);
		});
		it("should test immediate addressing", function () {
			var program = ["lda", "#$1000", "HLT"];
			m3.run(program);
			assert.equal(m3.A, 1000);
		});
		it("should test absolute addressing", function () {
			var program = ["lda", "$1000", "HLT"];
			m3.run(program);
			assert.equal(m3.A, 1000);
		});
		it("Should test absolute+x addressing", function () {
			var program = ["ldx", "#$100", "lda", "$1000,X", "HLT"];
			m3.run(program);
			assert.equal(m3.A, 1100);
		});
		it("Should test absolute+y addressing", function () {
			var program = ["ldy", "#$111", "lda", "$1000,Y", "HLT"];
			m3.run(program);
			assert.equal(m3.A, 1111);
		});
		it("Should test indirect+x addressing", function () {
			var program = ["ldx", "#$3", "lda", "($2,X)", "HLT", 234];
			m3.run(program);
			assert.equal(m3.A, 234);
		});
		it("Should test indirect+y addressing", function () {
			var program = ["ldy", "#$5", "lda", "($5),Y", "HLT", 234];
			m3.run(program);
			assert.equal(m3.A, 239);
		});
		it("Should test indirect addressing", function () {
			var program = ["lda", "#$0", "jmp", "($5)", "hlt", 6, "lda", "#$1", "hlt"];
			m3.run(program);
			assert.equal(m3.A, 1);
		});
		it("should test accumulator addressing.", function () {
			var program = ["lda", "#$100", "asl", "A", "hlt"];
			m3.run(program);
			assert.equal(m3.A, 200);
		});
		it("should hit the 'memory' side of the asl opcode.", function () {
			var program = ["lda", "#$50", "sta", "$7", "asl", "$7", "hlt", 0];
			m3.run(program);
			assert.equal(m3.memory[7], 100);
		});
		it("should test relative addressing", function () {
			var program = ["lda", "#$1", "cmp", "#$0", "bne", "$3", "hlt", "lda", "#$2", "hlt"];
			m3.run(program);
			assert.equal(m3.A, 2);
		});
		it("should test implied addressing", function () {
			var program = ["ldx", "#$0", "inx", "hlt"];
			m3.run(program);
			assert.equal(m3.X, 1);
		});
	});
	describe("integration", function () {
		it("should calculate the sum of a series of integers", function () {
			var program = [
				"ldx", "#$0",	// Used in the adc below.
				"lda", "#$20",	// this is the counter initial value. result should be 210
				"sta", "$101", 	// The counter. I'm counting down.
				"lda", "#$0",	// this is the sum
				"adc", "($101,X)",// Add the current counter
				"dec", "$101",
				"bne", "$-4",	// loop backward if the counter isn't zero
				"sta", "$100",	// save it
				"hlt"
			];
			m3.run(program);
			assert.equal(m3.memory[100], (20 * 21) / 2);
		});
		it("should calculate e", function(){
			var program = [
				"ldx", "#$0",	// Used for indirect addressing
				"lda", "#$1",
				"sta", "$100",	// This is the running denominator. it's a factorial.
				"lda", "#$20",
				"sta", "$101",	// This is the interation count. Exit when zero.
				"lda", "#$1",
				"sta", "$102",	// This is the count to take the factorial to the next step
				"lda", "#$1",
				"sta", "$103",	// This is the estimation of e.
								// top of loop.
				"lda", "($100,X)",	// get the running denominator
				"mul", "($102)",	// Now we have a new denominator
				"sta", "$100",		// save it for the next loop
				"lda", "#$1",		// numerator...
				"div", "($100)",	// we've now calculated 1/denom
				"adc", "($103,X)",
				"sta", "$103",		// running sum... accomplished!
				"inc", "$102",		// will be used in the denominator for the next cycle
				"dec", "$101",		// reduce the iteration count
				"bne", "$-18",
				"hlt"
			];
			m3.run(program);
			assert.equal(m3.memory[103], 2.7182818284590455);
		});
		it("should just call a simple subroutine", function(){
			var program = [
				"lda", "#$10",		// The value to increment.
				"pha",				// Push it
				"jsp", "$7",		// gosub the INC function
				"pla",				// get the result from the stack, into A
				"hlt",
				// This is an INC subroutine. It adds 1 to the SP+1 value
				"tsx",				// x now has the SP
				"lda", "($1,X)",	// This should load into A the SP+1 value. (SP+0 is the return addr.)
				"adc", "#$1",		// increment it, to show something changed
				"sta", "$1,X",		// replace it on the stack
				"lda", "#$0",		// clear it to make it easier to see the change
				"rts"
			];
			m3.run(program);
			assert.equal(m3.A, 11);
		});
		it("should calculate a factorial using recursion", function(){

			var program = [
				"lda", "#$0",
				"pha",				// This will be the return value
				"lda", "#$10",		// The value to factorial.
				"pha",				// Push it
				"jsp", "$11",		// gosub the INC function
				"pla",
				"pla",
				"hlt",
				// this is the factorial routine.
				// SP+0 is the return addr.
				// SP+1 is the value to factorial coming in
				// SP+2 is the return value
				"tsx",				// x now has the SP
				"lda", "($1,X)",	// We're taking the factorial of this value
				"cmp", "#$1",		// If it's one, we're done and can start returning
				"bne", "$3",
				// If the value is 1, then we have recursed to the bottom and can start going back up.
				"rts",
				// This is the 'else', where we have to reduce the value and go deeper.
				"adc", "#$-1",		// This is the new value
				"pha",				// Push storage for the return value.
				"pha",				// Push the value associated with this iteration.
				"jsp", "$11",		// Recurse.
									// Now we have to do a little dance to prepare for the multiply.
									// Since we just returned, the TOS no longer has an address on it -
									// we just consumed it. Now the TOS has the items we pushed a few
									// instructions ago. Since this routine pushed them, it is responsible
									// for removing them.
				"pla",				// The original value is of no use.
				"pla",				// A is now the result of the deeper recursion levels.
				"sta", "$100",
				"tsx",
				"lda", "($1,X)",	// Get the caller's value
				"mul", "($100)",	// multiply by the result.
				"sta", "$2,X",		// ...and save the result there
				"rts"
			];
			m3.run(program);
			assert.equal(m3.A, 3628800);
		});
	});
});