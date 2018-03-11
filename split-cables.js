#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//split_cables divides flat knitting offsets into a "cables"
// part and a "flat" part.
//Parameters:
// offsets: array of offsets for each stitch index
//
//Returns an object with two member arrays:
// flatOffsets, cableOffests
// such that:
//  they have the same final offset:
//    offsets[i] = flatOffsets[i] + cableOffsets[i]
//  flatOffsets doesn't contain any cables:
//    i + flatOffsets[i] <= i+1 + flatOffsets[i+1]
//  flatOffsets doesn't contain any incorrect decreases:
//    i + flatOffsets[i] == i+1 + flatOffsets[i+1]
//      Only when i + offsets[i] == i+1 + offsets[i+1]
//  abs(flatOffsets[i]) <= abs(offsets[i])
//  abs(cableOffsets[i]) <= abs(offsets[i])
//  sum(abs(cableOffsets)) is minimized

function split_cables(offsets) {
	//if offsets doesn't have any cables, just return it:
	let hasCables = false;
	for (let i = 0; i + 1 < offsets.length; ++i) {
		if (i + offsets[i] > i+1 + offsets[i+1]) {
			hasCables = true;
			break;
		}
	}
	if (!hasCables) {
		let cableOffsets = [];
		for (let i = 0; i < offsets.length; ++i) {
			cableOffsets.push(0);
		}
		return {
			flatOffsets:offsets.slice(),
			cableOffsets:cableOffsets
		};
	}

	//"fancy" attempt: dynamic programming solution.
	// state:
	//   previous stitch index
	//   previous flatOffset
	// cost:
	//   sum(abs(cableOffset))

	//will assign cable offsets from this range:
	const MIN_OFFSET = -8;
	const MAX_OFFSET = 8;
	const OFFSET_COUNT = MAX_OFFSET - MIN_OFFSET + 1;

	let costs = new Uint32Array(offsets.length * OFFSET_COUNT);
	let froms = new Int8Array(offsets.length * OFFSET_COUNT);
	const INVALID_OFFSET = 127;

	//First step:
	for (let ofs = MIN_OFFSET; ofs <= MAX_OFFSET; ++ofs) {
		costs[0 * OFFSET_COUNT + (ofs-MIN_OFFSET)] = Math.abs(ofs);
		froms[0 * OFFSET_COUNT + (ofs-MIN_OFFSET)] = INVALID_OFFSET;
	}

	for (let i = 1; i < offsets.length; ++i) {
		for (let ofs = MIN_OFFSET; ofs <= MAX_OFFSET; ++ofs) {
			let best = 0xffffffff;
			let from = INVALID_OFFSET;
			let flat = offsets[i] - ofs;
			if (Math.abs(ofs) <= Math.abs(offsets[i]) && Math.abs(flat) <= Math.abs(offsets[i])) {
				for (let prevOfs = MIN_OFFSET; prevOfs <= MAX_OFFSET; ++prevOfs) {
					let prevFlat = offsets[i-1] - prevOfs;
					if (prevFlat > 1+flat) continue; //can't have cables in flat
					if (prevFlat === 1+flat) { //decrease in flat
						//shouldn't decrease in flat if no decrease in offsets:
						if (offsets[i-1] !== 1+offsets[i]) continue;
					}
					let cost = costs[(i-1)*OFFSET_COUNT + (prevOfs-MIN_OFFSET)];
					cost += Math.abs(ofs);
					if (cost < best) {
						best = cost;
						from = prevOfs;
					}
				}
			}
			costs[i*OFFSET_COUNT + (ofs-MIN_OFFSET)] = best;
			froms[i*OFFSET_COUNT + (ofs-MIN_OFFSET)] = from;
		}
	}

	//find best last step:
	let best = 0xffffffff;
	let last = INVALID_OFFSET;
	for (let ofs = MIN_OFFSET; ofs <= MAX_OFFSET; ++ofs) {
		let cost = costs[(offsets.length-1)*OFFSET_COUNT + (ofs-MIN_OFFSET)];
		if (cost < best) {
			best = cost;
			last = ofs;
		}
	}

	if (last === INVALID_OFFSET) throw "Failed to find a offset split solution.";

	let cableOffsets = [last];
	for (let i = offsets.length-1; i > 0; --i) {
		let from = froms[i*OFFSET_COUNT + (cableOffsets[0]-MIN_OFFSET)];
		console.assert(from !== INVALID_OFFSET, "valid solutions must have valid froms");
		cableOffsets.unshift(from);
	}

	console.assert(cableOffsets.length === offsets.length);
	let flatOffsets = [];
	for (let i = 0; i < offsets.length; ++i) {
		flatOffsets.push(offsets[i] - cableOffsets[i]);
		if (i > 0) {
			console.assert(flatOffsets[i-1] <= 1+flatOffsets[i], "flatOffsets should be flat");
			console.assert(flatOffsets[i-1] < 1+flatOffsets[i] || offsets[i-1] == 1+offsets[i], "flatOffsets should not contain spurious decreases");
		}
	}

	return {
		flatOffsets:flatOffsets,
		cableOffsets:cableOffsets
	};
}

exports.split_cables = split_cables;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test cable splits.");
	function test(offsets) {
		let infoO = "";

		function offsetToString(o) {
			if (o < 0) return o.toString();
			else if (o > 0) return '+' + o.toString();
			else return ' 0';
		}
		for (let i = 0; i < offsets.length; ++i) {
			infoO += " ";
			infoO += offsetToString(offsets[i]);
		}
		console.log("offsets:" + infoO);

		let ret = split_cables(offsets);

		let infoF = "";
		let infoC = "";
		for (let i = 0; i < offsets.length; ++i) {
			infoF += " ";
			infoF += offsetToString(ret.flatOffsets[i]);
			infoC += " ";
			infoC += offsetToString(ret.cableOffsets[i]);
		}

		console.log("   flat:" + infoF);
		console.log(" cables:" + infoC);

		console.assert(ret.flatOffsets.length === offsets.length, "flatOffsets is the right length");
		console.assert(ret.cableOffsets.length === offsets.length, "cableOffsets is the right length");

		for (let i = 0; i < offsets.length; ++i) {
			console.assert(ret.flatOffsets[i] + ret.cableOffsets[i] === offsets[i], "offsets sum properly");
			if (i + 1 < offsets.length) {
				let decrease = (i + offsets[i] === i+1 + offsets[i+1]);
				let flatDecrease = (i + offsets[i] === i+1 + offsets[i+1]);
				console.assert(!flatDecrease || decrease, "only decrease if flatDecrease");
			}
		}
	}

	test([ 2, 2, 0, -2, -2 ]);
	test([ -5, -5, -5, -4, -4 ]);
	test([ -3, -3, -5, -6, -6 ]);
}
