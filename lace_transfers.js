#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//lace_transfers computes transfers for flat knitting when
//  stacking order of decreases matters.
//Parameters:
// offsets: array of [-1,0,1] offsets for each stitch index
// firsts: array of the same length as offsets;
//     if Boolean(offsets[i]) is true, stitch[i] will
//     arrive at its destination needle first.
// xferToBack, xferToFront: output functions
//
// lace_transfers returns a transfer plan by calling
//   xferToBack(i) and xferToFront(i,offsets[i]) for
//   each stitch it wants to move

function lace_transfers(offsets, firsts, xferToBack, xferToFront) {
	//Check inputs:
	if (offsets.length !== firsts.length) {
		throw "Offsets and firsts should be the same length.";
	}
	offsets.forEach(function(ofs){
		if (!(ofs === -1 || ofs === 0 || ofs === 1)) {
			throw "Offsets may only contain -1,0,+1";
		}
	});
	for (let i = 0; i + 1 < offsets.length; ++i) {
		if (offsets[i] === 1 && offsets[i+1] === -1) {
			throw "Offsets should not contain cables (that is, [1,-1] subarrays)";
		}
	}
	if (offsets.length > 0 && offsets[0] === -1) {
		throw "Leftmost offset should be >= 0";
	}
	if (offsets.length > 0 && offsets[offsets.length-1] === 1) {
		throw "Rightmost offset should be <= 0";
	}

	//basic idea:
	// for each block that looks like +1*,0,-1* do:
	// [T+] if the rightmost +1 is marked first:
	//   move +1's, 0 to back bed, return at +1, return at 0
	//   move -1's to back bed, return at -1
	// [T-] if the leftmost -1 is marked first:
	//   move -1's, 0 to back bed, return at -1, return at 0
	//   move +1's to back bed, return at +1
	// [T0] if the 0 is marked first:
	//   move +1's to back bed, return at +1
	//   move the -1's to back bed, return at -1

	// you could do this in four passes per block,
	// but you can also do it in eight *total* passes:
	//   +1/0 to back, return at +1/0  [T+.1, T0.1]
	//   -1/0 to back, return at -1/0  [T+.2, T-.1, T0.2]
	//   +1 to back, return at +1 [T-.2]

	//sort needles by their type (will be used to make passes):
	let minus_first = { minus:[], zero:[], plus:[] };
	let zero_first = { minus:[], zero:[], plus:[] };
	let plus_first = { minus:[], zero:[], plus:[] };

	//split into blocks of +1*,0,-1*:
	let at = 0;
	while (at < offsets.length) {
		let begin_plus = at;
		while (at < offsets.length && offsets[at] === 1) ++at;
		console.assert(at < offsets.length, "should have thrown earlier if rightmost was 1");
		console.assert(offsets[at] === 0, "should have thrown earlier if there was a 1,-1");
		let begin_zero = at;
		++at;
		let begin_minus = at;
		while (at < offsets.length && offsets[at] === -1) ++at;
		let end_minus = at;

		//Now we have a block:
		// ..., +1, +1, +1,      0,            -1, -1,          ...
		//       ^-- begin_plus  ^--begin_zero  ^--begin_minus  ^--end_minus
		for (let i = begin_plus; i < begin_zero; ++i) {
			console.assert(offsets[i] === 1, "block has ones as expected");
		}
		console.assert(offsets[begin_zero] === 0, "block has zero as expected");
		for (let i = begin_minus; i < end_minus; ++i) {
			console.assert(offsets[i] === -1, "block has negative ones as expected");
		}

		const want_plus_first = (begin_plus < begin_zero && Boolean(firsts[begin_zero-1]));
		const want_zero_first = Boolean(firsts[begin_zero]);
		const want_minus_first = (begin_minus < end_minus && Boolean(firsts[begin_minus]));

		let target;

		if (want_plus_first) {
			if (want_zero_first || want_minus_first) {
				throw "Only one stitch may be marked first";
			}
			target = plus_first;
		} else if (want_minus_first) {
			if (want_plus_first || want_zero_first) {
				throw "Only one stitch may be marked first";
			}
			target = minus_first;
		} else {
			target = zero_first;
		}

		//add indices to target arrays:
		for (let i = begin_plus; i < begin_zero; ++i) {
			target.plus.push(i);
		}
		target.zero.push(begin_zero);
		for (let i = begin_minus; i < end_minus; ++i) {
			target.minus.push(i);
		}
	}
	
	//handle plus_first, zero, minus_first in eight passes:

	//NOTE: this uses two extra passes when minus_first is empty;
	// one could check for this case and move the zero_first.plus needles
	// to the first block of passes.
	// I've chosen not to do this because I'd rather that the algorithm produce
	// the same stacking order on stitches regardless of other stuff on the current line

	//+1/0 to back:
	plus_first.plus.forEach(xferToBack);
	plus_first.zero.forEach(xferToBack);
	//return +1:
	plus_first.plus.forEach(function(i){ xferToFront(i, +1); });
	//return 0:
	plus_first.zero.forEach(function(i){ xferToFront(i, 0); });

	//-1/0 to back:
	minus_first.minus.forEach(xferToBack);
	zero_first.minus.forEach(xferToBack);
	plus_first.minus.forEach(xferToBack);
	minus_first.zero.forEach(xferToBack);
	//return -1:
	minus_first.minus.forEach(function(i){ xferToFront(i, -1); });
	zero_first.minus.forEach(function(i){ xferToFront(i, -1); });
	plus_first.minus.forEach(function(i){ xferToFront(i, -1); });
	//return 0:
	minus_first.zero.forEach(function(i){ xferToFront(i, 0); });

	//+1 to back:
	minus_first.plus.forEach(xferToBack);
	zero_first.plus.forEach(xferToBack);
	//return +1:
	minus_first.plus.forEach(function(i){ xferToFront(i, +1); });
	zero_first.plus.forEach(function(i){ xferToFront(i, +1); });

}

exports.lace_transfers = lace_transfers;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test lace transfers.");
	function test(offsets, firsts) {
		let frontStacks = [];
		let backStacks = [];
		let moved = [];
		for (let i = 0; i < offsets.length; ++i) {
			frontStacks.push([i]);
			backStacks.push([]);
			moved.push(false);
		}
		function xferToBack(i) {
			var stack = frontStacks[i];
			console.assert(stack.length === 1 && stack[0] === i, "xferToBack should be called on a lone loop on the front");
			console.assert(backStacks[i].length === 0, "xferToBack should have empty dest");
			backStacks[i] = stack;
			frontStacks[i] = [];
			moved[i] = true;

			console.log("xfer " + 'f' + i + " " + 'b' + i);
		}
		function xferToFront(i, ofs) {
			console.assert(offsets[i] === ofs, "lace_transfers must pass offsets[i]");

			var stack = backStacks[i];
			console.assert(stack.length === 1 && stack[0] === i, "xferToFront should be called on a lone loop on the back");
			console.assert(!(firsts[i] && frontStacks[i+ofs].length > 0), "xferToFront shouldn't put first stitch anywhere but first");

			backStacks[i] = [];
			frontStacks[i+ofs].push(i);

			console.log("xfer " + 'b' + i + " " + 'f' + (i+ofs) + " ; ofs: " + ofs);
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
				infoF += "  ";
			}
		}
		console.log(" index:" + infoI);
		console.log("offset:" + infoO);
		console.log(" first:" + infoF);

		lace_transfers(offsets, firsts, xferToBack, xferToFront);

		for (let i = 0; i < offsets.length; ++i) {
			console.assert(backStacks[i].length === 0, "back needles left empty");
			console.assert(moved[i] || offsets[i] === 0, "moved needles that needed it");
		}

		let layers = [];
		for (let n = 0; n < offsets.length; ++n) {
			frontStacks[n].forEach(function(i, d){
				while (d >= layers.length) layers.push("");
				while (layers[d].length < n * 3) layers[d] += "   ";
				layers[d] += " ";
				if (i < 10) layers[d] += " " + i;
				else layers[d] += i;
			});
		}
		for (let l = layers.length - 1; l >= 0; --l) {
			console.log("stitches:" + layers[l]);
		}
		console.log("   index:" + infoI);
	}

	test([ 0,-1,-1, 0, 1, 1, 1, 0,-1, 1, 0, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]);

 	test([ 1, 0, 1, 0, 1, 0, 0,-1, 0,-1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1],
	     [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);

}
