#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//cse_transfers computes transfers for flat knitting using the 
//collapse, stretch, expand strategy. No roll is required because, well flat.
//each iteration involves a stretch to back and expand to front phase
//after each iteration, the cost should monotonically decrease
//
//Parameters:
// offsets: array of offsets for each stitch index 
// firsts: array of the same length as offsets;
//     if Boolean(offsets[i]) is true, stitch[i] will
//     arrive at its destination needle first.
// xfer: output function


// cse_transfers returns a transfer plan by calling
//   xfer('f'/'b', i, 'f'/'b', i+o) to move stitches around
// options {ignoreFirsts:true/false} specifies if firsts need to be
// stacked in order or not
function cse_transfers(offsets, firsts, xfer, options, max_racking = 3) {
	
	//assumes everything is on the front bed to begin with,
	//and wants to be at offsets on the front bed as well
	let verbose = false;
	let strict_order = false;// !Boolean(options.ignoreFirsts);
	
	const Expanding = 0;
	const StretchToBack = 1;
	const ExpandToFront = 2;
	const action = ['Expanding......',
					'Stretch-to-back',
					'Expand-to-front'];
	

	// priority queue---

	const top = 0;
	const parent = i => ((i + 1) >>> 1) - 1;
	const left = i => (i << 1) + 1;
	const right = i => (i + 1) << 1;

	//from stack-oveflow (but maybe this wasn't really necessary)
	class PriorityQueue {
		constructor(comparator = (a, b) => a > b) {
			this._heap = [];
			this._comparator = comparator;
		}
		size() {
			return this._heap.length;
		}
		isEmpty() {
			return this.size() == 0;
		}
		peek() {
			return this._heap[top];
		}
		push(...values) {
			values.forEach(value => {
				this._heap.push(value);
				this._siftUp();
			});
			return this.size();
		}
		pop() {
			const poppedValue = this.peek();
			const bottom = this.size() - 1;
			if (bottom > top) {
				this._swap(top, bottom);
			}
			this._heap.pop();
			this._siftDown();
			return poppedValue;
		}
		replace(value) {
			const replacedValue = this.peek();
			this._heap[top] = value;
			this._siftDown();
			return replacedValue;
		}
		_greater(i, j) {
			return this._comparator(this._heap[i], this._heap[j]);
		}
		_swap(i, j) {
			[this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
		}
		_siftUp() {
			let node = this.size() - 1;
			while (node > top && this._greater(node, parent(node))) {
				this._swap(node, parent(node));
				node = parent(node);
			}
		}
		_siftDown() {
			let node = top;
			while (
				(left(node) < this.size() && this._greater(left(node), node)) ||
				(right(node) < this.size() && this._greater(right(node), node))
			) {
				let maxChild = (right(node) < this.size() && this._greater(right(node), left(node))) ? right(node) : left(node);
				this._swap(node, maxChild);
				node = maxChild;
			}
		}
	}


	let n_stitches = offsets.length;
	let slack_forward = new Array(n_stitches).fill(max_racking);
	let slack_backward = new Array(n_stitches).fill(max_racking);
	let current = new Array();
	let visited = new Set();
	
	const accum_add = (accumulator, currentValue) => Math.abs(accumulator) + Math.abs(currentValue);
	let target = new Array();	
	for (let i = 0; i < n_stitches; i++){ 
		current.push(i);
		target.push(i + offsets[i]);
	};

	if(strict_order){
		let no_firsts = true;
		for(let i = 0; i < n_stitches; i++){
			if(firsts[i]){
				no_firsts = false;
				for(let j = 0; j < n_stitches; j++){
					if(j==i || !firsts[j]) continue;
					if(target[j] == target[i]){
						console.log("index i = ", i, " target = ", target[i], "firsts =", firsts[i]);
						console.log("index j = ", j, " target = ", target[j], "firsts=", firsts[j]);
					}
					console.assert(target[j] != target[i], "two targets wan't to be first, bad input"); 
				}
			}
		}
		// avoid computing extended penalty if no firsts 
		strict_order = !no_firsts;
	}
	//console.log('target:', target);
	
	for(let i = 0; i < n_stitches - 1; i++){
		slack_forward[i] = Math.max(1, Math.abs(target[i]-target[i+1]))
	}
	for(let i = 1; i < n_stitches; i++){
		slack_backward[i] = Math.max(1, Math.abs(target[i-1]-target[i]));
	}

	//console.log('forward  slack:', slack_forward);
	//console.log('backward slack:', slack_backward);
	
	function new_state(state = undefined){
		//let first_state = {'current': current.slice(), 'prev': current.slice(), 'offsets':offsets.slice(),'do':StretchToBack, 'path':new Array(), 'l':0, 'r':n_stitches-1};
		let s = {'current': undefined,'prev':undefined,  'offsets': undefined, 'do':undefined, 'path': undefined ,'l':undefined, 'r':undefined, 'chain':undefined, 'rack':undefined};
		if(state != undefined){
			s.current = state.current.slice();
			s.offsets = state.offsets.slice();
			s.path = state.path.slice();
			s.l = state.l;// Number(state.l);
			s.r = state.r;// Number(state.r);
			s.prev = state.prev.slice();
			s.do =state.do;
			s.rack = state.rack;
			s.chain = state.chain.slice();
			s.chain.push(state);
			
		}
		return s;
	};

	function state_respects_slack(state){

		//stretch = abs(B + R - F) For B being back needle index, F being front needle index, R being racking.
		
		let beds = [];
		for(let i = 0; i < n_stitches; i++){
			if( i < state.l){
				beds.push('f');
			}
			else if( i >= state.l && i <= state.r){
				beds.push('b');
			}
			else if(i > state.r){
				beds.push('f');
			}
			else{
				console.assert(false,'?');
			}
		}
		for(let i = 1; i < n_stitches; i++){
			let slack = Math.max(1, Math.abs((i + offsets[i]) - (i-1 + offsets[i-1])));
			let sep  = Math.abs(state.current[i] - state.current[i-1]);
			if(beds[i] == beds[i-1]  && sep > slack){
				//console.log('stretching too much on the same bed');
				return false;
			}
			if(beds[i] !== beds[i-1]){
			let back = (beds[i] === 'b' ? state.current[i] : state.current[i-1]);
			let front = (beds[i] === 'f' ? state.current[i] : state.current[i-1]);
			let stretch = Math.abs( back + state.rack - front);
			if( stretch > slack) {
				//console.log('stretching too much '+stretch.toString()+' between beds at current rack ' + state.rack.toString() + ' slack ' + slack.toString());
				return false;
			}
			}
		}
	
			
		return true;

	};

	function generate_transfers(path, log=false){
		// keeping track of multiple transfers, similar to driver
		//console.log(path);
		let needles = {};
		for (let i = 0; i < n_stitches; ++i) {
			needles['f' + i] = [i];
		}
		for(let i = 0; i < path.length; i++){
			let e = path[i];
			if(e){
				console.assert(e.from_bed == 'f' || e.from_bed == 'b');
				console.assert(e.to_bed == 'f' || e.to_bed == 'b');
				if(log){
					console.log('\txfer '+e.from_bed + e.from.toString()+' '+e.to_bed+e.to.toString());	
				}
				else{
					let from = needles[e.from_bed+e.from];
					if(!from || from.length == 0) continue; // empty needle
					xfer(e.from_bed, e.from, e.to_bed, e.to);
					if (!((e.to_bed + e.to) in needles)) needles[e.to_bed+ e.to] = [];
					let to = needles[e.to_bed+e.to];
					while(from.length){ to.push(from.pop());}
					
				}
			}
		}
	};

	function penalty(state){
		let p = 0;
		for(let i = 0; i  < n_stitches; i++){
			p += Math.abs( state.offsets[i] );
		}
		if(strict_order ){
			//TODO ideally maintain this per state so that penalty computation is easier
			let needles = {};
			for (let i = 0; i < n_stitches; ++i) {
				needles['f' + i] = [i];
			}
			for(let i = 0; i < state.path.length; i++){
				let e = state.path[i];
				if(e){
					console.assert(e.from_bed == 'f' || e.from_bed == 'b');
					console.assert(e.to_bed == 'f' || e.to_bed == 'b');
					
					let from = needles[e.from_bed+e.from];
					
					if(!from || from.length == 0) continue; // empty needle
					if (!((e.to_bed + e.to) in needles)) needles[e.to_bed+ e.to] = [];
					let to = needles[e.to_bed+e.to];
					while(from.length){ to.push(from.pop());}

				
				}
			}
			let invalidFirsts = 0;
			// note: penalty has to penalize for the number of stacked loops
			// otherwise might hit a plateau. Not entirely sure if there are no
			// other situations where we might still hit a plateau, needs a 
			// case-by-case can always make progress proof
			for (let i = 0; i < n_stitches; ++i) {
				var n = needles['f' + (i + offsets[i])];
				if (firsts[i]) {
					if ( n  && n.indexOf(i) !== 0) {
						invalidFirsts += n.length;
					}
				}
			}
			p += invalidFirsts ;
		}
		return p;
		// something wierd with 1 element arrays and so on 
		// return state.offsets.reduce(accum_add);
	};

	function visit_state(state){
		let s = new_state(state);
		s.path = [];
		s.chain = [];
		s.penalty = penalty(state);
		visited.add( JSON.stringify(s) );
	};

	function has_state(state){
		let s = new_state(state);
		s.path = [];
		s.chain = [];
		s.penalty = penalty(state);
		return visited.has( JSON.stringify(s) );
	};
	function priority_order(states){
		states.sort(function(a, b){
			let keyA = penalty(a),
				keyB = penalty(b);
			
			if(keyA < keyB) return 1;
			if(keyA > keyB) return -1;
			// if penalty is identical pick the one with fewer transfers in its path
			if(a.path.length < b.path.length) return 1;
			if(a.path.length > b.path.length) return -1;
			// break ties by something else
			if(a.l - a.r > b.l - b.r ) return 1;
			if(a.l - a.r < b.l - b.r) return -1;
			return 0;
		});
		return states;
	};

	function print_chain(state){
		console.clear();
		console.log("***************Final chain *************************");	
		console.log("target:", target);
		for(let i = 0; i < state.chain.length; i++){
			console.log('\t\t', action[state.chain[i].do], 'l:', state.chain[i].l, 'r:', state.chain[i].r, 'penalty:', penalty(state.chain[i]));
			generate_transfers(state.chain[i].path, true);

		}
		console.log('\t\t', action[state.do], 'l:', state.l, 'r:', state.r, 'penalty:', penalty(state));
		
		generate_transfers(state.path, true);
	
		console.log("**************end of chain*****************************");	
	};


	function okay_to_move_index_by_offset(state, idx, ofs){
	
		//console.log('okay to move ', idx, ' by ', ofs, '? curr:', state.current, 'ofs:', state.offsets, 'l', state.l, 'r', state.r);
		console.assert(idx >= 0 && idx < n_stitches, "idx is not valid");
		console.assert(state.r >= 0 && state.r < n_stitches, "r is not valid");
		console.assert(state.l >= 0 && state.l < n_stitches, "l is not valid");


		// not causing slack problems  
		let beds = [];
		for(let i = 0; i < n_stitches; i++){
			if( i < state.l){
				beds.push('f');
			}
			else if( i >= state.l && i <= state.r){
				beds.push('b');
			}
			else if(i > state.r){
				beds.push('f');
			}
			else{
				console.assert(false,'?');
			}
		}
		beds[idx ] = 'f'; // idx will move to the front 
		if( idx > 0 && beds[idx] !== beds[idx-1]){
			let back = state.current[idx-1];
			let front = state.current[idx] + ofs;
			let stretch =  Math.abs(back + ofs - front);
			let slack = Math.max(1, Math.abs(idx + offsets[idx] - (idx-1 + offsets[idx-1])));
			if( stretch > slack ) return false;
		}
		if( idx+1 < n_stitches && beds[idx] !== beds[idx+1]){
			let back = state.current[idx+1];
			let front  = state.current[idx] + ofs;

			let stretch =  Math.abs(back + ofs - front);
			let slack = Math.max(1, Math.abs(idx + offsets[idx] - (idx+1 + offsets[idx+1])));
			if( stretch > slack ) return false;
		}


		// not stacking over a stitch that wan'ts to go elsewhere, not tangling
		let c = state.current[idx]+ ofs;
		let o = state.offsets[idx]- ofs;
		for(let i = 0; i < state.l; i++){
			if(state.current[i] == c && (state.offsets[i]) != (o)){
				console.assert(i != idx, "shouldn't happen, right?");
				return false;
			}
			if(state.current[i] > c){
				return false;
			}
		}
		for(let i = state.r+1; i < n_stitches; i++){
			if(state.current[i] == c && (state.offsets[i]) != (o)){
				console.assert(i != idx, "shouldn't happen, right?");
				return false;
			}
			if(state.current[i] < c ){
				return false;
			}
		}

		// not occupying place when another stitch wan'ts to be there first
		// this works for many simple cases, but there are cases when multiple 
		// passes are required such that a first loop has to be placed 
		// temporarily in the wrong place
		// TODO perhaps checking conditions only under stacking is what
		// we need 
		if(false && strict_order){
			let indices = [];
			let f_idx = firsts.indexOf(1);
			while(f_idx != -1){
				indices.push(f_idx);
				f_idx = firsts.indexOf(1,f_idx+1);
			}
			// these are all the ids that wan't to be first
			// if you put yourself at the target of this idx
			// then return false 
			for(let j = 0; j < indices.length; j++){
				let j_idx = indices[j];
				if(j_idx == idx) continue;
				
				let j_wants_to_be_there_first = (state.current[j_idx]+state.offsets[j_idx] == c);
				let j_is_not_there = ( j_idx >= state.l && j_idx <= state.r ) || (state.offsets[j_idx] != 0 && (j < state.l || j > state.r));
				let i_is_where_j_is = (state.current[j_idx] == state.current[idx]);
				//console.log( j_idx, ' wants to be there: ', j_wants_to_be_there_first, ' but is not there ', j_is_not_there, ' but is over i ', i_is_where_j_is);
				if( j_is_not_there && j_wants_to_be_there_first && !i_is_where_j_is) return false;
			}
		
		}

		return true;
	
	};

	function print_state(state){
		console.log('*******************************');
		console.log('\t\tl:',state.l,'r:',state.r,' do:', action[state.do], 'at rack:', state.rack);
		for(let i = 0; 	i < n_stitches; i++){
			console.log('stitch ' + i.toString() + ' is at ' + (state.current[i]).toString()+ ' wants  offset ' + (state.offsets[i]).toString()+(firsts[i]?'*':'') + ' (with forward slack ' + slack_forward[i].toString() + ' and backward slack ' + slack_backward[i].toString()+ ' and penalty '+ penalty(state).toString() +')');
		}
		
		console.log('*******************************');
	};

	let PQ = new PriorityQueue((a, b) => (penalty(a)===penalty(b) ? ( a.path.length===b.path.length? a.r-a.l > b.r-b.l : a.path.length < b.path.length) : penalty(a) < penalty(b)));

	//let States = new Array();
	let first_state = {'current': current.slice(), 'prev': current.slice(), 'offsets':offsets.slice(),'do':StretchToBack, 'path':new Array(), 'l':0, 'r': n_stitches-1, 'chain':new Array(), 'rack':0};
	
	//States.push(first_state);
	PQ.push(first_state);

	let last_penalty = Infinity;

	while( !PQ.isEmpty() /*States.length*/ ){
	
	
		let s = PQ.pop();//priority_order(States).pop(); 
		if(has_state(s)){
			if(verbose){
			console.log('\x1b[33m');
			print_state(s);
			console.log('\x1b[0m');
			console.log('\t\tvisited already. states pending:',States.length);
			}
			continue;
		}
		visit_state(s);
		process.stdout.write("\r"+action[s.do]+"\t\t\t");

		if(s.do === StretchToBack){
			console.assert(penalty(s) < last_penalty, 'penalty should decrease');
			last_penalty = penalty(s);
		}

		if(verbose){
		console.log('\x1b[1m');
		print_state(s);
		console.log('\x1b[0m');
		}

		console.assert( state_respects_slack(s), 'all accepted states must respect slack');	
		if( penalty(s)  === 0 /*&& s.do === StretchToBack*/){
			console.log('done', penalty(s));
			//if done on a collapsed state, follow up with one round of stretch to front
			/*
			console.log('final state:');
			print_state(s);
			console.log('target', target);
			console.log('current',s.current);
			console.log('offsets', s.offsets);
			console.log('prev', s.prev);
			console.log('firsts', firsts);
			*/
			if(s.do === Expanding ){
				for(let i = s.l; i <= s.r; i++){
					s.path.push({'from_bed':'b', 'from':s.current[i],'to_bed':'f',to:s.current[i]});
				}
			}
			generate_transfers(s.path);
			
			return;

		}
		
		if(s.do == StretchToBack){ 
			//console.log('\t\tStretch state to back');
			// the easy case, only translate.
			// as long as within min-max range of needles, always safe
			// TODO add a min-max needle range
			for(let r  = -max_racking; r <= max_racking; r++){
				let ss = new_state(s);
				for(let i = 0; i < n_stitches; i++){
					console.assert(ss.current[i] !== undefined, "from is well defined(stretch)");
					console.assert(ss.current[i]-r !== undefined, "to is well defined(stretch)");
					ss.path.push({'from_bed':'f', 'from':ss.current[i], 'to_bed':'b', to:ss.current[i]-r});
				
					ss.current[i] -= r;
					ss.offsets[i] += r;
				}
				ss.do = Expanding;
				ss.prev = ss.current.slice();
				ss.l = 0;
				ss.r = n_stitches-1;
				ss.rack = 0; // at the end of this operation, rack can be reset
				if( state_respects_slack(ss) /*&& penalty(ss) <= last_penalty*/ && !has_state(ss)){
					//States.push(ss);
					PQ.push(ss);
				}
				

			}
		}//collapse
		else if(s.do === Expanding){
	
			//console.log('\t\t\tExpanding state.. l:' + ( s.l ).toString() + ' r: '+ ( s.r).toString());
			console.assert(s.l <= s.r, 'l<=r, for all expanding states');
			let min_l = -max_racking;
			let min_r = -max_racking;
			let max_l = max_racking;
			let max_r = max_racking;
			// Find the next legal state(s) to move s.l 
			{

				let n = s.current[s.l];	
				//console.log('\t\t ** Moving l in range ', min_l, max_l);
				// go through each offset
				for(let o = min_l; o <= max_l; o++){

					//console.log('attempting to move by', o);
					{

						if( okay_to_move_index_by_offset(s, s.l, o)){
							// launch a new version 
							let next = new_state(s);

							next.rack = o;
							if( !state_respects_slack(next)) continue;
							{
								next.path.push({'from_bed':'b', 'from':next.current[next.l],'to_bed':'f',to:next.current[next.l]+o});
							}
							next.current[next.l] += o;
							next.offsets[next.l] -= o;
						//	console.log('(L)Found offset ' + o.toString() + ' that works.');
						//	console.log('\t l:', next.l,'current', next.current[next.l],'offset', next.offsets[next.l]);
							

							if(next.l < next.r){
								next.l++;
								next.do = Expanding;
								
								if(!has_state(next) /*&& penalty(next) <= last_penalty*/ && state_respects_slack(next)){
									PQ.push(next);
									//States.push(next);
									//console.log('\t adding next l ('+next.l.toString()+')');
								}
							}
							else if(next.l == next.r){
								next.do = ExpandToFront;
								next.l = 0;
								next.r = n_stitches-1;
								if(!has_state(next) /*&& penalty(next) <= last_penalty*/ && state_respects_slack(next)){
									PQ.push(next);
									//States.push(next);
									//console.log('\t adding next(l) for expansion');
								}

							}
						}
						

					}
				}
			}


			// Find the next legal state(s) to move s.r 
			if(0){
				let n = s.current[s.r];
			
				//console.log('\n\t\t ** Moving r in range \n', min_r, max_r);

				// go through each offset
				for(let o = min_r; o <= max_r; o++){

					//console.log('attempting to move by', o);
					{

						if( okay_to_move_index_by_offset(s, s.r, o)){
							// launch a new version 
							let next = new_state(s);
							next.rack = o;
							if(!state_respects_slack(next)) continue;
							{
								next.path.push({'from_bed':'b', 'from':next.current[next.r],'to_bed':'f',to:next.current[next.r]+o});
							}
							
							next.current[next.r] += o;
							next.offsets[next.r] -= o;
							//console.log('(R)Found offset ' + o.toString() + ' that works.');
							//console.log('\t r', next.r,'current', next.current[next.r],'offset', next.offsets[next.r]);

							if(next.r > next.l){
								next.r--;
								if(!has_state(next) /*&& penalty(next) <= last_penalty*/ && state_respects_slack(next)){
									PQ.push(next);
									//States.push(next);
									//console.log('\t addng next r ('+next.r.toString()+')');
								}
							}
							else if(next.r == next.l /*&& penalty(next) <= last_penalty*/){
								next.do = ExpandToFront;
								next.l = 0;
								next.r = n_stitches-1;
								if(!has_state(next) && state_respects_slack(next))
								{
									PQ.push(next);
									//States.push(next);
									//console.log('\t adding next(r) for expansion');
								}

							}

						}

					}
				}
			}

		}
		else if(s.do === ExpandToFront){ // if collapsed state expand to front
			//console.log('\t\tExpand state to front', s.prev, s.current, s.offsets);
			let ss = new_state(s);
			
			// expanding has already done all the work, so this is trivial 
			// assuming prev was not clobbered by anything (it shouldn't be)
			// but also need to do this in order
		
			ss.do = StretchToBack;		
			// possibly figure out if fewer passes are possible 
			if(false )
			{
				for(let i = n_stitches-1;  i >= 0; i--){
					console.assert(ss.prev[i] !== undefined, "from is well defined");
					console.assert(ss.current[i] !== undefined, "to is well defined");
					ss.path.push({'from_bed':'b','from':ss.prev[i],'to_bed':'f',to:ss.current[i]});
				}
			}
			ss.rack = 0; // at the end of this operation rack can be reset
			console.assert( state_respects_slack(ss) , 'this should be slack friendly, right?');
			if( penalty(ss) < last_penalty && !has_state(ss)){
				PQ.push(ss);
				//States.push(ss);
			}

		}
	}//while-states

	// if we reached here, we did not find any valid state -- should not happen 
	console.log('source ',current);
	console.log('target ',target);
	console.log('offsets', offsets);
	console.log('firsts ', firsts);
	console.assert(false, 'no valid stretch expand strategy worked?!');
}


exports.cse_transfers = cse_transfers;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test collapse-stretch-expand transfers.");
	
	const testDriver = require('./test-driver.js');
	function _cse_transfers(offsets, firsts, orders, limit, xfer){
		//console.log("\x1b[32mTesting:");
		//console.log("Offsets", offsets);
		//console.log("\x1b[0m");	
		let options = {ignoreFirsts:true};
		cse_transfers(offsets, firsts, xfer, options);
	}
	
	if (process.argv.length > 2){
		testDriver.runTests(_cse_transfers, { 'skipCables':true , 'ignoreFirsts':true, 'ignoreStacks':true, 'outDir':'results/cse'});
		return;
	}

	function test(offsets, firsts){
		let orders = [];
		while( orders.length < offsets.length) orders.push(0);
		let limit = 1;
		let options = {ignoreFirsts:true, ignoreStacks:true};
		testDriver.test(_cse_transfers, offsets, firsts, orders, limit, options);
	}

// cases that work
if(1){	
	test([1,1],[0,0]);

	test([-1,+0, +1],
		[ 0, 0,  0]);

	test([1,0,-1],
		[0,0,0]);

	test([-2,-2,0,0],
		[0,0,0,0]);
	
	test([1, 20],
		[0, 0]);
	
	test([+1,+1,+1,+1,+1,+1,+1,+1],
		[ 0, 0, 0, 0, 0, 0, 0, 0]);

	test([-3,-2,-2,-2,-2,-2,-2,-2],
		[ 0, 0, 0, 0, 0, 0, 0, 0]);

	test([+1,+1,+2,+2,+3,+3,+2,+1],
		[0,0,0,0,0,0,0,0]);

	test([+1,+2,+1,+2],
		[ 0, 0, 1, 0]);

	test([ +1,+0,-1],
		[  0, 1, 0]);
	
	test([  0, 0,-1, 0,-1, 0,-1],
		[   1, 0, 0, 1, 0, 0, 1]);
	
	test([ -1,-1,-2,-2,-3],
		[   0, 1, 0, 0, 1]);
	
	test([-1,-1,-2,-2,-3,-3,-2,-1],
		[ 0, 0, 1, 1, 0, 0, 0, 0]);
	
	//work but currently slow-with-firsts
	test([ 1, 0,+1,+1,+2,+2,+1,+1, 0, 0,+1, 0],
		[ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
	
	test([-8,-4,-3,-3,-2,-2,-1,-1, 0,+1,+1,+2,+2,+3,+3],
		[ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

	test([+1,+2,+3,+3,+2,+2,+1,+1],
		[ 0, 0, 0, 0, 1, 1, 0, 0]);
	
	test([-1,-1,-2,-2,-3,-3,-2,-1],
		[ 0, 0, 1, 1, 0, 0, 0, 0]);
	
	test([+1,+1,+2,+2,+3,+3,+2,+1],
		[ 0, 1, 0, 0, 0, 0, 1, 0]);
	
	test([-4,-3,-2,-1, 0,+1,+2,+3],
		[ 0, 0, 0, 0, 0, 0, 1, 0]);
	
	test([ -1,-1, 0, 1, 1, 1],
		[  0, 0, 0, 0, 0, 1]);
	
	test([ -3,-2,-1],
		[  1, 0, 0]);
}


}
