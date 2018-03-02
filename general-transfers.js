#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//general_transfers computes transfers for single-bed knitting
//  with cables when stacking order of decreases matters and
//  a racking limit is relevant.
// *NOTE* that general_transfers is somewhat limited in its cable support.
//    - it does not support *cables* with | offset | > limit
//    - it only supports cables that have a (+N)* 0* (-M)* format
//Parameters:
// offsets: array of offsets for each stitch index
// firsts: array of the same length as offsets;
//     if Boolean(offsets[i]) is true, stitch[i] will
//     arrive at its destination needle first.
// orders: for cables, order values of inner stitches determine which passes in front (greater order passes in front)
// limit: maximum racking value
//
// xfer: output function
//
// general_transfers returns a transfer plan by calling
//   xfer('f'/'b', i, 'f'/'b', i+o) to move stitches around

const split_cables = require('./split-cables.js').split_cables;
const limit_offsets = require('./limit-offsets.js').limit_offsets;
const flat_transfers = require('./flat-transfers.js').flat_transfers;
const lace_transfers = require('./lace-transfers.js').lace_transfers;
const cable_transfers = require('./cable-transfers.js').cable_transfers;

function general_transfers(offsets, firsts, orders, limit, outXfer) {
	//Check inputs:
	if (offsets.length !== firsts.length) {
		throw "Offsets and firsts should be the same length.";
	}
	console.assert(typeof(limit) === 'number', "racking limit should be a number");

	//----- checking code: make sure xfers do the right thing! -----
	let checkNeedles = {};
	for (let i = 0; i < offsets.length; ++i) {
		checkNeedles['f' + i] = [i];
	}
	function xfer(fromBed, fromIndex, toBed, toIndex) {
		console.assert((fromBed + fromIndex) in checkNeedles, "must be xferring from something");
		var from = checkNeedles[fromBed + fromIndex];
		var to;
		if (!((toBed + toIndex) in checkNeedles)) {
			checkNeedles[toBed + toIndex] = [];
		}
		to = checkNeedles[toBed + toIndex];
		while (from.length) {
			to.push(from.pop());
		}
		delete checkNeedles[fromBed + fromIndex];

		outXfer(fromBed, fromIndex, toBed, toIndex);
	}
	//----- -------------------------------------------------- -----
	

	//will maintain/update minNeedle/maxNeedle and mapped* based on current state:
	let minNeedle;
	let maxNeedle;
	let mappedOffsets;
	let mappedFirsts;
	let mappedOrders;
	let mappedXfer; //xfer function that undoes mapping (and handles empty needle tracking)

	function setMapped(fromOffsets, fromFirsts, fromOrders, atOffsets) {
		minNeedle = Infinity;
		maxNeedle =-Infinity;
		mappedOffsets = [];
		mappedFirsts = [];
		mappedOrders = [];

		function setOffset(needle, offset, first, order) {
			if (minNeedle > maxNeedle) {
				minNeedle = maxNeedle = needle;
				console.assert(mappedOffsets.length === 0);
				console.assert(mappedFirsts.length === 0);
				console.assert(mappedOrders.length === 0);
				mappedOffsets.push(null);
				mappedFirsts.push(false);
				mappedOrders.push(0);
			}
			while (needle < minNeedle) {
				--minNeedle;
				mappedOffsets.unshift(null);
				mappedFirsts.unshift(false);
				mappedOrders.unshift(0);
			}
			while (needle > maxNeedle) {
				++maxNeedle;
				mappedOffsets.push(null);
				mappedFirsts.push(false);
				mappedOrders.push(0);
			}
			console.assert(minNeedle <= needle && needle <= maxNeedle);
			if (mappedOffsets[needle-minNeedle] === null) {
				mappedOffsets[needle-minNeedle] = offset;
				mappedFirsts[needle-minNeedle] = first;
				mappedOrders[needle-minNeedle] = order;
			} else {
				console.assert(mappedOffsets[needle-minNeedle] === offset, "stacked stitches should have same destination");
				console.assert(offset === 0, "stacked stitches shouldn't be moved");
				//preserve first marking if any stitch is first:
				if (first) mappedFirsts[needle-minNeedle] = true;
			}
		}

		//map offsets to indices based on current offsets:
		for (let i = 0; i < atOffsets.length; ++i) {
			let at = i + atOffsets[i];
			setOffset(at, fromOffsets[i], fromFirsts[i], fromOrders[i]);
		}

		let ignoreNeedles = {};
		for (let n = minNeedle; n <= maxNeedle; ++n) {
			if (mappedOffsets[n-minNeedle] === null) {
				console.assert(n > minNeedle, "minNeedle should never have undefined offset");
				mappedOffsets[n-minNeedle] = mappedOffsets[n-1-minNeedle];
				ignoreNeedles['f' + n] = true;
			} else {
				ignoreNeedles['f' + n] = false;
			}
		}

		//console.log("mapped: " + offsetsToString(mappedOffsets)); //DEBUG

		//resolve mappedOffsets:

		//mappedXfer drops xfers from empty needles, as tracked by ignoreNeedles map:
		mappedXfer = function (fromBed, fromIndex, toBed, toIndex) {
			let fromNeedle = fromIndex + minNeedle;
			let toNeedle = toIndex + minNeedle;

			console.assert((fromBed + fromNeedle) in ignoreNeedles, "should only xfer from a known needle");
			let ignore = ignoreNeedles[fromBed + fromNeedle];
			delete ignoreNeedles[fromBed + fromNeedle];
			if (ignore === false) {
				//if needle is marked to not ignore, mark destination + pass on xfer:
				ignoreNeedles[toBed + toNeedle] = false;
				xfer(fromBed, fromNeedle, toBed, toNeedle);
			} else { console.assert(ignore === true);
				//if needle is marked ignore, need to at least mark target as legit needle:
				if (!((toBed + toNeedle) in ignoreNeedles)) {
					ignoreNeedles[toBed + toNeedle] = true;
				}
			}
		}

	};


	//split into flat + cables (and hold cables for later).
	let fc = split_cables(offsets);

	//resolve all the flat offsets:
	let remaining = fc.flatOffsets;
	while (true) {
		//console.log("remaining: " + offsetsToString(remaining)); //DEBUG

		let done = true;
		for (let i = 0; i < remaining.length; ++i) {
			if (remaining[i] !== 0) {
				done = false;
				break;
			}
		}
		if (done) break;

		let sl = limit_offsets(remaining, limit);

		let atOffsets = [];
		for (let i = 0; i < offsets.length; ++i) {
			atOffsets.push(fc.flatOffsets[i] - remaining[i]);
		}

		setMapped(sl.shortOffsets, firsts, orders, atOffsets);

		let useLace = mappedOffsets.every(function(o){ return Math.abs(o) <= 1; });

		if (useLace) {
			lace_transfers(mappedOffsets, mappedFirsts,
				function(i) { mappedXfer('f', i, 'b', i); },
				function(i, ofs) { mappedXfer('b', i, 'f', i + ofs); }
				);
		} else {
			flat_transfers(mappedOffsets, mappedFirsts, mappedXfer);
		}


		//longOffsets is all that remains:
		remaining = sl.longOffsets;
	}

	//resolve fc.cableOffsets
	let atOffsets = [];
	for (let i = 0; i < offsets.length; ++i) {
		atOffsets.push(fc.flatOffsets[i]);
	}
	setMapped(fc.cableOffsets, firsts, orders, atOffsets);
	//console.log(mappedOrders); //DEBUG

	cable_transfers(mappedOffsets, mappedOrders, mappedXfer);

	//console.assert(fc.cableOffsets.every(function(o){ return o === 0; }), "TODO: implement cable offsets");


	//----- checking code: make sure xfers did the right thing! -----
	for (let i = 0; i < offsets.length; ++i) {
		let dest = 'f' + (i + offsets[i]);
		console.assert(dest in checkNeedles, "target needle has something");
		console.assert(checkNeedles[dest].indexOf(i) !== -1, "stitch didn't get to target");
		if (firsts[i]) {
			console.assert(checkNeedles[dest].indexOf(i) === 0, "stitch didn't get to target first, though marked first");
		}
	}
	//----- -------------------------------------------------- -----


}

exports.general_transfers = general_transfers;

//-------------------------------------------------
//testing code:

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

if (require.main === module) {
	console.log("Doing some test general transfers.");
	function test(offsets, firsts, orders, limit) {
		let needles = {};
		for (let i = 0; i < offsets.length; ++i) {
			needles['f' + i] = [i];
		}

		function dumpNeedles() {
			let minNeedle = 0;
			let maxNeedle = offsets.length-1;
			for (let n in needles) {
				let m = n.match(/^[fb](-?\d+)$/);
				console.assert(m);
				let val = parseInt(m[1]);
				minNeedle = Math.min(minNeedle, val);
				maxNeedle = Math.max(maxNeedle, val);
			}

			let layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('b' + n) in needles) {
					needles['b' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log(" back:" + layers[l]);
			}
			layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('f' + n) in needles) {
					needles['f' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log("front:" + layers[l]);
			}

			let infoI = "";
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if      (n < -10) infoI += n.toString();
				else if (n <   0) infoI += " " + n.toString();
				else if (n === 0) infoI += "  0";
				else if (n <  10) infoI += "  " + n.toString();
				else              infoI += " " + n.toString();
			}
			console.log("index:" + infoI);
		}
		let log = [];

		function xfer(fromBed, fromIndex, toBed, toIndex) {
			let cmd = "xfer " + fromBed + fromIndex + " " + toBed + toIndex;
			console.log(cmd);
			log.push(cmd);

			console.assert((fromBed === 'f' && toBed === 'b') || (fromBed === 'b' && toBed === 'f'), "must xfer f <=> b");

			//check for valid racking:
			let at = [];
			for (let i = 0; i < offsets.length; ++i) {
				at.push(null);
			}
			for (var n in needles) {
				let m = n.match(/^([fb])(-?\d+)$/);
				console.assert(m);
				needles[n].forEach(function(s){
					console.assert(at[s] === null, "each stitch can only be in one place");
					at[s] = {bed:m[1], needle:parseInt(m[2])};
				});
			}

			let minRacking = -Infinity;
			let maxRacking = Infinity;
			for (let i = 1; i < offsets.length; ++i) {
				if (at[i-1].bed === at[i].bed) continue;
				let slack = Math.max(1, Math.abs( i+offsets[i] - (i-1+offsets[i-1]) ));
				let back  = (at[i].bed === 'b' ? at[i].needle : at[i-1].needle);
				let front = (at[i].bed === 'b' ? at[i-1].needle : at[i].needle);

				//-slack <= back + racking - front <= slack
				minRacking = Math.max(minRacking, -slack - back + front);
				maxRacking = Math.min(maxRacking,  slack - back + front);
			}
			console.assert(minRacking <= maxRacking, "there is a valid racking for this stitch configuration");
			let racking = (fromBed === 'f' ? fromIndex - toIndex : toIndex - fromIndex);
			console.assert(minRacking <= racking && racking <= maxRacking, "required racking " + racking + " is outside [" + minRacking + ", " + maxRacking + "] valid range. (" + cmd + ")");



			var from = needles[fromBed + fromIndex];
			if (!((toBed + toIndex) in needles)) needles[toBed + toIndex] = [];
			var to = needles[toBed + toIndex];

			console.assert(from.length !== 0, "no reason to xfer empty needle");
			console.assert(from.length === 1, "shouldn't ever xfer stack");

			while (from.length) to.push(from.pop());

			dumpNeedles(); //DEBUG
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

		general_transfers(offsets, firsts, orders, limit, xfer);

		dumpNeedles();

		for (let i = 0; i < offsets.length; ++i) {
			var n = needles['f' + (i + offsets[i])];
			console.assert(n.indexOf(i) !== -1, "needle got to destination");
			if (firsts[i]) {
				console.assert(n.indexOf(i) === 0, "first got to destination first");
			}
		}

		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

		return log;
	}


	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 1, 0, 0],
		 [ 0, 0, 0, 0, 0, 0, 0, 0],
		 2);

	test([ 0, 0,+1, 0, 0,+1,-1, 0, 0],
	     [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
		 [ 0, 0, 0, 0, 0, 0, 0, 0, 0],
		 2);

/*
	test([+1,+2,+3,+3,+2,+2,+1,+1],
	     [ 0, 0, 0, 0, 1, 1, 0, 0], 8);

	test([-1,-1,-2,-2,-3,-3,-2,-1],
	     [ 0, 0, 1, 1, 0, 0, 0, 0], 8);

	test([ 0, 0,+1,+1,+2,+2,+1,+1, 0, 0,+1, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], 2);

	test([-4,-3,-2,-1, 0,+1,+2,+3],
	     [ 0, 0, 0, 0, 0, 0, 1, 0], 3);


	test([+4,+4,+3,+3,+2,+2,+1,+1, 0,-1,-1,-2,-2,-3,-3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3);

	test([-4,-4,-3,-3,-2,-2,-1,-1, 0,+1,+1,+2,+2,+3,+3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], 2);

	test([ 0,-1,-1, 0, 1, 1, 1, 0,-1, 1, 0, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0], 8);

 	test([ 1, 0, 1, 0, 1, 0, 0,-1, 0,-1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1],
	     [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 8);
*/
}
