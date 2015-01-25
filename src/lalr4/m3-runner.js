"use strict";

var argv = require('minimist')(process.argv.slice(2)),
	M3 = require("./m3"),
	fs = require("fs");

var m3 = new M3();

var infile = argv.i;
if (!infile) throw new Error("Input file is not specified. use -i");

var outfile = argv.o;
if (!outfile) throw new Error("Output file is not specified. use -o");

var infileData = fs.readFileSync(infile, {encoding: 'utf8'});
try {
	fs.unlinkSync(outfile);
} catch (err) {
	console.log(err);
}

var p = infileData.split(/\n/);

m3.run(p, {max_cycles:0, final_dump: true, cycle_dump:false, data_amount:12, dumpSource:0, memory_size:500});

fs.writeFileSync(outfile, m3.dump(), {encoding: 'utf8'});
//console.log(m3.dump());
