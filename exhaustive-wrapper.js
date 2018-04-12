#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

// exhaustive-wrapper is a js wrapper that calls exhaustive ( the executive built for exhaustive-search.cpp )
// the process is sync executed and results are dumped into out_file over which xfer is called
// if running simultaneous versions of the wrapper, change out_file name
var child_process = require("child_process");
var fs = require("fs");
function exhaustive_transfers( offsets, firsts, xfer){

	var out_file = "out.xfers";
	var args = " " + offsets.length.toString() + " ";;
	for(let i = 0; i < offsets.length; i++){
		args += offsets[i].toString() + " ";
	}
	for(let i = 0; i < firsts.length; i++){
		args += (firsts[i] ? " 1 " : " 0  ");
	}
	console.log(args);
	// why does sync not wokr
	try{
		child_process.execSync("./exhaustive " + args + " "+ out_file, {stdio:[0,1,2]});
	}
	catch(c){
		//  TODO check how this must be written, for now __seems__ to work
		//	console.log("Errors:", c);
	}

	var xfers = [];
	let res = fs.readFileSync("./"+out_file,'utf8');

	res.split(/\s+/).forEach(function(bn){
		if(bn==="")return;
		var x = /^([fb])([-+]?\d+)$/.exec(bn);
		console.assert( x , " x is a valid argument ");
		xfers.push({'b':x[1], 'n':parseInt(x[2])});
	});
	console.assert(xfers.length%2 == 0 , "must have src and dst");
	for(let i = 0; i < xfers.length; i+=2){
		xfer(xfers[i].b, xfers[i].n, xfers[i+1].b, xfers[i+1].n);
		console.log(xfers[i].b+xfers[i].n + ' -> ' + xfers[i+1].b+xfers[i+1].n);
	}
	
	//console.log("result from file \n", res);
}

exports.exhaustive_transfers = exhaustive_transfers;

if (require.main === module){

	console.log("Doing some exhaustive transfers.");
	const testDriver = require('./test-driver.js');

	function _exh_transfers(offsets, firsts, orders, limit, xfer){
		 exhaustive_transfers( offsets, firsts, xfer);
	}
	
	if (process.argv.length > 2){
		// needs somethin that skips anything longer than 6-8 stitches;
		testDriver.runTests(_exh_transfers, {'skipCables':true, 'ignoreFirsts':false, 'ignoreStacks':true, 'ignoreEmpty':false, 'outDir':'results/exh-firsts'});
	}

	else{
	function test(offsets, firsts){
		let orders=[];
		while(orders.length < offsets.length) orders.push(0)
		let limit = 1;
		let options = {'ignoreFirsts':false, 'ignoreStacks':true,'skipCables':true, 'ignoreEmpty':true};
		// just to make it easier to figure out which pass is going on
		console.log("\x1b[32m testing offsets:", offsets, "firsts", firsts,"\x1b[0m");
		testDriver.test(_exh_transfers, offsets, firsts, orders, limit, options);
	};

	
	test([-1,-2,1, 0, 0, 0],[1,0,0, 0, 0, 0]);
	test([-1,-2,0, 0, 0, 0],[0,1,0, 0, 0, 0]);
	test([1,0,-1, 0, 0, 0],[0,0,1, 0, 0, 0]);
	test([1,0,-1, 0, 0, 0],[0,1,0, 0, 0, 0]);
	test([1,0,-1, 0, 0, 0],[1,0,0, 0, 0, 0]);
	test([-1,1,1, 0, 1, 0],[0,0,0, 0, 1, 0]);
	test([-1,1,1, 0, 0, 1],[0,0,0, 0, 0, 0]);
	test([-2,1,1, 0, 0, 0],[0,0,0, 0, 0, 0]);
	test([-4,1,0, 0, 0, 0],[0,0,0, 0, 0, 0]);
	test([-4,0,0, 2, 1, 0],[0,0,0, 0, 1, 0]);
	test([-4,2,1, 2, 1, 0],[0,1,0, 1, 0, 0]);
	test([-4,2,1, 2, 1, 0],[0,1,0, 0, 0, 1]);
	test([6,5,4, 3, 2, 1],[0,0,0, 1, 0, 0]);
	
	}

	


}
