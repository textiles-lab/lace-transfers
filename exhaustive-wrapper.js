var child_process = require("child_process");
var fs = require("fs");
function exhaustive_transfers( offsets, firsts, xfer){


	var args = "";
	for(let i = 0; i < offsets.length; i++){
		args += offsets[i].toString() + " ";
	}
	for(let i = 0; i < firsts.length; i++){
		args += firsts[i].toString() + " ";
	}
	// why does sync not wokr
	try{
		child_process.execSync("./exhaustive " + args + " out.xfers", {stdio:[0,1,2]});
	}
	catch(c){
		//  TODO check how this must be written, for now __seems__ to work
		//	console.log("Errors:", c);
	}

	var xfers = [];
	let res = fs.readFileSync('./out.xfers','utf8');

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
	
	console.log("result from file \n", res);
}

exports.exhaustive_transfers = exhaustive_transfers;

if (require.main === module){

	console.log("Doing some exhaustive transfers.");
	const testDriver = require('./test-driver.js');

	function _exh_transfers(offsets, firsts, orders, limit, xfer){
		 exhaustive_transfers( offsets, firsts, xfer);
	}
	
	/*if (process.argv.length > 2){
		// needs somethin that skips anything longer than 6-8 stitches;
	}*/

	function test(offsets, firsts){
		let orders=[];
		while(orders.length < offsets.length) orders.push(0)
		limit = 1;
		let options = {'ignoreFirsts':true, 'ignoreStacks':true,'skipCables':true};
		testDriver.test(_exh_transfers, offsets, firsts, orders, limit, options);
	}

	test([-1,0,1],[0,0,0]);
	test([-1,1,1],[0,0,0]);
}
