#ifndef ERROR_HPP
#define ERROR_HPP

#include <string>
#include "Dk/Chronometre.hpp"

class ErrorMsg {
public:
	ErrorMsg() : 
		connection(false), 
		device0(false), 
		device1(false), 
		server0(false), 
		server1(false), 
		date(Chronometre::date()) {
	};
	
	bool hasError () const {
		return connection || device0 || device1 || server0 || server1;
	}
	
	const std::string toString() const {
		return 
			"Error : ["+date+"] { \n "
			" \t - connection:\t" +(connection?+"Fail":"Ok") + "\t | \n"
			" \t - device0:\t"	  +(device0?+"Fail":"Ok") 	 + "\t | \n"
			" \t - device1:\t"	  +(device1?+"Fail":"Ok") 	 + "\t | \n"
			" \t - server0:\t"	  +(server0?+"Fail":"Ok") 	 + "\t | \n"
			" \t - server1:\t"	  +(server1?+"Fail":"Ok") 	 + "\t | \n"
			"} ";
	}
	
	bool connection;
	bool device0;
	bool device1;
	bool server0;
	bool server1;
	std::string date;
};

#endif
