var assert = require("assert"),
	Machine = require("../lalr4/machine");

describe("Machine", function () {
	var m;
	beforeEach(function () {
		m = new Machine();
	});
	describe("load", function () {
		it("should use a default memory size", function () {
			var program = [1, 2, 3];
			m.load(program);
			assert.equal(m.memory.length, program.length + 1000);
			assert.equal(m.r[Machine.IP], 0);
			assert.equal(m.r[Machine.SP], program.length);
			assert.equal(m.r[Machine.HP], 1000 + program.length - 1);
		});
		it("should use allow a given memory size", function () {
			var memSize = 20;
			var program = [1, 2, 3];
			m.load(program, memSize);
			assert.equal(m.memory.length, program.length + memSize);
			assert.equal(m.r[Machine.IP], 0);
			assert.equal(m.r[Machine.SP], program.length);
			assert.equal(m.r[Machine.HP], memSize + program.length - 1);
		});
		it("should load to the correct location", function () {
			m.load([1, 2, 3]);
			assert(m.memory[0], 1);
			assert(m.memory[1], 2);
			assert(m.memory[2], 3);
		});
	});
	describe("utility routines", function () {
		describe("fetch", function () {
			it("not indirect, not stack", function () {
				var arg = 100;
				var res = m.fetch(arg, false, false);
				assert.equal(res, 100);
			});
			it("indirect, not stack", function () {
				var arg = 100;
				m.memory[100] = 50;
				var res = m.fetch(arg, true, false);
				assert(res, 50);
			});
			it("not indirect, stack", function () {
				var program = ["halt"];
				m.load(program);	// It's the easiest way to init the system.
				m.r[Machine.SP] += 2;	// Reserve room for 2 words
				m.memory[program.length] = 123;
				m.memory[program.length + 1] = 234;
				assert.equal(m.fetch(2, false, true), 123);
				assert.equal(m.fetch(1, false, true), 234);
			});
			it("indirect, stack", function () {
				var program = ["halt"];
				m.load(program);
				m.memory[10] = 1;	// This is the indirect offset
				m.r[Machine.SP] += 1;
				m.memory[m.r[Machine.SP] - 1] = 123;
				assert.equal(m.fetch(10, true, true), 123);
			});
		});
	});
	describe("individual instruction tests", function () {
		it("should halt", function () {
			m.load(["halt"]);
			m.run();
			assert(true);	// A failure should infinite-loop (or crash) and not get here
		});
		it("should set a memory location", function () {
			m.load(["mov", 4, 77, "halt", 0]);
			m.run();
			assert.equal(m.memory[4], 77);
		});
		it("should set a memory location indirect", function () {
			m.load(["mov_i", 4, 77, "halt", 0]);
			m.run();
			assert.equal(m.memory[4], 77);
		});
		it("should add absolute to the accumulator", function () {
			m.load(["clearAcc", "add", 10, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 10);
		});
		it("should subtract absolute from the accumulator", function () {
			m.load(["clearAcc", "sub", 10, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], -10);
		});
		it("should multiply absolute to the accumulator", function () {
			m.load(["clearAcc", "add", 100, "mult", 10, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1000);
		});
		it("should divide absolute to the accumulator", function () {
			m.load(["clearAcc", "add", 100, "div", 5, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 20);
		});
		it("should jump (absolute)", function () {
			m.load(["clearAcc", "jump", 4, "halt", "add", "1", "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);
		});
		it("should jump (indirect)", function () {
			m.load(["clearAcc", "jump_i", 7, "halt", "add", "1", "halt", 4]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);
		});
		it("should jump if acc != 0", function () {
			m.load(["clearAcc", "add", 1, "jumpNZ", 6, "halt", "add", 1, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 2);
		});
		it("should jump (indirect) if acc != 0", function () {
			m.load(["clearAcc", "add", 1, "jumpNZ_i", 9, "halt", "add", 1, "halt", 6]);
			m.run();
			assert.equal(m.r[Machine.ACC], 2);
		});
		it("should not jump if acc == 0", function () {
			m.load(["clearAcc", "jumpNZ", 4, "halt", "add", 1, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);
		});
		it("should not jump (indirect) if acc == 0", function () {
			m.load(["clearAcc", "jumpNZ_i", 7, "halt", "add", 1, "halt", 4]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);
		});

		it("should jumpZ if acc == 0", function () {
			m.load(["clearAcc", "jumpZ", 6, "halt", "add", 1, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);
		});
		it("should jumpZ (indirect) if acc == 0", function () {
			m.load(["clearAcc", "jumpZ_i", 7, "halt", "add", 1, "halt", 6]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);
		});
		it("should not jumpZ if acc != 0", function () {
			m.load(["clearAcc", "add", 1, "jumpZ", 6, "halt", "add", 1, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);
		});
		it("should not jump (indirect) if acc != 0", function () {
			m.load(["clearAcc", "add", 1, "jumpZ_i", 9, "halt", "add", 1, "halt", 6]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);
		});

		it("should 'or' with the accumulator where acc = 1, 0", function () {
			m.load(["clearAcc", "add", 2, "or", 0, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should 'or' with the accumulator where acc = 0, 0", function () {
			m.load(["clearAcc", "or", 0, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should 'or' with the accumulator where acc = 0, 1", function () {
			m.load(["clearAcc", "or", 3, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should 'or' with the accumulator where acc = 1, 1", function () {
			m.load(["clearAcc", "add", 9, "or", 3, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should 'and' with the accumulator where acc = 1, 0", function () {
			m.load(["clearAcc", "add", 2, "and", 0, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should 'and' with the accumulator where acc = 0, 0", function () {
			m.load(["clearAcc", "and", 0, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should 'and' with the accumulator where acc = 0, 1", function () {
			m.load(["clearAcc", "and", 3, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should 'and' with the accumulator where acc = 1, 1", function () {
			m.load(["clearAcc", "add", 9, "and", 3, "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should logical NOT the accumulator when it is 0", function () {
			m.load(["clearAcc", "not", "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should logical NOT the accumulator when it is 1", function () {
			m.load(["clearAcc", "add", 1, "not", "halt"]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should andInd where the indirect value is not 0", function () {
			m.load(["clearAcc", "add", 1, "and_i", 6, "halt", 3]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should andInd where the indirect value is 0", function () {
			m.load(["clearAcc", "add", 1, "and_i", 6, "halt", 0]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should orInd where the indirect value is not 0", function () {
			m.load(["clearAcc", "or_i", 4, "halt", 3]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1);	// Result is normalized to 1 or 0.
		});
		it("should orInd where the indirect value is 0", function () {
			m.load(["clearAcc", "or_i", 4, "halt", 0]);
			m.run();
			assert.equal(m.r[Machine.ACC], 0);	// Result is normalized to 1 or 0.
		});
		it("should addInd to the accumulator", function () {
			m.load(["clearAcc", "add_i", 4, "halt", 10]);
			m.run();
			assert.equal(m.r[Machine.ACC], 10);
		});
		it("should subInd from the accumulator", function () {
			m.load(["clearAcc", "sub_i", 4, "halt", 10]);
			m.run();
			assert.equal(m.r[Machine.ACC], -10);
		});
		it("should multInd the accumulator", function () {
			m.load(["clearAcc", "add", 100, "mult_i", 6, "halt", 10]);
			m.run();
			assert.equal(m.r[Machine.ACC], 1000);
		});
		it("should divInd the accumulator", function () {
			m.load(["clearAcc", "add", 100, "div_i", 6, "halt", 5]);
			m.run();
			assert.equal(m.r[Machine.ACC], 20);
		});

		it("should write the accumulator (direct, no stack)", function () {
			m.load(["clearAcc", "add", 100, "acc", 6, "halt", 0]);
			m.run();
			assert.equal(m.memory[6], 100);
		});
		it("should write the accumulator (indirect, no stack)", function () {
			m.load(["clearAcc", "add", 100, "acc_i", 6, "halt", 0]);
			m.run();
			assert.equal(m.memory[6], 100);
		});
		it("should write the accumulator (direct, stack)", function () {
			m.load(["alloc", 1, "clearAcc", "add", 100, "acc_d_s", 1, "halt"]);
			m.run();
			assert.equal(m.memory[8], 100);
		});
		it("should write the accumulator (indirect, stack)", function () {
			m.load(["alloc", 1, "clearAcc", "add", 100, "acc_i_s", 8, "halt", 1]);
			m.run();
			assert.equal(m.memory[9], 100);
		});

		it("should NOP like the wind", function () {
			m.load(["nop", "nop", "nop", "halt"]);
			m.run();
			assert(true);
		});
		it("should move R1 to ACC", function () {
			m.load(["mova1", "halt"]);
			m.r[Machine.R1] = 123;
			m.run();
			assert.equal(m.r[Machine.ACC], 123);
		});
		it("should move ACC to R1", function () {
			m.load(["mov1a", "halt"]);
			m.r[Machine.ACC] = 123;
			m.run();
			assert.equal(m.r[Machine.R1], 123);
		});
		it("should move R2 to ACC", function () {
			m.load(["mova2", "halt"]);
			m.r[Machine.R2] = 123;
			m.run();
			assert.equal(m.r[Machine.ACC], 123);
		});
		it("should move ACC to R2", function () {
			m.load(["mov2a", "halt"]);
			m.r[Machine.ACC] = 123;
			m.run();
			assert.equal(m.r[Machine.R2], 123);
		});
		it("should allocate memory from the stack", function () {
			var allocation = 10;
			var program = ["alloc", allocation, "halt"];
			m.load(program);
			var origSP = m.r[Machine.SP];
			m.run();
			assert.equal(m.r[Machine.SP], allocation + origSP);
		});
		it("should free memory from the stack", function () {
			var allocation = 10;
			var program = ["alloc", allocation, "free", allocation, "halt"];
			m.load(program);
			var origSP = m.r[Machine.SP];
			m.run();
			assert.equal(m.r[Machine.SP], origSP);
		});
	});
	describe("integration tests", function () {
		it("should sum integers in a loop", function () {
			var program = [
				"mov", 100, 20, /* This is the loop counter. It counts down. When 0, we exit. */
				"mov", 101, 0, /* This is the running total */
				"clearAcc",
				"add_i", 100, /* We need to initialize the accumulator so we enter the loop reliably */
				"jumpZ", 27, /* Jumps to the halt. The sum of the first 20 numbers will be in 101 */
				"clearAcc",
				"add_i", 101, /* Get the previous running total...*/
				"add_i", 100, /* Add to it the loop counter */
				"acc", 101, /* Squirrel this away */
				"clearAcc",
				"add_i", 100, /* Get the loop counter */
				"sub", 1, /* Decrement it */
				"acc", 100, /* Squirrel it away (but note the accumulator is unchanged...) */
				"jump", 9, /* This goes back to the "jumpZ" instruction */
				"halt"
			];
			m.load(program);
			m.run();
			console.log("Just for fun, this code used " + m.cycles + " cycles");
			assert.equal(m.memory[101], (20 * 21) / 2);
		});
		it("should sum integers in a loop using register instructions", function () {
			var program = [
				"mov", 100, 0, /* 100 is the sum of the loop counter */
				"clearAcc",
				"add", 20,
				"mov1a", /* R1 is the countdown value / loop counter */
				"jumpZ", 19, /* Jumps to the halt. The sum of the first 20 numbers will be in 100 */
				"add_i", 100, /* Add the current loop counter to the running total. */
				"acc_i", 100, /* save the running total */
				"mova1", /* Get the loop counter */
				"sub", 1, /* Decrement it */
				"mov1a", /* Squirrel it away (but note the accumulator is unchanged...) */
				"jump", 7, /* This goes back to the "jumpZ" instruction */
				"halt"
			];
			m.load(program);
			m.run();
			console.log("Just for fun, this code used " + m.cycles + " cycles");
			assert.equal(m.memory[100], (20 * 21) / 2);
		});
		it("should sum integers in a loop using register instructions and the stack", function () {
			var program = [
				"alloc", 1,			// Make room for the running sum
				"mov_a_s", 1, 0,	// Initialize the sum
				"clearAcc",
				"add", 20,
				"mov1a", /* R1 is the countdown value / loop counter */
				"jumpZ", 21, /* Jumps to the halt if we've counted down to zero */
				"add_a_s", 1, /* Add the running count to accumulator's loop counter. */
				"acc_a_s", 1, /* save the running total to the stack variable */
				"mova1", /* put the loop counter into the accumulator */
				"sub", 1, /* Decrement it */
				"mov1a", /* Squirrel it away again (but note the accumulator is unchanged...) */
				"jump", 9, /* This goes back to the "jumpZ" instruction */
				"halt"
			];
			m.load(program);
			m.run();
			console.log("Just for fun, this code used " + m.cycles + " cycles");
			assert.equal(m.memory[m.r[Machine.SP] - 1], (20 * 21) / 2);
		});
		it("should calculate e", function () {
			var program = [
				"alloc", 5,		// For the running sum (1) and the loop counter (2)
				"mov_a_s", 1, 1, // sum of the terms
				"mov_a_s", 2, 1, // previous denominator
				"mov_a_s", 3, 1, // current counter
				"mov_a_s", 4, 100,	// number of terms desired
				"mov_a_s", 5, 0,	// scratch space
				"clearAcc",
				"add_a_s", 4,
				"jumpZ", 54,

				"clearAcc",
				"add_a_s", 2,
				"mult_a_s", 3,
				"acc_a_s", 2,	// We've multiplied the previous denominator by the current counter
				"clearAcc",
				"add_a", 1,		// Now we have to invert the value.
				"div_a_s", 2,	// this is the complete term for this iteration

				"add_a_s", 1,	// Now the series has been summed to the current point.
				"acc_a_s", 1,	// ...and stored

				"clearAcc",
				"add_a_s", 3,
				"add_a", 1,
				"acc_a_s", 3,	// We've incremented the current counter

				"clearAcc",		// Now decrement the terms counter
				"add_a_s", 4,
				"sub_a", 1,
				"acc_a_s", 4,	// saved...
				"jump",20,
				"halt"
			];
			m.load(program);
			m.run();
			console.log("Just for fun, this code used " + m.cycles + " cycles. e is "+m.memory[m.r[Machine.SP] - 1]);
			var res = parseFloat(m.memory[m.r[Machine.SP]-1]).toFixed(15);
			assert.equal(res, 2.718281828459046);
		});
	});
});