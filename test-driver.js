
//Exports test driver code used by various transfer methods.
//
// test(method, offsets, firsts, orders, limit, options = {})
//  calls method(offsets, firsts, orders, limit, xfer)
//  checks all calls to xfer to make sure racking/slack are obeyed (throws if not)
//  checks that all stitches get to their destinations
//    will throw if not,
//    will also throw if first-marked stitch did not reach destination (unless options.ignoreFirsts)
//    will also throw if stacked stitches are transferred (unless options.ignoreFirsts)
//    will also throw if empty needles are transferred (unless options.ignoreEmpty)
//  returns an object:
//   ret = {
//      log:["xfer f0 b0", ...], //list of xfer operations
//      invalidFirsts:0, //number of invalid first stitches, 0 unless options.ignoreFirsts is set
//      xferredStacks:0, //number of stacked stitches transferred, 0 unless options.ignoreStacks is set
//      xferredEmpty:0, //number of empty needles transferred, 0 unless options.ignoreEmpty is set
//   }
//
// runTests(method, options = {})
//  reads tests specified on the command line
//  if options.outDir is set, creates options.outDir if needed, then:
//     writes test logs into options.outDir + '/' + test_case_name for successful tests
//  if options.skipCables is set, does not attempt test cases with cables
//  if options.skipLace is set, does not attempt test cases with lace (== stacking loops)
//  if options.skipLong is set, does not attempt test cases with offsets outside of maxTransfer
//  options.ignoreFirsts, options.ignoreStacks are passed to test
//
//  returns an object:
//   ret = {
//      ran:52,
//      passed:50,
//      failed:2,
//      skipped:105
//   }

function test(method, offsets, firsts, orders, limit, options) {
	//validate parameters:

	//this lets you pass strings to test for offsets/firsts/orders, which is handy for by-hand-written test cases:
	if (typeof(offsets) === "string") {
		let parsed = [];
		offsets.split(/\s+/).forEach(function(t){
			if (t === '') return;
			parsed.push(parseInt(t));
		});
		offsets = parsed;
	}
	if (typeof(firsts) === "string") {
		let parsed = [];
		firsts.split(/\s+/).forEach(function(t){
			if (t === '') return;
			else if (t === '*') parsed.push(true);
			else if (t === '.') parsed.push(false);
			else console.error("Unexpected 'firsts' character '" + t + "'");
		});
		firsts = parsed;
	}
	if (typeof(orders) === "string") {
		let parsed = [];
		orders.split(/\s+/).forEach(function(t){
			if (t === '') return;
			else if (t === '+') parsed.push(1);
			else if (t === '.') parsed.push(0);
			else if (t === '-') parsed.push(-1);
			else console.error("Unexpected 'orders' character '" + t + "'");
		});
		orders = parsed;
	}

	//basic parameter validation:

	console.assert(typeof(method) === 'function', "method parameter should be a function");
	console.assert(Array.isArray(offsets), "offsets parameter should be an array");
	console.assert(Array.isArray(firsts), "firsts parameter should be an array");
	console.assert(Array.isArray(orders), "orders parameter should be an array");
	console.assert(Number.isInteger(limit) && limit > 0, "limit should be a positive integer");

	if (typeof(options) === 'undefined') options = {};
	console.assert(typeof(options) === 'object', "options parameter should be an object");

	console.assert(offsets.length === firsts.length, "offsets and firsts should be the same length");
	console.assert(offsets.length === orders.length, "offsets and orders should be the same length");

	const ignoreFirsts = Boolean(options.ignoreFirsts);
	const ignoreStacks = Boolean(options.ignoreStacks);
	const ignoreEmpty = Boolean(options.ignoreEmpty);

	//----------------------------------

	function offsetsToString(offsets) {
		let info = "";
		for (let i = 0; i < offsets.length; ++i) {
			if (i !== 0) info += " ";
			if (offsets[i] < 0) info += offsets[i];
			else if (offsets[i] > 0) info += "+" + offsets[i];
			else info += " 0";
		}
		return info;
	}


	//will track positions of each loop by using this needles object:
	let needles = {};
	for (let i = 0; i < offsets.length; ++i) {
		needles['f' + i] = [i];
	}

	function dumpNeedles() {
		let minNeedle = 0;
		let maxNeedle = offsets.length-1;
		for (let n in needles) {
			let m = n.match(/^[fb]s?(-?\d+)$/);
			console.assert(m);
			let val = parseInt(m[1]);
			minNeedle = Math.min(minNeedle, val);
			maxNeedle = Math.max(maxNeedle, val);
		}

		[
			['b',  '   back:'],
			['bs', ' backSl:'],
			['fs', 'frontSl:'],
			['f',  '  front:'],
		].forEach(function(bedName) {
			const bed = bedName[0];
			const name = bedName[1];
			let layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if ((bed + n) in needles) {
					needles[bed + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < (n - minNeedle) * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log(name + layers[l]);
			}
		});

		let infoI = "";
		for (let n = minNeedle; n <= maxNeedle; ++n) {
			if      (n < -10) infoI += n.toString();
			else if (n <   0) infoI += " " + n.toString();
			else if (n === 0) infoI += "  0";
			else if (n <  10) infoI += "  " + n.toString();
			else              infoI += " " + n.toString();
		}
		console.log("  index:" + infoI);
	}

	let log = [];

	let xferredStacks = 0;
	let xferredEmpty = 0;

	function xfer(fromBed, fromIndex, toBed, toIndex) {
		let cmd = "xfer " + fromBed + fromIndex + " " + toBed + toIndex;
		//console.log(cmd);
		log.push(cmd);

		console.assert(
			["f>b","f>bs","fs>b","b>f","b>fs","bs>f"].indexOf(fromBed + '>' + toBed) !== -1,
			"must xfer f[s] <=> b[s]");

		//check for valid racking:
		let at = [];
		for (let i = 0; i < offsets.length; ++i) {
			at.push(null);
		}
		for (var n in needles) {
			let m = n.match(/^([fb]s?)(-?\d+)$/);
			console.assert(m);
			needles[n].forEach(function(s){
				console.assert(at[s] === null, "each stitch can only be in one place");
				at[s] = {bed:m[1], needle:parseInt(m[2])};
			});
		}

		let minRacking = -Infinity;
		let maxRacking = Infinity;
		for (let i = 1; i < offsets.length; ++i) {
			if (at[i-1].bed[0] === at[i].bed[0]) continue;
			let slack = Math.max(1, Math.abs( i+offsets[i] - (i-1+offsets[i-1]) ));
			let back  = (at[i].bed[0] === 'b' ? at[i].needle : at[i-1].needle);
			let front = (at[i].bed[0] === 'b' ? at[i-1].needle : at[i].needle);

			//-slack <= back + racking - front <= slack
			minRacking = Math.max(minRacking, -slack - back + front);
			maxRacking = Math.min(maxRacking,  slack - back + front);
		}
		console.assert(minRacking <= maxRacking, "there is a valid racking for this stitch configuration");
		let racking = (fromBed[0] === 'f' ? fromIndex - toIndex : toIndex - fromIndex);
		console.assert(minRacking <= racking && racking <= maxRacking, "required racking " + racking + " is outside [" + minRacking + ", " + maxRacking + "] valid range. (" + cmd + ")");



		var from = needles[fromBed + fromIndex];
		if (!((toBed + toIndex) in needles)) needles[toBed + toIndex] = [];
		var to = needles[toBed + toIndex];

		if (from.length === 0) {
			++xferredEmpty;
			if (!ignoreEmpty) {
				console.assert(from.length !== 0, "no reason to xfer empty needle");
			}
		}
		if (from.length > 1) {
			++xferredStacks;
			if (!ignoreStacks) {
				console.assert(from.length === 1, "shouldn't ever xfer stack");
			}
		}

		while (from.length) to.push(from.pop());

		//dumpNeedles(); //DEBUG
	}

	let infoI = "";
	let infoO = "";
	let infoF = "";
	for (let i = 0; i < offsets.length; ++i) {
		infoI += " ";
		infoO += " ";
		infoF += " ";

		if (i < 10) infoI += " " + i;
		else infoI += i;

		if (offsets[i] < 0) infoO += offsets[i];
		else if (offsets[i] > 0) infoO += "+" + offsets[i];
		else infoO += " 0";

		if (firsts[i]) {
			infoF += " *";
		} else {
			infoF += " .";
		}
	}
	console.log(" index:" + infoI);
	console.log("offset:" + infoO);
	console.log(" first:" + infoF);

	method(offsets, firsts, orders, limit, xfer);

	dumpNeedles();

	let invalidFirsts = 0;

	for (let i = 0; i < offsets.length; ++i) {
		var n = needles['f' + (i + offsets[i])];
		if (n.indexOf(i) === -1) throw "loop on " + ('f' + i) + " did not reach " + ('f' + (i + offsets[i]));
		//console.assert(n.indexOf(i) !== -1, "needle got to destination");
		if (firsts[i]) {
			if (n.indexOf(i) !== 0) {
				invalidFirsts += 1;
				if (!ignoreFirsts) {
					throw "loop on " + ('f' + i) + " did not reach " + ('f' + (i + offsets[i])) + " first";
				}
			}
		}
	}

	console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

	return {
		invalidFirsts:invalidFirsts,
		xferredStacks:xferredStacks,
		xferredEmpty:xferredEmpty,
		log:log,
	};
}

function runTests(method, options) {
	//check parameters:
	console.assert(typeof(method) === 'function', "method parameter should be a function");
	if (typeof(options) === 'undefined') options = {};
	console.assert(typeof(options) === 'object', "options parameter should be an object or empty");

	const path = require('path');
	const fs = require('fs');

	if ('outDir' in options) {
		console.assert(typeof(options.outDir) === 'string', "options.outDir should be a string");
		let dirs = options.outDir.split(path.sep);
		for (let i = 1; i <= dirs.length; ++i) {
			let sub = path.join(dirs.slice(0,i));
			fs.mkdirSync(sub); //will this error if subdir exists?
		}
	}

	const skipCables = ('skipCables' in options ? Boolean(options.skipCables) : false);
	const skipLace = ('skipLace' in options ? Boolean(options.skipLace) : false);
	const skipLong = ('skipLong' in options ? Boolean(options.skipLong) : false);

	console.log("skipCables: " + skipCables); //DEBUG

	const testOptions = {};
	if (options.ignoreFirsts) testOptions.ignoreFirsts = true;
	if (options.ignoreStacks) testOptions.ignoreStacks = true;
	if (options.ignoreEmpty) testOptions.ignoreEmpty = true;

	//------- actual testing code ------

	let stats = {
		total:0, //total test cases examined
		ran:0, //test cases that were run
		passed:0, //test cases that were run and passed
		failed:0, //test cases that were run and failed
		skipped:0, //test cases that were skipped
		invalid:0 //test cases that were skipped because the file was malformed
	};

	for (let i = 2; i < process.argv.length; ++i) {
		let name = process.argv[i];
		if (name.endsWith(path.sep)) name = name.substr(0,name.length-1);
		const lstats = fs.lstatSync(name);
		let files;
		if (lstats.isDirectory()) {
			files = [];
			fs.readdirSync(name).forEach(function(filename){
				files.push(name + "/" + filename);
			});
		} else {
			files = [name];
		}
		files.forEach(function(filename){
			stats.total += 1;

			console.log(filename + " ...");
			let data = null;
			try {
				data = JSON.parse(fs.readFileSync(filename));
				if (!(Number.isInteger(data.transferMax) && data.transferMax >= 1)) throw "Invalid transferMax";
				if (!Array.isArray(data.offsets)) throw "Invalid offsets";
				if (!Array.isArray(data.firsts) || data.offsets.length !== data.firsts.length) throw "Invalid firsts";
				if (!Array.isArray(data.orders) || data.offsets.length !== data.orders.length) throw "Invalid order";
				for (let i = 0; i < data.offsets.length; ++i) {
					if (!Number.isInteger(data.offsets[i])) throw "Invalid offset: " + data.offsets[i];
					if (!Number.isInteger(data.orders[i])) throw "Invalid order: " + data.orders[i];
					data.firsts[i] = Boolean(data.firsts[i]); //normalize firsts
				}
			} catch (e) {
				console.log(e);
				stats.skipped += 1;
				stats.invalid += 1;
				return;
			}
			//Check inputs:
			let maxRacking = data.transferMax;

			let hasLong = false; //stitches with |offset| > maxRacking
			let hasCables = false; //stitches that cross other stitches
			let hasLace = false; //stitches that stack on other stitches

			let targets = {}; //for hasLace checking

			for (let i = 0; i < data.offsets.length; ++i) {
				if (Math.abs(data.offsets[i]) > maxRacking) {
					hasLong = true;
				}
				if (i > 0 && (i-1 + data.offsets[i-1] > i + data.offsets[i])) {
					hasCables = true;
				}

				let t = (i + data.offsets[i]).toString();
				if (!(t in targets)) targets[t] = [];
				targets[t].push(i);
				if (targets[t].length > 1) hasLace = true;
			}

			if (hasLace && skipLace) {
				stats.skipped += 1;
				return;
			}
			if (hasCables && skipCables) {
				stats.skipped += 1;
				return;
			}
			if (hasLong && skipLong) {
				stats.skipped += 1;
				return;
			}

			//-------------- actually do the test ------------

			stats.ran += 1;

			let test_log;
			try {
				test_log = test(method, data.offsets, data.firsts, data.orders, data.transferMax, testOptions);
			} catch (e) {
				console.log(e);
				stats.failed += 1;
				if (options.rethrow) throw e;
				return;
			}

			stats.passed += 1;

			if (options.outDir) {
				//generate transfers file
				let transfer_name = path.basename(filename, '.xfers');
				let results_file = path.join(options.outDir, transfer_name + '.xout');

				//NOTE: explicitly building an object to avoid leaking any extra fields through from data
				let result_string = ";" + JSON.stringify({
					offsets:data.offsets,
					firsts:data.firsts,
					orders:data.orders,
					transferMax:data.transferMax
				}) + '\n' + test_log.join('\n') + '\n';

				fs.writeFileSync(results_file, result_string);
			}
		});
	}

	console.log("Of " + stats.total + " test cases:\n"
		+ "  Skipped " + stats.skipped + " tests, " + stats.invalid + " because of invalid file contents.\n"
		+ "  Ran " + stats.ran + " tests, of which\n"
		+ "     " + stats.passed + " passed and\n"
		+ "     " + stats.failed + " failed.");

	return stats;
}


module.exports.test = test;
module.exports.runTests = runTests;
