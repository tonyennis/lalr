"use strict;"

var Machine = module.exports = function Machine() {
	this.memory = [];
	this.running = false;
	this.cycles = undefined;	// The number if "instruction cycles" from start to halt.
};

var IP = 0,
	SP = 1,
	HP = 2,
	ACC = 3,
	R1 = 4,
	R2 = 5;

Machine.IP = IP;
Machine.SP = SP;
Machine.HP = HP;
Machine.ACC = ACC;
Machine.R1 = R1;
Machine.R2 = R2;

Machine.prototype.r = [];

Machine.prototype.load = function (program, memorySize) {
	var totalMemory = (memorySize || 1000) + program.length;
	this.memory = [];
	for (var i = 0; i < program.length; i++) this.memory[i] = program[i];
	for (var j = program.length; j < totalMemory; j++) this.memory[j] = Math.random();
	// Initialize the registers
	this.r = [];
	this.r[IP] = 0;
	this.r[SP] = program.length; // pop this once too often... and you die.
	this.r[HP] = totalMemory - 1;
	this.r[ACC] = Math.random();
	this.r[R1] = Math.random();
	this.r[R2] = Math.random();
};

Machine.prototype.run = function () {
	this.running = true;
	this.cycles = 0;
	while (this.running) {
		//console.log("\n" + this.dump());
		/**
		 * This is weak. But this isn't a real virtual machine, either. Indirect or direct addressing is
		 * specified as a I or D after an _.  So for "add indirect", the operand would be something like
		 * "add_i".
		 * Direct means to use the operand as a constant.  So [ADD_D, 4] would add 4 to the accumulator.
		 * Indirect means to use the value at memory location 4.  If [4] contained 100, [ADD_I, 4] would add
		 * 100 to the accumulator.
		 */
		var bits = this.atIP(0).split("_");
		var inst = bits[0];
		var indirect = (bits[1] && bits[1].toUpperCase() === "I") ? true: false;
		var stackOffset = (bits[2] && bits[2].toUpperCase() === "S") ? true: false;
		//console.log("***********************************");
		//console.log("inst:"+inst+"   indirect:"+indirect+"   stack:"+stackOffset);
		//console.log(this.dump());
		if (instructions[inst]) {
			instructions[inst](this, indirect, stackOffset);
		} else {
			console.log("Halting, unknown instruction:" + inst);
			console.log(this.dump());
			this.running = false;
		}
	}
};

Machine.prototype.dump = function () {
	var s = "";
	s += " IP: " + this.r[IP] + "\n";
	s += " SP: " + this.r[SP] + "\n";
	s += " HP: " + this.r[HP] + "\n";
	s += "ACC: " + this.r[ACC] + "\n";
	s += " R1: " + this.r[R1] + "\n";
	s += " R2: " + this.r[R2] + "\n";
	//s += "memory @IP:\n"+this.memory.slice(this.r[IP], this.r[IP]+5).join(" ");
	for (var i = 0; i < 10; i++) {
		s += (this.r[IP] + i) + " : " + this.memory[this.r[IP] + i] + "\n";
	}
	return s;
};

Machine.prototype.atIP = function (offset) {
	return this.memory[this.r[IP] + offset];
};

Machine.prototype.incIP = function (bump) {
	this.r[IP] += bump;
	this.cycles += bump;	// every argument (and the original instruction) costs a cycle
};

Machine.prototype.lhs = function (a, ind, stack) {
if (typeof ind === "undefined" || typeof stack === "undefined") throw new Error("assert - ind or stack were undefined");
	if (stack && ind) {
		this.cycles += 2;
		/* The offset math and the indirection each cost a cycle */
		return this.r[SP] - this.memory[a];
	}
	if (stack && !ind) {
		this.cycles += 1;
		/* The offset math costs a cycle */
		return this.r[SP] - a;
	}
	if (!stack && ind) {
		return a;
	}
};
Machine.prototype.fetch = function (a, ind, stack) {
	if (stack || ind) {
		this.cycles += 1;	// for the lookup in memory[]
		return this.memory[this.lhs(a, ind, stack)];
	}
	// It's just a constant.
	return a;
};

var instructions = {
	/**
	 * setAbs reg value - sets the register to the value
	 * ex: incAbs 3 1234
	 * sets r3 to 1,234
	 */
	mov: function (m, ind, stack) {
		if (!ind && !stack) ind = true;
		m.memory[m.lhs(m.atIP(1), ind, stack)] = m.atIP(2);
		m.cycles += 1;	// For the m.memory[] write
		m.incIP(3);
	},
	/**
	 * Stops program execution
	 */
	halt: function (m) {
		m.running = false;
	},
	/**
	 * addRegAbs, value - adds value to the accumulator
	 */
	add: function (m, ind, stack) {
		m.r[ACC] += m.fetch(m.atIP(1), ind, stack);
		m.cycles += 1;	// For the math
		m.incIP(2);
	},
	sub: function (m, ind, stack) {
		m.r[ACC] -= m.fetch(m.atIP(1), ind, stack);
		m.cycles += 1;	// For the math
		m.incIP(2);
	},
	mult: function (m, ind, stack) {
		m.r[ACC] *= m.fetch(m.atIP(1), ind, stack);
		m.cycles += 3;	// For the math
		m.incIP(2);
	},
	div: function (m, ind, stack) {
		m.r[ACC] /= m.fetch(m.atIP(1), ind, stack);
		m.cycles += 3;	// For the math
		m.incIP(2);
	},
	clearAcc: function (m) {
		m.r[ACC] = 0;
		m.incIP(1);
	},
	/**
	 * Jump
	 * @param m
	 */
	jump: function (m, ind, stack) {
		m.r[IP] = m.fetch(m.atIP(1), ind, stack);
	},

	/**
	 * Jump if ACC is 0
	 * @param m
	 */
	jumpNZ: function (m, ind, stack) {
		if (m.r[ACC] !== 0) m.r[IP] = m.fetch(m.atIP(1), ind, stack);
		else m.incIP(2);
	},

	/**
	 * Jump if ACC is 0
	 * @param m
	 */
	jumpZ: function (m, ind, stack) {
		if (m.r[ACC] === 0) m.r[IP] = m.fetch(m.atIP(1), ind, stack);
		else m.incIP(2);
	},

	or: function (m, ind, stack) {
		m.r[ACC] = (m.r[ACC] || m.fetch(m.atIP(1), ind, stack)) ? 1 : 0;
		m.incIP(2);
	},

	not: function (m) {
		m.r[ACC] = (!m.r[ACC]) ? 1 : 0;
		m.incIP(1);
	},

	/**
	 * Logically AND the accumulator with the value of the next word.
	 * @param m
	 */
	and: function (m, ind, stack) {
		m.r[ACC] = (m.r[ACC] && m.fetch(m.atIP(1), ind, stack)) ? 1 : 0;
		m.incIP(2);
	},

	/**
	 * Copy the accumulator
	 * @param m
	 * @param ind
	 */
	acc: function (m, ind, stack) {
		/*
		 If we're not indirect and not stack-based, then the argument is a constant. We can't write the
		 accumulator to a constant so make it indirect as a courtesy. Another option would be to fault.
		 */
		if (!ind && !stack) ind = true;
		m.memory[m.lhs(m.atIP(1), ind, stack)] = m.r[ACC];
		m.cycles += 1;	// For the assignment into m.memory[]
		m.incIP(2);
	},
	nop: function (m) {
		m.incIP(1);
	},

	mova1: function (m) {
		m.r[ACC] = m.r[R1];
		m.incIP(1);
	},
	mov1a: function (m) {
		m.r[R1] = m.r[ACC];
		m.incIP(1);
	},
	mova2: function (m) {
		m.r[ACC] = m.r[R2];
		m.incIP(1);
	},
	mov2a: function (m) {
		m.r[R2] = m.r[ACC];
		m.incIP(1);
	},
	alloc: function (m, ind, stack) {
		m.r[SP] += m.fetch(m.atIP(1), ind, stack);
		m.cycles += 1;	// For the math
		m.incIP(2);
	},
	free: function (m, ind, stack) {
		m.r[SP] -= m.fetch(m.atIP(1), ind, stack);
		m.cycles += 1;	// For the math
		m.incIP(2);
	},

};

