"use strict;"


/**
 * Machine architecture
 *
 * hyperaccurate (tm) words. Strikingly similar to what javascript can store in a variable.
 *
 * ---------------------------------
 *
 * Addressing modes:
 * 00 -A-    OP #100 - Direct - The word is used as a constant. ex: 10: the value 10.
 * 01 -B-    OP [100] - Indirect - the word is used as a memory address: ex [10] the contents of memory location 10.
 * 10 -C-    OP SP+#1 - Indirect Indexed - two words summed, with the first being direct, and the 2nd being direct. ex: [1000+[10]] the contents of (1000+the contents of memory location 10)
 * 11 -D-    OP [SP+#1]
 * 11 -D-    Base Indexed - like Indirect Indexed, but using the BA register instead of having the base as the argument.
 *
 * xx register 00=AC, 01=IP, 10 = BA, 11=SP
 * w register 00=AC, 10=BA
 * zz addressing modes 00=A, 01=B, 11=C
 *
 * 000 ld  xx    zz
 * 001 mov    xx    zz
 * 010 add    xx    zz
 * 011 sub    xx    zz
 * 100 mult    00    zz
 * 101 div    00    zz
 * 110 cmp  w0    zz
 * 111 sco    01    zz
 *
 * Comparison flags (eq/ne, gt, lt)
 * 0 0 0    not equal
 * 0 0 1    less than
 * 0 1 0    greater than
 * 0 1 1    nonsense - can't be not equal and less than and greater than
 * 1 0 0    exactly equal
 * 1 0 1    less than or equal
 * 1 1 0    greater than or equal
 * 1 1 1    exactly equal
 *
 * extended instructions
 *
 * 111 jmp 10 zz    unconditional jump (takes advantage of the limitation to the IP register to squeeze out another behavior.)
 *
 *
 * Examples
 * add SP, 1
 * add SP, [1000]+1  010:11:10, 1000, 1  (get the contents of memory location 1000. add 1 to it. set the stack pointer to this value.)
 * 1. Allocate a scalars on the stack
 * SP = 1000
 * add SP, 1  ; add stack pointer direct
 * set SP+0, 100    ; register indexed direct
 * add SP+0            ; register indexed direct. The accumulator is increased by 100.
 *
 * Memory:
 * 1000: -12        ; from an array initialization
 * 1001: 1            ; "
 * 1002: -1            ; "
 * 1003: 12            ; "
 * 1004: 2000        ; current location
 * 1005: 0            ; index variable
 *
 * ld BA, 1000  ; 000:10:00 1000; set the base register to 1000.
 * set AC, [1004]    ; 000:00:01; set the accumulator to 2000.
 * add AC, BA+[1005] ; 010:00:11; add to ac base indexed. [1005] = 0. Add 0 and BA to give 1000. add [1000] (that is, -12) to ACC
 * ; AC is now 2000-12 = 1888.
 * get AC, 1    ; 001:00:00 set the contents of location 1888 to 1 (but what if I wanted the actual value of 1888?!)
 * get 1, [AC]    ; same instruction, different shape. This allows the addressing mode nomenclature to be used. 'get' thus becomes left-to-right
 * get 1, AC    ; error. Or perhaps a SET statement. the reading is 'set 1888 (the value of the accumulator) to 1. 1888 can't be 1.
 * get [AC], 1    ; He's the alternate symanticaly valid right-to-left version
 * Oh my I have no way to move a value to an absolute memory location. ex: move [1000], 0
 *
 * set AC, SP, IP from memory
 * get AC, SP, IP(?) to memory
 *
 * LD (r) #m direct
 *        [#m] indirect
 *        [#m + X] indirect indexed direct     A typical use for this would be when #m is the address of an array and X is the index.
 *        #m + X indexed direct       Prepare an address for use later?
 *        [#m] + X
 *        [SP+#d] indirect indexed stack
 *        SP+#d indexed stack
 *
 * LD X, 1000	// direct.  X is now 1000
 * LD A, [1004]	// indirect. A is now 2000
 * ADD A, [X]	// indirect. X is 1000, so [X] is -12.  A is now 1888.
 *
 * LD X, SP+4	; here we have already added stack space.  SP+4 is the location of the table. X is now 1000
 * LD A, [SP+0]	; This is where the current location is stored.  A is now, say, 2000.
 * ADD A, [X]	; A is 1888.
 * MOV A, SP+5	; SP+5 is now 1888
 * LD A, [SP+5]	; A is now ... something
 * CMP A, #0	; Compare A to 0
 * SCO NE #100
 * LD A, [SP+6]	; move number
 * INC A		; bump it
 * MOV A, SP+6	; save it back
 * MOV A, SP+5	; update the board with the number number
 *
 * 100:
 *
 */

var M2 = module.exports = function M2() {
};

M2.SP = 0;
M2.IP = 1;
M2.BA = 2;
M2.AC = 3;

M2.prototype.load = function (program, memorySize) {
	this.memory = [];
	this.memorySize = memorySize || 100;
	for (var i = 0; i < program, length; i++) {
		this.memory.push(program[i]);
	}
	for (i = program.length; i < program.length + this.memorySize; i++) {
		this.memory.push(Math.random());
	}
	this.r = [];
	this.r.push(program.length + this.memory.size - 1);	//SP
	this.r.push(0);	// IP
	this.r.push(Math.random());	// BA
	this.r.push(Math.random()); // AC
	this.flags = {
		eq: false,
		gt: false,
		lt: false
	};
};

M2.prototype.run = function () {

	while (!this.fault && !this.halt) {
		var inst = this.memory[this.r[M2.IP]];

		var bits = this.getRegBits();
		if (inst.reg.indexOf(bits) === -1) {
			this.fault = true;
			continue;
		}

		var addrModeBits = this.getAddrMode();
		if (inst.modes.indexOf(addrModeBits) === -1) {
			this.fault = true;
			continue;
		}

		var regIndex = M2.getRegMapping(bits);
		var modeEntry = M2.getAddrModeMapping(addrModeBits);
		this.ipChanged = false;

		var ip = this.r[M2.IP];

		inst.f(inst, regIndex, modeEntry.decoder());

		// If the instruction changes the IP, all bets are off. If it does not, advance to the
		// next instruction.
		if (ip === this.r[M2.IP]) {
			this.r[M2.IP] += modeEntry.ipBump;	// ipBump includes one for the addressing.
		}
		// This is the cost of the addressing plus the cost of the opcode.  Instructions may
		// impose additional costs.
		this.cycles += modeEntry.cycles + 1;
	}
};

M2.instructions = [
	{
		mnemonic: 'ld',
		opcode: '000',
		reg: ['00', '01', '10', '11'],
		modes: ['00', '01', '10', '11'],
		f: M2.prototype.set
	},
	{mnemonic: 'mov', opcode: '001', reg: ['00', '01', '10', '11'], modes: ['01', '10', '11'], f: M2.prototype.get},
	{
		mnemonic: 'add',
		opcode: '010',
		reg: ['00', '01', '10', '11'],
		modes: ['00', '01', '10', '11'],
		f: M2.prototype.add
	},
	{
		mnemonic: 'sub',
		opcode: '011',
		reg: ['00', '01', '10', '11'],
		modes: ['00', '01', '10', '11'],
		f: M2.prototype.sub
	},

	{mnemonic: 'mul', opcode: '100', reg: ['00'], modes: ['00', '01', '10', '11'], f: M2.mul},
	{mnemonic: 'div', opcode: '101', reg: ['00'], modes: ['00', '01', '10', '11'], f: M2.div},
	{mnemonic: 'cmp', opcode: '110', reg: ['00', '10'], modes: ['00', '01', '10', '11'], f: M2.cmp},
	{mnemonic: 'sco', opcode: '111', reg: ['01'], modes: ['00', '01', '10', '11'], f: M2.sco},

	{mnemonic: 'jmp', opcode: '111', reg: ['10'], modes: ['00', '01', '10', '11'], f: M2.jmp}
];

M2.IndexingModes = [
	{'zz': ['d', 'i', 'ii', 'bi']}
];
M2.RegisterModes = [
	{xx: ['sp', 'ip', 'ac', 'ba']},
	{'00': ['ac']},
	{'w0': ['ac', 'ba']},
	{'01': ['ip']},
	{'10': ['--']}	// special code that basically means the register mode bits have been appropriated for something else.
];

/**
 * 00 = AC
 * 01 = IP
 * 10 = BA
 * 11 = SP
 * @param bits
 * @returns {*}
 */
M2.getRegMapping = function (bits) {
	var regs = {'00': 0, '01': 1, '10': 2, '11': 3};
	return regs[bits];
};

M2.prototype.getAddrModeMapping = function (bits) {
	var map = {
		'00': {
			index: 0, cycles: 1, ipBump: 2, decoder: function () {
				return this.memory[this.r[M2.IP] + 1];
			}
		},
		'01': {
			index: 1, cycles: 1, ipBump: 2, decoder: function () {
				return this.memory[this.memory[this.r[M2.IP] + 1]];
			}
		},
		'10': {
			index: 2, cycles: 4, ipBump: 3, decoder: function () {
				return this.memory[this.memory[this.r[M2.IP] + 1]] + this.memory[this.r[M2.IP] + 2];
			}
		},
		'11': {
			index: 3, cycles: 3, ipBump: 3, decoder: function () {
				return this.memory[this.memory[this.r[M2.IP] + 1]] + this.r[M2.BA];
			}
		}
	};
	return map[bits];
};

M2.prototype.getRegBits = function () {
	return this.memory[this.r[M2.IP]].slice(3, 5);
};

M2.prototype.getAddrModeBits = function () {
	return this.memory[this.r[M2.IP]].slice(5, 7);
};

M2.prototype.set = function (inst, regIndex, objAddr) {
	this.r[regIndex] = objAddr;
};
M2.prototype.get = function (inst, regIndex, objAddr) {
	this.memory[objAddr] = this.r[regIndex];
};
M2.prototype.add = function (inst, regIndex, objAddr) {
	this.r[regIndex] += objAddr;
	this.cycles += 1;
};
M2.prototype.sub = function (inst, regIndex, objAddr) {
	this.r[regIndex] -= objAddr;
	this.cycles += 1;
};
M2.prototype.mul = function (inst, regIndex, objAddr) {
	this.r[regIndex] *= objAddr;
	this.cycles += 4;
};
M2.prototype.div = function (inst, regIndex, objAddr) {
	this.r[regIndex] /= objAddr;
	this.cycles += 4;
};
M2.prototype.cmp = function (inst, regIndex, objAddr) {
	this.flags.eq = this.r[regIndex] === objAddr;	// bit 0
	this.flags.gr = this.r[regIndex] > objAddr;		// bit 1
	this.flags.lt = this.r[regIndex] < objAddr;		// bit 2
};
/**
 *  Comparison flags (eq/ne, gt, lt)
 * 0 0 0    not equal
 * 0 0 1    less than
 * 0 1 0    greater than
 * 0 1 1    nonsense - can't be not equal and less than and greater than
 * 1 0 0    exactly equal
 * 1 0 1    less than or equal
 * 1 1 0    greater than or equal
 * 1 1 1    exactly equal
 * @param inst
 * @param regIndex
 * @param objAddr
 */
M2.prototype.sco = function (inst, regIndex, objAddr) {
	var cond = "" + objAddr;
	if (((objAddr & 4) ^ (this.flags.lt)) ||
		((objAddr & 2) ^ (this.flags.gt)) ||
		((objAddr & 1) ^ (this.flags.eq))) {
		this.r[regIndex] = objAddr;
	}

};


