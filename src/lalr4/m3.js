"use strict";

/**
 * This class supports the majority of the 6502.
 * 1. I removed the interrupt bits
 * 2. I removed the math comparison bits that don't apply such as 'carry'
 * 3. I added MUL and DIV instructions
 * 4. I added a HLT (halt) instruction to return control to the caller.
 * 5. I added a fault flag to note bad instructions.
 *
 * @type {Function}
 */

var M3 = module.exports = function M3() {
	this.memory = [];
	// the registers
	this.X = undefined;
	this.Y = undefined;
	this.A = undefined;
	this.SP = undefined;
	this.PC = undefined;	// program counter AKA instruction pointer
	this.FZ = undefined;	// zero
	this.FN = undefined;	// negative
	this.FF = undefined;	// fault
	this.FH = undefined;	// halt
	this.PCChanged = undefined;	// Needed so we don't increment PC after jumps.

};

M3.prototype.cycleDump = function(options){
	var pad20 = function(s) {
		return (s+"                              ").substring(0,20);
	};
	var pad30 = function(s) {
		return (s+"                              ").substring(0,30);
	};
	var dataAmount = options.data_amount || 8;
	var s = "\n***************************************************************\n";
	s += "A:" + this.A + "   X:" + this.X + "   Y:" + this.Y + "   SP:" + this.SP + "   PC:" + this.PC + "\n";
	s += "FZ:" + this.FZ + "   FN:" + this.FN + "   FF:" + this.FF + "   FH:" + this.FH + "\n";
	var sc = [];
	var st = [];
	for (var i = this.PC; i < this.PC+dataAmount; i++) {
		var x = this.memory[i];
		var y = this.memory[i+1];
		if (typeof x === 'undefined') continue;
		if (/^[0-9]/.test(x)) continue;
		if (!isNaN(x)) continue;
		if (/^[a-z]/.test(x) && /^[\(#\$]/.test(y)) {
			sc.push(pad20(i + ": " + x + " " + y));
			i += 1;
		} else if (/^[a-z]/.test(x)) {
			sc.push(pad20(i + ": " + x));
		}
	}

	for (i = this.SP-((dataAmount/2)-1); i < this.SP+dataAmount/2; i++) {
		st.push(pad30((this.SP === i? " -> ": "    ")+ i + ": " + this.memory[i]));
	}

	s += "\n";
	for (i = 0; i<Math.max(sc.length, st.length); i++) {
		s += ((sc[i] ? sc[i] : pad20("")) + (st[i] ? st[i] : pad30(""))) + "\n";
	}

	return s;
};
M3.prototype.dump = function () {
	var s = "";
	s += "A:" + this.A + "   X:" + this.X + "   Y:" + this.Y + "   SP:" + this.SP + "   PC:" + this.PC + "\n";
	s += "FZ:" + this.FZ + "   FN:" + this.FN + "   FF:" + this.FF + "   FH:" + this.FH + "\n";
	for (var i = 0; i < this.memory.length; i++) {
		var x = this.memory[i];
		if (typeof x === 'undefined') continue;
		if (/^[0-9]/.test(x)) continue;
		if (!isNaN(x)) continue;
		if (/^[a-z]/.test(x)) {
			s += "\n" + i + ": " + x;
		} else {
			s += " " + x;
		}
	}
	if (this.SP >= 0) {
		s += "\n";
		for (i = this.SP-3; i < this.memory.length; i++) {
			s += "\n" +(this.SP === i? " -> ": "    ")+ i + ": " + this.memory[i];
		}
	} else {
		s += "\n(SP is corrupted)";
	}
	return s;
};

M3.prototype.run = function (program, options) {
	var memSize = options.memory_size || 200;
	var max = options.max_cycles || 100000000,
		cycleDump = options.cycle_dump || false,
		finalDump = options.final_dump || false;

	// This is sort of necessary - any stack variables that are not used (hey it happpens...) will not be
	// allocated by javascript.  That is, there are *holes* in memory and it just totally hoses stack math.
	// So make sure ever memory location has a value.
	for (var i = 0; i < memSize; i++) {
		this.memory[i] = Math.random() * 1000000 - 500000;
	}

	for (i = 0; i < program.length; i++) {
		// be a pal and lowercase everything and remove spaces too.
		this.memory[i] = program[i];
	}
	// Make sure the random values are not reliable.
	this.X = Math.random() * 1000000 - 500000;
	this.Y = Math.random() * 1000000 - 500000;
	this.A = Math.random() * 1000000 - 500000;
	this.SP = memSize;
	this.PC = 0;
	this.FF = false;
	this.FH = false;

	var instrCount = 0;	// If this exceeds max we're assuming an infinite loop and bailing.

	if (options.dumpSource) { console.log(this.dump()); }

	while (!this.FF && !this.FH) {
		if (cycleDump) console.log(this.cycleDump(options));

		if (instrCount++ > max) {
			this.FF = true;
			continue;
		}
		// Sanity check so we fail pretty soon.
		if (typeof this.A === 'undefined' || typeof this.X === 'undefined' || typeof this.Y === 'undefined'
			|| typeof this.PC === 'undefined' || typeof this.SP === 'undefined' || this.PC < 0) {
			this.FF = true;
			continue;
		}

		//console.log("PC: "+this.PC+", SP:"+this.SP);
		var opcode = this.memory[this.PC];
		var inst = this.instructionSet[opcode];
		if (!inst) {
			this.FF = true;
			continue;
		}

		// res is an array. element 0 has the address. element 1 has the number of words consumed by the instruction.
		// (It would be possible to cache the result of this function call using the PC
		// as an index. Then the laborious regex checking and decoding would not
		// be needed. Is someone was writing self-modifying code the cache would have
		// the be cleared. This would speed execution up. A mechanism for *noticing*
		// someone has accidently written self-modifying code would also be good.
		var res = this.determineAddress(inst.am);
		if (!res) {
			this.FF = true;
			continue;
		}

		this.PCChanged = false;
		inst.f(this, res[0]);
		if (!this.PCChanged) this.PC += res[1] + 1;
	}

	if (cycleDump) console.log(this.cycleDump(options));
	if (finalDump) console.log(this.dump());
};

M3.prototype.determineAddress = function (addrModeGroup) {
	for (var i = 0; i < Object.keys(addrModeGroup).length; i++) {
		var res = this.decodeAddrMode(addrModeGroup[i]);
		if (res) return res;
	}
};

M3.prototype.decodeAddrMode = function (addrMode) {
	if (!addrMode.r) return [true, 0];
	var n = this.memory[this.PC + 1];
	var matches = addrMode.r.exec(n || "");
	if (matches) return addrMode.f(this, Number(matches[1]));
	else return undefined;
};

M3.prototype.addrModes = {
	"immediate": {
		d: "immediate", r: /^\s*#\$(\-?\d+)\w*$/, f: function (m3, n) {
			return [n, 1]; // in 6502-ville would be a byte
		}
	},
	"absolute": {
		d: "absolute", r: /^\s*\$(\d+)\w*$/, f: function (m3, n) {
			return [n, 1];
		}
	},
	"absolute,X": {
		d: "absolute,X", r: /^\s*\$(\-?\d+),X\w*$/, f: function (m3, n) {
			return [m3.X + n, 1];
		}
	},
	"absolute,Y": {
		d: "absolute,Y", r: /^\s*\$(\-?\d+),Y\w*$/, f: function (m3, n) {
			return [m3.Y + n, 1];
		}
	},
	"indirect,X": {
		d: "indirect,X", r: /^\s*\(\$(\d+),X\)\w*$/, f: function (m3, n) {
			return [m3.memory[m3.X + n], 1];
		}
	},
	"indirect,Y": {
		d: "indirect,Y", r: /^\s*\(\$(\d+)\),Y\w*$/, f: function (m3, n) {
			return [m3.memory[m3.Y] + n, 1];
		}
	},
	"indirect": {
		d: "indirect", r: /^\s*\(\$(\d+)\)\w*$/, f: function (m3, n) {
			return [m3.memory[n], 1];
		}
	},
	"accumulator": {
		d: "accumulator", r: /^\s*A\w*$/, f: function () {
			return ["A", 1];	// can't return of the address of that which has no address.
		}
	},
	"relative": {
		d: "relative", r: /^\s*\$(-?\d+)\w*$/, f: function (m3, n) {
			return [n, 1];
		}
	},
	"implied": {
		d: "implied", r: undefined, f: function () {
			return [true, 0];
		}
	}
};

M3.prototype.addrModesGroup1 = [
	M3.prototype.addrModes["immediate"],
	M3.prototype.addrModes["absolute"],
	M3.prototype.addrModes["absolute,X"],
	M3.prototype.addrModes["absolute,Y"],
	M3.prototype.addrModes["indirect,X"],
	M3.prototype.addrModes["indirect,Y"]
];
M3.prototype.addrModesGroup2 = [
	M3.prototype.addrModes["accumulator"],
	M3.prototype.addrModes["absolute"],
	M3.prototype.addrModes["absolute,X"]
];
M3.prototype.addrModesGroup3 = [
	M3.prototype.addrModes["absolute"],
	M3.prototype.addrModes["absolute,X"],
	M3.prototype.addrModes["absolute,Y"],
	M3.prototype.addrModes["indirect,X"],
	M3.prototype.addrModes["indirect,Y"]
];
M3.prototype.addrModesGroup4 = [
	M3.prototype.addrModes["relative"]
];
M3.prototype.addrModesGroup5 = [
	M3.prototype.addrModes["absolute"]
];
M3.prototype.addrModesGroup6 = [
	M3.prototype.addrModes["immediate"],
	M3.prototype.addrModes["absolute"]
];
M3.prototype.addrModesGroup7 = [
	M3.prototype.addrModes["implied"]
];
M3.prototype.addrModesGroup8 = [
	M3.prototype.addrModes["indirect"],
	M3.prototype.addrModes["absolute"]
];
M3.prototype.addrModesGroup9 = [
	M3.prototype.addrModes["immediate"],
	M3.prototype.addrModes["absolute"],
	M3.prototype.addrModes["absolute,Y"]
];
M3.prototype.addrModesGroup10 = [
	M3.prototype.addrModes["immediate"],
	M3.prototype.addrModes["absolute"],
	M3.prototype.addrModes["absolute,X"]
];

M3.prototype.setFlags = function (n) {
	this.FZ = n === 0;
	this.FN = n < 0;
};

M3.prototype.conditionalJump = function (test, n) {
	var offset = M3.trunc(n);
	if (test) {
		this.PC += offset;
		this.PCChanged = true;
	}
	return test;
};

M3.trunc = function (n) {
	return n >= 0 ? Math.floor(n) : Math.ceil(n);
};

M3.prototype.instructionSet = {
	adc: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A += n;
			m3.setFlags(m3.A);
		}
	},
	and: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A = M3.trunc(m3.A) & M3.trunc(n);
			m3.setFlags(m3.A);
		}
	},
	asl: {
		am: M3.prototype.addrModesGroup2,
		f: function (m3, n) {
			if (n === "A") {
				m3.A = M3.trunc(m3.A) * 2;
				m3.setFlags(m3.A);
			}
			else {
				var t = M3.trunc(n);
				m3.memory[t] *= 2;
				m3.setFlags(m3.memory[t]);
			}
		}
	},
	beq: {
		am: M3.prototype.addrModesGroup4,
		f: function (m3, n) {
			m3.conditionalJump(m3.FZ, n);
		}
	},
	bit: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			n = M3.trunc(n);
			// This is a little weird since this simulation doesn't really use signed ints.
			m3.FN = (m3.A < 0 && n < 0);
			m3.FZ = (m3.A === 0 && n === 0);
		}
	},
	bmi: {
		am: M3.prototype.addrModesGroup4,
		f: function (m3, n) {
			m3.conditionalJump(m3.FN, n);
		}
	},
	bne: {
		am: M3.prototype.addrModesGroup4,
		f: function (m3, n) {
			m3.conditionalJump(!m3.FZ, n);
		}
	},
	bpl: {
		am: M3.prototype.addrModesGroup4,
		f: function (m3, n) {
			m3.conditionalJump(!m3.FN, n);
		}
	},
	cmp: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			if (m3.A !== Math.floor(m3.A)) {m3.FF = true; return;} //throw new Error("m3.A is not an int: "+m3.A);
			if (n !== Math.floor(n)) {m3.FF = true; return; }//throw new Error("n is not an int: "+n);
			m3.FZ = (m3.A === n);
			m3.FN = (n > m3.A);
		}
	},
	cpx: {
		am: M3.prototype.addrModesGroup6,
		f: function (m3, n) {
			m3.FZ = (m3.X === n);
			m3.FN = (n > m3.X);
		}
	},
	cpy: {
		am: M3.prototype.addrModesGroup6,
		f: function (m3, n) {
			m3.FZ = (m3.Y === n);
			m3.FN = (n > m3.Y);
		}
	},
	dec: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			n = M3.trunc(n);
			m3.memory[n] -= 1;
			m3.setFlags(m3.memory[n]);
		}
	},
	dex: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.X -= 1;
			m3.setFlags(m3.X);
		}
	},
	dey: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.Y -= 1;
			m3.setFlags(m3.Y);
		}
	},
	div: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			if (n === 0) {
				m3.FF = true;
			}
			else {
				m3.A /= n;
				m3.setFlags(m3.A);
			}
		}
	},
	eor: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A = M3.trunc(m3.A) ^ M3.trunc(n);
			m3.setFlags(m3.A);
		}
	},
	hlt: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.FH = true;
		}
	},
	inc: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			n = M3.trunc(n);
			m3.memory[n] += 1;
			m3.setFlags(m3.memory[n]);
		}
	},
	inx: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.X += 1;
			m3.setFlags(m3.X);
		}
	},
	iny: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.Y += 1;
			m3.setFlags(m3.Y);
		}
	},
	jmp: {
		am: M3.prototype.addrModesGroup8,
		f: function (m3, n) {
			m3.PC = M3.trunc(n);
			m3.PCChanged = true;
		}
	},
	jsp: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			m3.SP--;
			m3.memory[m3.SP] = m3.PC + 2;	// Skip over the operand
			m3.PC = M3.trunc(n);
			m3.PCChanged = true;
		}
	},
	lda: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A = n;
			m3.setFlags(m3.A);
		}
	},
	ldx: {
		am: M3.prototype.addrModesGroup9,
		f: function (m3, n) {
			m3.X = n;
			m3.setFlags(m3.X);
		}
	},
	ldy: {
		am: M3.prototype.addrModesGroup10,
		f: function (m3, n) {
			m3.Y = n;
			m3.setFlags(m3.Y);
		}
	},
	lsr: {
		am: M3.prototype.addrModesGroup2,
		f: function (m3, n) {
			var i = M3.trunc(n);
			m3.memory[i] = M3.trunc(m3.memory[i]) / 2;
			m3.setFlags(m3.memory[i]);
		}
	},
	mul: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A *= n;
			m3.setFlags(m3.A);
		}
	},
	nop: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
		}
	},
	ora: {
		am: M3.prototype.addrModesGroup1,
		f: function (m3, n) {
			m3.A = M3.trunc(m3.A) | M3.trunc(n);
			m3.setFlags(m3.A);
		}
	},
	pha: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3, n) {
			m3.SP--;
			m3.memory[m3.SP] = m3.A;
		}
	},
	pla: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3, n) {
			m3.A = m3.memory[m3.SP];
			m3.SP++;
			m3.setFlags(m3.A);
		}
	},
	//rol: {am: M3.prototype.addrModesGroup2},
	//ror: {am: M3.prototype.addrModesGroup2},
	rts: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.PC = m3.memory[m3.SP];
			m3.SP++;
			m3.PCChanged = true;
		}
	},
	sbc: {
		am: M3.prototype.addrModesGroup1, f: function (m3, n) {
			m3.A -= n;
			m3.setFlags(m3.A);
		}
	},
	sta: {
		am: M3.prototype.addrModesGroup3,
		f: function (m3, n) {
			m3.memory[M3.trunc(n)] = m3.A;
		}
	},
	stx: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			m3.memory[M3.trunc(n)] = m3.X;
		}
	},
	sty: {
		am: M3.prototype.addrModesGroup5,
		f: function (m3, n) {
			m3.memory[M3.trunc(n)] = m3.Y;
		}
	},
	tax: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.X = m3.A;
			m3.setFlags(m3.X);
		}
	},
	tay: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.Y = m3.A;
			m3.setFlags(m3.Y);
		}
	},
	tsx: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.X = m3.SP;
			m3.setFlags(m3.X);
		}
	},
	txa: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.A = m3.X;
			m3.setFlags(m3.A);
		}
	},
	txs: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.SP = m3.X;
		}
	},
	tya: {
		am: M3.prototype.addrModesGroup7,
		f: function (m3) {
			m3.A = m3.Y;
			m3.setFlags(m3.A);
		}
	}
};




