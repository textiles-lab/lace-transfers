#include <iostream>
#include <algorithm>
#include <iterator>
#include <vector>
#include <queue>
#include <set>
#include <map>
#include <fstream>
#include <assert.h>

#define n_rack     8 
#define Back_Bed  'b'
#define Front_Bed 'f'

typedef std::pair<char, int> BN;

// signature should use the machine state to work with firsts
typedef std::pair<int, std::map< std::pair<char,int>, std::vector<int> > > Signature;

int n_stitches = 0;



bool exhaustive( std::vector<int> offsets, std::vector<int> firsts , std::string outfile="out.xfers"){

	assert( offsets.size() == firsts.size() && " offsets and firsts must have the same size " );
	assert( offsets.size() == (size_t)n_stitches && " number of stitches is fixed " );

	bool ignore_firsts = false;
	auto temp = offsets;
	std::sort(temp.begin(), temp.end());
	auto last = std::unique( temp.begin(), temp.end());
	temp.erase(last, temp.end());
	int lower_bound_passes = temp.size();
	
	std::cout<<std::endl;
	int upper_bound_passes =  INT32_MAX; 
	//TODO compute a better lower bound for when firsts exist
	for(int i = 0; i < (int)temp.size(); i++){
		if(temp[i] == 0){
			lower_bound_passes--;
		}
	}
	std::vector<int> targets;
	for(int i = 0; i < n_stitches; i++){
		targets.push_back(i + offsets[i]);
	}
	if( !ignore_firsts){
		std::set<int> ofs;
		for(int i = 0; i < n_stitches; i++){
			if(ofs.count( offsets[i])){
				continue;
			}
			if(offsets[i] == 0 && !firsts[i]){ // and if it shares a target that wants to be first
				ofs.insert(offsets[i]);
			}
			else if(offsets[i] != 0){
				ofs.insert(offsets[i]);
			}
		}
		std::cout<<"unique offsets"<<std::endl;
		for(auto o : ofs){
			std::cout<<o << " ";
		}
		std::cout<<std::endl;
		lower_bound_passes = ofs.size();

		// sanity check targets 

		for(int i = 0; i < n_stitches; i++){
			if(firsts[i]){
				bool not_stacked = true;
				for(int j = 0; j < n_stitches; j++){
					if( j == i ) continue;
					if( firsts[j] && targets[j] == targets[i]){
						assert(false && "two indices with the same target cannot both be first");
					}
					if(targets[j] == targets[i]){
						not_stacked = false;
					}
				}
				// no point of firsts being set if it is the only loop
				if(not_stacked) firsts[i] = 0;
			}
		}
		bool has_firsts = 0;
		for(int i = 0; i < n_stitches; i++){
			if(firsts[i]) has_firsts = true;
		}
		if(!has_firsts) ignore_firsts = true;
	}
	// sanity check that offsets do not have cables
	{
		int up = -INT32_MAX;
		int dn =  INT32_MAX;
		bool up_okay = true;
		bool dn_okay = true;
		for(int i = 0; i < n_stitches; i++){
			if( targets[i] >= up ){
				up = targets[i];
			}
			else{
				up_okay = false;
			}
			if( targets[i] <= dn){
				dn = targets[i];
			}
			else{
				dn_okay = false;
			}
		}
		if( !up_okay && !dn_okay ){
			assert(false && "exhaustive search does not support cables!");
		}
		
	}

	bool all_zeros = true;
	for(int i = 0; i < n_stitches; i++){
		if(offsets[i] != 0){
			all_zeros = false;
		}
	}
	if(all_zeros && ignore_firsts){
		// ah need to write an empty file:

		std::ofstream out(outfile);
		out.close();
		std::cout<<"all zeros, return!" << lower_bound_passes << std::endl;
		return true;
	}
	std::cout << "lower bound = " << lower_bound_passes << std::endl;
	struct State{
		std::vector<int> currents;
		std::vector<int> offsets;
		std::vector<char> beds;
		// maintain machine state
		std::map<BN, std::vector<int>> machine;
		int left = 0;
		int rack = 0;
		int penalty = 0;
		int passes = 0;
		int est_passes = 0;
		std::vector< std::pair< BN, BN> > xfers;
	};
	auto Penalty = [=](const State& s)->int{
		int p = 0;
		for(int i = 0; i < (int)s.offsets.size(); i++){
			p += std::abs(s.offsets[i]);
		}
		if(!ignore_firsts){
			// have not yet figured out how penalty will be accrued for mistakes on firsts
			// but no move that causes a first problem is possible
		}
		return p;
	};
	auto Bed = [=](const BN& bn)->char{
		return bn.first;
	};
	auto Needle= [=](const BN& bn)->int{
		return bn.second;
	};
	auto Front = [=](const std::pair<BN, BN>& xfer)->int{
		if(Bed(xfer.first) == 'b')
			return Needle(xfer.second);
		else 
			return Needle(xfer.first);
	};
	auto Back = [=](const std::pair<BN, BN>& xfer)->int{
		if(Bed(xfer.first) == 'b')
			return Needle(xfer.first);
		else
			return Needle(xfer.second);
	};

	auto Opposite = [=](const State& s, int idx)->char{
		if(s.beds[idx] == Front_Bed) return Back_Bed;
		if(s.beds[idx] == Back_Bed) return Front_Bed;
		assert(false && "Bed has to be back or front");
		return Front_Bed;
	};

	auto PrintCurrent = [=](const State &s)->char{
		std::cout<<" current = [ ";
		for(int i = 0; i < n_stitches; i++){
			std::cout << s.beds[i]<< s.currents[i] << " , ";
		}
		std::cout<<" ] ";
		return '\t';
	};
	auto PrintOffsets = [=](const State &s)->char{
		std::cout<<" offsets = [ ";
		for(int i = 0; i < n_stitches; i++){
			std::cout << s.offsets[i] << " , ";
		}
		std::cout<<" ] ";
		return '\t';
	};
	(void)PrintOffsets;
	auto PrintMachine = [=](const State &s)->char{
		std::cout<<" machine = [ ";
		for(auto bn : s.machine){
			std::cout<< Bed(bn.first)<<Needle(bn.first)<<"{";
			for(auto i : bn.second) std::cout<<i<<",";
			std::cout<<"} ,";
		}
		std::cout<<" ]";
		return '\t';
	};
	(void)PrintMachine;
	
	auto LowerBoundFromHere = [=](const State&s, bool log=false)->int{
		
		// estimate of the cost from current state 
		std::set<BN> ofs;
		std::set<int> zeros;
		std::set<int> fs;
		for(int i = 0; i < n_stitches; i++){
			if(s.offsets[i] == 0 && s.beds[i] == Back_Bed){
				ofs.insert(std::make_pair(s.beds[i], s.offsets[i]));
			}
			else if(s.offsets[i] != 0){
				ofs.insert(std::make_pair(s.beds[i], s.offsets[i]));
			}
			if(s.offsets[i] == 0 && s.beds[i] == Front_Bed){
				zeros.insert(i);
			}
		    if(s.offsets[i] != 0 && firsts[i]){
				fs.insert(i);
			}
		}
		int min_passes  = ofs.size();
		// if not ignoring firsts, this is too low, but okay for conservative estimate
		if(!ignore_firsts){
			bool add_one = false;
			for(auto z : zeros){
				for(auto f : fs){
					if(s.currents[f]+s.offsets[f] == s.currents[z]){
						add_one = true;
					}
				}
			}
			if(add_one){
				min_passes += 1;
			}
			
		}
		return min_passes;
			
	};
	auto Passes = [=](const std::vector<std::pair<BN,BN>>& xfers, bool log = false)->int{
		// track passes assuming xfers are happening in sequence
		int  p = 1;
		// you just finished knitting f1->fn, so direction is -ve
		// if you did knit the first course in the opposite direction, 
		// all the computation would still be self consistent 
		if(xfers.size() == 0) return 0;
		bool source_is_front_bed = (Bed(xfers[0].first) == Front_Bed);
		int  current_rack = Front(xfers[0])-Back(xfers[0]);
		for(auto x : xfers){
			assert( Bed(x.first) != Bed(x.second) && "can't xfer between same bed!");
			int needs_rack =  Front(x) - Back(x);
			if(log){
			std::cout<<Bed(x.first)<<Needle(x.first)<<" -> " << Bed(x.second) << Needle(x.second) ;
			}
			bool beds_need_swapping = (((Bed(x.first) != Front_Bed) && source_is_front_bed)||( Bed(x.first) == Front_Bed && !source_is_front_bed));
			if(needs_rack == current_rack){
				// check direction, not important for the backend
				// front-to-back and back-to-front might matter but staying
				// consistent with generate-stats  
				if(beds_need_swapping){
					p++;
					source_is_front_bed = !source_is_front_bed;
					if(log){
						std::cout<<"\t--break pass( beds swapped )--";
					}
				}
				//else if(log){
				//		std::cout<<"\t--same pass( same racking ) front-to-back:"<<source_is_front_bed << " bed-needed-swapping " << beds_need_swapping;
				//}
			}
			else{
				// need one more pass to assign rack and direction will be flipped
				p++;
				current_rack = needs_rack;
				source_is_front_bed = (Bed(x.first) == Front_Bed);
				if( log ){
					std::cout<<"\t--break pass(racking)-- " ;
				}
			}
			if(log){
				std::cout << std::endl;
			}
		}
		return p;
	
	};

	auto schoolbus = [=](const State &s)->State{
		State r = s;
		bool okay = true;
		for(int i = 0; i <n_stitches; i++){
			if(std::abs(s.offsets[i]) > n_rack){
				okay = false;
			}
		}
		if(!okay) return r;
		std::cout<<"Trying school bus"<<std::endl;
		for (int i = 0; i < n_stitches; i++){
			auto from = std::make_pair( Front_Bed, i);
			auto to  = std::make_pair( Back_Bed, i);
			auto trans = std::make_pair(from, to);
			auto f = r.machine[from];
			assert(!f.empty());
			r.beds[i] = Back_Bed;
			r.machine[to].push_back(f[0]);
			r.machine[from].clear();
			r.xfers.push_back(trans);
			
		}
		r.passes++;
		
		int ofs = -n_rack;
		while(ofs <= n_rack){
			for(int i = 0; i < n_stitches; i++){
				if(r.offsets[i] == ofs){
					auto to = std::make_pair( Front_Bed, i+ofs);
					auto from = std::make_pair( Back_Bed, i );
					auto t = std::make_pair(from, to);
					auto f = r.machine[from];
					for(auto e : f){
					r.machine[to].push_back(e);
					}
					r.machine[from].clear();
					r.xfers.push_back(t);
					//todo update current and ofset	if(t.beds[idx] == Front_Bed){
					r.offsets[i] -= ofs;
					r.currents[i] += ofs;
					r.beds[i] = Front_Bed;
				}
			}
			ofs++;
		}
		r.passes = Passes(r.xfers, true);
		r.penalty = Penalty(r);
		
		return r;
	};
	(void)schoolbus;

	
	struct LessThanByPenalty
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return lhs.penalty > rhs.penalty;
		}
	};
	struct LessThanByEstimatedPasses
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return lhs.passes + lhs.est_passes > rhs.passes + rhs.est_passes;
		}
	};
	
	struct LessThanByEstimatedPassesThenPenalty
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return (lhs.passes + lhs.est_passes == rhs.passes + rhs.est_passes )? (lhs.penalty > rhs.penalty) : (lhs.passes + lhs.est_passes > rhs.passes+rhs.est_passes);
		}
	};
	
	struct LessThanByPenaltyThenPasses
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return (lhs.penalty == rhs.penalty ? lhs.passes + lhs.est_passes > rhs.passes + rhs.est_passes : lhs.penalty > rhs.penalty);
		}
	};

	auto state_respects_slack = [=](const State& s)->bool{
		for(int i = 1; i < n_stitches; i++){
			int slack = std::max(1, std::abs( i + offsets[i] - (i-1 + offsets[i-1])));
			if(s.beds[i] == s.beds[i-1]){
				int stretch = std::abs(s.currents[i-1] - (s.currents[i]));
				if( stretch > slack) return false;
			}
			else{
				int back = ( (s.beds[i] == Back_Bed) ? s.currents[i] : s.currents[i-1]);
				int front = ((s.beds[i] == Back_Bed) ? s.currents[i-1] : s.currents[i]);
				int stretch = std::abs(back + s.rack - front);
				if(stretch > slack) return false;

			}
		}
		return true;
	};
	auto okay_to_move_index_by_offset = [=](const State& s, int idx, int ofs, bool log = false)->bool{
		
		
		// first can the current state be racked by ofs without stretching any of the yarns
		// then  if idx is moved to the opposite bed, is it still okay 
		State t = s;
		t.rack = ofs;
		if(!state_respects_slack(t)) {
			if(log)
			std::cout<<"\t\t\t\tinitial state cannot be racked to ofs " << ofs  << " current " << PrintCurrent(t)<< std::endl;
			return false; // cannot rack current state 
		}
		//int pb = t.beds[idx];
		//int pn = t.currents[idx];
		t.beds[idx] = Opposite(t, idx);
		// currently  current[idx]  on the back bed is aligned to
		//  current[idx]  - ofs on the front bed
		//  back to front: lose ofs, front to back: gain ofs 
		//  Moved from back-bed to front-bed
		if(t.beds[idx] == Front_Bed){
			t.offsets[idx] -= ofs;
			t.currents[idx] += ofs;
		}
		// Moved from front-bed to back-bed
		else{
			t.offsets[idx] += ofs;
			t.currents[idx] -= ofs;
		}
		if(!state_respects_slack(t)) {
			if(log)
			std::cout<<"\t\t\t\tnew state cannot be at racked ofs " << ofs << " current " << PrintCurrent(t) << std::endl;
			return false; // cannot xfer at ofs rack 
		}
		// any new tangling ?
		// only makes sense if skipping cables
		int prev = idx-1;
		int next = idx+1;
		while(prev >= 0){
			if( t.beds[prev] != t.beds[idx]) prev--;
			else break;
		}
		while(next < n_stitches){
			if(t.beds[next] != t.beds[idx]) next++;
			else break;
		}
		if( prev >= 0 && t.beds[prev] == t.beds[idx] && (t.currents[idx] <  t.currents[prev])){ 
			if(log)
			std::cout<<"\t\t\t\ttangling with prev  " <<idx << " and " << prev << std::endl;
			return false;
		}
		if( next < n_stitches && t.beds[next] == t.beds[idx] && ( t.currents[idx] > t.currents[next])) {
			if(log)
			std::cout<<"\t\t\t\ttangling with next  " <<idx << " and " << next << std::endl;
			return false;
		}
		
		// stacked loops must have the same target
		for(int i = 0; i < n_stitches; i++){
			if( t.currents[i] == t.currents[idx] && t.beds[i] == t.beds[idx] && t.offsets[i] != t.offsets[idx]) {
				if(log)
					std::cout<<"stacked loops " << i << " and " << idx << " have different targets"<<std::endl;
				return false;
			}
		}


		return true;

		// Do not need to do this now that reached checks for correctness
		// Ideally should be useful to prune cases but my head is not working too well right now and I will potentially make a mistake
		// TODO Fix this at some point
		/*
		
		   bool stacked = true;
		   if( firsts[idx] && !ignore_firsts){
		   stacked = false;
		   for(int i = 0; i < n_stitches; i++){
		   if(i!= idx && t.currents[i] == pn && t.beds[i] == pb ) stacked = true;
		   }
		   }

   
		   
		if(!stacked && !ignore_firsts && firsts[idx] && t.beds[idx] == Front_Bed){
			// if transferring _to_ the front bed, the loop that wan'ts to go first
			// has to go first on the stack
			for(int i = 0; i < n_stitches; i++){
				if( i != idx && t.currents[i] == t.currents[idx] && t.beds[i] == t.beds[idx]) {
					if(log)
					std::cout<<"cannot move because index " << i << " has same target and has already been moved to the same needle on the front bed (firsts will fail)"<<std::endl;
					return false;
				}
			}
		}
		// if transferring _to_ the back bed, the loop that wan'ts to go first
		// has to be the last on the stack, so if finally has to be stacked 
		// but nobody has already gone yet that's a problem
		if(!ignore_firsts && firsts[idx] && t.beds[idx] == Back_Bed){
			// find all the indices that have the same target
			int target = idx + offsets[idx];
			for(int i = 0; i < n_stitches; i++){
				if(i != idx && (i + offsets[i] == target) && ( t.currents[i] != t.currents[idx] || t.beds[i] != t.beds[idx])){
					if(log)
					std::cout<<"cannot move "<<idx<<" because index " << i << " has same target and has not yet been moved to the same needle on the back bed (firsts will fail)"<<std::endl;
					return false;
				}
			}
		}


		return true;
		*/
	};

	auto make_signature = [=](const State &s)->Signature{
		auto p = Passes(s.xfers);
		return  std::make_pair( p, s.machine );
	};

	auto Reached = [=](const State &s) ->bool{
	
		assert(Penalty(s) == s.penalty && "penalty is correct.");
		if ( s.penalty > 0 ) {
			return false;
		}
		
		for( int i = 0; i < n_stitches; i++){
			if(s.beds[i] == Back_Bed){
			
				return false;
			}
		}
		for(int i = 0; i < n_stitches; i++){
			auto bn = std::make_pair(s.beds[i], s.currents[i]);
			assert(!s.machine.at(bn).empty() && "machine state consistent with currents");
			
			if(firsts[i] &&  (s.machine.at(bn)[0] != i) ) {
				return false;
			}
		}
		
		return true;
	};
	
	//std::priority_queue< State, std::vector<State>, LessThanByPenalty > PQ;
	std::priority_queue< State, std::vector<State>, LessThanByEstimatedPassesThenPenalty > PQ;
	//std::priority_queue< State, std::vector<State>, LessThanByPenaltyThenPasses > PQ;
	std::vector<State> successes;
	State best_state;
	int best_cost = INT32_MAX;

	State first;
	first.offsets = offsets;
	first.penalty = Penalty(first);
	first.beds.assign(n_stitches, Front_Bed);
	for(int i = 0; i < n_stitches; i++){
		first.currents.push_back(i);
		first.machine[std::make_pair(Front_Bed, i)] = {i};
	}
	
	first.est_passes = LowerBoundFromHere(first);
	PQ.push(first);

	//PQ.push(second);

	// enqueue a bunch of safe states? 
	//
	{
		//State sb = schoolbus(first);
		//sb.est_passes = LowerBoundFromHere(sb);
		//PQ.push(sb);
	}
	// also add a state that puts non-zero offsets on the back-bed 

	if( lower_bound_passes < 0 ){
		std::cout << "No transfers necessary, easy out" << std::endl;
		return true;
	}

	std::set< Signature > visited;
	std::map <  std::map<BN, std::vector<int>>,   int > current_passes_map; // really just inverse sign

	std::cout << "Starting penalty = " << first.penalty << std::endl;	

	while(!PQ.empty()){

		// from this state, generate _all_ possible next states
		// 0 can go from -8 to 8
		auto st  = PQ.top();
		PQ.pop();

		{	
			//std::cout<<"\tState@ "<< st.penalty << "  Passes " << Passes(st.xfers) << " UB " << upper_bound_passes << " LB " << lower_bound_passes  << PrintCurrent(st) << PrintOffsets(st) << std::endl;
		}
		
		auto sgn = make_signature(st);
		
		if( current_passes_map.count( sgn.second ) && current_passes_map[sgn.second] <= sgn.first){
			// reached here at a lower pass count, continue 
			//std::cout<<"\t\tSkipping, reached state at lower pass count." << std::endl;
			continue;
		}
		
		if(visited.count(sgn)) continue;
		visited.insert(sgn);

		current_passes_map[sgn.second]  = sgn.first;

	
		if( Reached(st) ){
			int p = Passes(st.xfers);
			assert( p>= lower_bound_passes && "pass count is not lower than lower bound!");
			std::cout<<"Found a solution that needs " << p  <<" passes."<< std::endl;
			if ( p < best_cost ){
				best_cost = p;
				best_state = st;
			}
			
			successes.push_back(st);
			if( p < upper_bound_passes){
				upper_bound_passes = p;
			}
			if( p == lower_bound_passes){
				std::cout<<"Found lower bound, can't do better so break ( passes = "<< p <<" )" << std::endl;
				break;
			}
		}
		if ( Passes(st.xfers) > upper_bound_passes ) {
		
			//std::cout<<"Skipping because " << Passes(st.xfers) << " > " << upper_bound_passes << " (ub)." << std::endl;
		
			continue; // can do better no?
		
		}

		// what are the actions that can be sucessfully applied to top
		for(int idx = 0; idx < n_stitches; idx++){
			for(int ofs = -n_rack; ofs <= n_rack; ofs++){
				State top = st;
				//std::cout<<"Act on offsets : "<< PrintOffsets(top) << " " << PrintCurrent(top) << PrintMachine(top)<<std::endl;
				BN from = std::make_pair( top.beds[idx],  top.currents[idx]);
				//std::cout << "Working on idx " << idx << " ofs "<< ofs << " from: " << Bed(from)<<Needle(from) <<std::endl;
				if(top.machine.count(from) == 0){
					// let us see what led to this state
					Passes(top.xfers, true);
				}
				assert(top.machine.count(from) != 0 && "from must have loops");
				if( top.machine[from].empty()){
					// don't add this state?
					continue;
				}

				if( okay_to_move_index_by_offset(top, idx, ofs) ){
				
					int prev_offset = top.offsets[idx];
					(void)prev_offset;
					//front-to-back
					//std::cout<<"\t idx = "<<idx<<" "<< top.beds[idx] << top.currents[idx] << " moved to ";
					if(top.beds[idx] == Front_Bed){
						top.offsets[idx] += ofs;
						top.currents[idx] -= ofs;
					}
					else{ //Back-to-front
						top.offsets[idx] -= ofs;
						top.currents[idx] += ofs;
					}
					top.beds[idx] = Opposite(top, idx);
					
					
					//std::cout<<" to-target: "<<top.beds[idx]<<top.currents[idx]<<std::endl;
					BN to = std::make_pair( top.beds[idx],  top.currents[idx]);
			
					auto froms = top.machine[from];
					auto tos = top.machine[to];
					std::reverse(froms.begin(), froms.end());
					for(auto in : froms){
						//if(in != idx){
						//std::cout<<"\t\tidx = "<<idx<<" index " << in << " at from "<<top.beds[in] << top.currents[in] << " moved to target "<<std::endl;
						//}
						top.machine[to].push_back(in);
						assert(in == idx || top.currents[in] == from.second);
						assert(in == idx || top.beds[in] == from.first);
						top.currents[in] = top.currents[idx];
						top.beds[in] = top.beds[idx];
						// if these didn't match this action would not have been possible
						assert(in == idx || top.offsets[in] == prev_offset);
						top.offsets[in] = top.offsets[idx];
					}
					top.xfers.push_back( std::make_pair(from, to));
				//	std::cout<<"\txfer "<<Bed(from)<<Needle(from)<<" -> "<<Bed(to)<<Needle(to)<<std::endl;
				//	Passes(top.xfers , true);

					top.machine[from].clear();
					int already_passes = Passes(top.xfers);
					int atleast_more_passes = LowerBoundFromHere(top) ;
					if( already_passes + atleast_more_passes > upper_bound_passes){
						continue; // well this state can't do better 
					}
					//std::cout<<"\tAfter action " << PrintMachine(top) << PrintCurrent(top) << std::endl;
					top.penalty = Penalty(top);
					top.passes =  already_passes;
					top.est_passes = atleast_more_passes;
					top.rack = ofs;	
					auto s = make_signature(top);
					// if state has been visited, skip it
					if(visited.count(s)) continue;
					if(!visited.count(s)&& ( !current_passes_map.count( s.second ) ||  current_passes_map[s.second] > s.first)){
						// reached here at a lower pass count, continue 
						PQ.push(top); 
					}
				}
			}
		}
	}

	std::cout << "Found " << successes.size() << " potential solutions. " << std::endl;
	for(int i = 0; i < (int)successes.size(); i++){
		std::cout<<"Solution " << i << "\n" << Passes(successes[i].xfers, true) << std::endl;
	}

	// return a string 
	std::ofstream out(outfile);
	for(auto x : best_state.xfers){
		
		out<<Bed(x.first)<<Needle(x.first)<<" "<<Bed(x.second)<<Needle(x.second)<<"\n";

	}
	out.close();
	return true;
}



int main(int argc, char* argv[]){

	if(argc > 1 ){
		n_stitches = atoi( argv[1] );
		std::vector<int> offsets;
		std::vector<int>firsts;
		for(int i = 2; i < 2 + n_stitches; i++){
			offsets.push_back( atoi(argv[i]) );
		}
		for(int i = 2 + n_stitches; i < 2 +2*n_stitches; i++){
			firsts.push_back(atoi(argv[i]) );
		}
		
		return exhaustive(offsets, firsts, argv[2+2*n_stitches]);
	}
	
	if(argc < 2){	
		//n_stitches = 3;
		//exhaustive({1,1,0},{0,0,0});
		n_stitches = 24;	
		//exhaustive( {3,2,1, 1, 2, 1}, {0, 0,1, 0, 0, 0} , "exhmain.xfers");	
	    //exhaustive( {0,-1,-2,-2,-3,-3}, {0, 0, 0, 0, 0,  0}, "exhmain.xfers");
		exhaustive({ 0,0,0,0,0,0,0,0,0,0,1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0}, { 0, 0,0,0,0,0,0,0,0,0,  0,0,1,0, 0,0, 0, 0, 0, 0, 0, 0, 0, 0},"exhmain.xfers");
	
		// *              *
		// 0 -1 -2 -2 -3 -4
		// 0  0  0  1  1  1
		//f0 f1 f2 f3 f4 f5
	
	}

	return 0;

}

