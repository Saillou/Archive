#include <iostream>
#include <fstream>
#include <csignal>
#include <atomic>

#include <sys/types.h>
#include <sys/stat.h>

#include "Globals/structures.hpp"
#include "Dk/Chronometre.hpp"
#include "Dk/ManagerConnection.hpp"
#include "Dk/VideoStreamWriter.hpp"
#include "Device/DeviceMT.hpp"
#include "Tool/MovieWriter.hpp"
#include "Tool/ConfigParser.hpp"
#include "GPIO/ManagerGpio.hpp"
#include "GPIO/Gpio.hpp"
#include "ErrorMsg.hpp"

//  --------------------- Variables ------------------------------------
// -- Controle
std::atomic<bool> G_ready(false);
std::atomic<bool> G_stop(false);
std::atomic<bool> G_shutdown(false);
std::atomic<bool> G_recording(false);
std::atomic<bool> G_updateLed(true);

std::atomic<bool> G_countLong(false);
std::atomic<int> G_count(0);

ConfigParser::Result G_config;
Chronometre G_chronoRecording;

std::string G_experimentFolder(""); // without (id) in the path ../root/[..](id)/name.ext
std::string G_experimentFolderPath("");
std::vector<char> G_calibrationKey;


// -- Tools
DeviceMT* device0;
DeviceMT* device1;

MovieWriter* movieWriter0;
MovieWriter* movieWriter1;

Dk::VideoStreamWriter* videoStreamer0;	
Dk::VideoStreamWriter* videoStreamer1;


// ------------------------ Functions ----------------------------------
static bool dirExists(const std::string& path) {
	struct stat info;
	
	if(stat(path.c_str(), &info) != 0)
		return false;
	
	if(info.st_mode & S_IFDIR)
		return true;
		
	return false;
}
static bool createDir(const std::string& path) {
	return mkdir(path.c_str(), S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH) != -1;
}

static void displayHelp () {
	std::cout << " ==================== H E L P =================== " << std::endl;
	std::cout << "Available options: " << std::endl;
	std::cout << "\t -noCamera0 \t// Disable camera 0." << std::endl;   
	std::cout << "\t -noCamera1 \t// Disable camera 1." << std::endl;   
	std::cout << "\t -noStream  \t// Disable streaming." << std::endl;   
	std::cout << " ================================================ " << std::endl;
}
static bool existsOption(int argc, char* argv[], const std::string& option) {
	for(int i = 1; i < argc; i++) {
		if(std::string(argv[i]) == option)
			return true;
	}
	return false;
}

static void writeCalibrationKey(const std::string& path) {
	if(!dirExists(path)) {
		if(!createDir(path)) {
			std::cout << "Failed to created dir for calibration" << std::endl;
			return;
		}
	}
	
	std::ofstream fileCalib;
	fileCalib.open(path.c_str(), std::ios::binary | std::ios::trunc);
	fileCalib.write(G_calibrationKey.data(), G_calibrationKey.size());
	fileCalib.close();	
}
static void onCalibration(int idClient, const Protocole::BinMessage& msg) {
	std::cout << "Calibration received." << std::endl;
	
	if(msg.getSize() > 0)
		G_calibrationKey = msg.getData();
		
	// If record has already started:
	if(dirExists(G_experimentFolderPath)) {
		if(!G_calibrationKey.empty())
			writeCalibrationKey(G_experimentFolderPath+"/Calibration.bin");
	}
	
}

static void onRecordStart() {
	// Search id of folder
	static int id = 0;
	do {
		G_experimentFolderPath = G_experimentFolder + "("+std::to_string(id)+")";
		id++;
	} while(dirExists(G_experimentFolderPath));
	
	
	// Create it
	if(!createDir(G_experimentFolderPath)) {
		std::cout << "Failed to created directory" << std::endl;
		return;
	}
	
	// Start recording and write calibration key (if already computed)
	G_recording = true;
	
	if(!G_calibrationKey.empty())
		writeCalibrationKey(G_experimentFolderPath+"/Calibration.bin");
		
	if(device0->isOpen() && !movieWriter0->isRecording())
		movieWriter0->start(G_experimentFolderPath+"/Video0", device0->getSize(), device0->getFps());
		
	if(device1->isOpen() && !movieWriter1->isRecording())
		movieWriter1->start(G_experimentFolderPath+"/Video1", device1->getSize(), device1->getFps());
		
	G_chronoRecording.beg();
}
static void onRecordStop() {
	if(movieWriter0->isRecording())
		movieWriter0->stop();
		
	if(movieWriter1->isRecording())
		movieWriter1->stop();
		
	G_recording = false;
}
static void onStop() {
	G_stop = true;
}

static ErrorMsg checkErrors(bool enableStream = true, bool enableCamera0= true, bool enableCamera1 = true) {
	ErrorMsg err;
	
	// Check wifi creation
	if(enableStream) 
		if(ManagerConnection::getGatewayAdress(IpAdress::IP_V6) == IpAdress::localhost(IpAdress::IP_V6))
			err.connection = true;
	
	// Check camera opening
	if(enableCamera0)
		if(device0 == nullptr || !device0->isOpen())
			err.device0 = true;
	
	if(enableCamera1)
		if(device1 == nullptr || !device1->isOpen())
			err.device1 = true;
			
	// Check stream
	if(enableCamera0 && enableStream)
		if(videoStreamer0 == nullptr || !videoStreamer0->isValide())
			err.server0 = true;
	
	if(enableCamera1 && enableStream)
		if(videoStreamer1 == nullptr || !videoStreamer1->isValide())
			err.server1 = true;
			
	// Seems good to me
	return err;
}

// -------------------------- Signals ----------------------------------
static void signalHandler(int signum) {
	std::cout << "\nInterrupt" << std::endl;
	onStop();
	G_shutdown = true;
}

static void onBtnRec(const int idGpio, const Gpio::Level level, const Gpio::Event event) {
	// Switch mode
	if(event == Gpio::Falling) {
		if(!G_recording)
			onRecordStart();
	}
	else if(event == Gpio::Rising) {
		if(G_recording)
			onRecordStop();
	}
	G_updateLed = true;
}
static void onBtnShut(const int idGpio, const Gpio::Level level, const Gpio::Event event) {
	if(!G_ready)
		return;
		
	// Bounce
	Chronometre::wait(10);
	
	// Switch mode
	if(event == Gpio::Falling) {
		G_countLong = true;
		G_count = 0;
	}
	else if(event == Gpio::Rising) {
		G_countLong = false;
		G_count = 0;
		if(G_stop)
			G_shutdown = true;
	}
}


// ---------------------------------------------------------------------
// ----------------------------- Main ----------------------------------
// ---------------------------------------------------------------------
int main(int argc, char* argv[]) {
	// -------------------- Options and Configuration ------------------	
	if(existsOption(argc, argv, "-help")) {
		displayHelp();
		return 0;
	}
	bool enableCamera0 = !existsOption(argc, argv, "-noCamera0");
	bool enableCamera1 = !existsOption(argc, argv, "-noCamera1");
	bool enableStream  = !existsOption(argc, argv, "-noStream");
	
	const std::string HERE = "/home/Development/archive";
	G_config = ConfigParser::parse(HERE+"/BarnaclesManager/config");
	G_experimentFolder = HERE+"/BarnaclesManager/root"+G_config["defaultPath"].toString() + Chronometre::date();
	
	
	// ---------------------- Interface externs ------------------------
	signal(SIGINT, signalHandler);
	system("nodejs /home/Development/archive/BarnaclesManager/server.js &");
		
	// -------------------------- Devices ------------------------------	
	device0 = new DeviceMT("/dev/video0");
	device1 = new DeviceMT("/dev/video2");

	if(enableCamera0) {
		device0->open();
	}
		
	if(enableCamera1) {
		device1->open();
	}
	
	// Gpio
	Gpio gLedRec(100, Gpio::Output); 	// Rock64 = 15 (GPIO3_A4)
	Gpio gBtnRec(101, Gpio::Input);		// Rock64 = 16 (GPIO3_A5)
	Gpio gLedShut(102, Gpio::Output);  	// Rock64 = 18 (GPIO3_A6)
	Gpio gBtnShut(103, Gpio::Input);   	// Rock64 = 22 (GPIO3_A7)
	Gpio gNpn(81, Gpio::Output);  		// Rock64 = 3  (GPIO2_C1)
	gNpn.setValue(Gpio::High);
	
	ManagerGpio manager;
	manager.addEventListener(gBtnRec, Gpio::Both, onBtnRec);
	manager.addEventListener(gBtnShut, Gpio::Both, onBtnShut);
	manager.startListening();
	
	// ------------------------- Video Streamer ------------------------
	ManagerConnection managerConnection;
	managerConnection.initialize();
	
	IpAdress ip0(managerConnection.getGatewayAdress(IpAdress::IP_V6).getTarget(), 3000); 
	IpAdress ip1(managerConnection.getGatewayAdress(IpAdress::IP_V6).getTarget(), 3001); 
	
	videoStreamer0 = new Dk::VideoStreamWriter(managerConnection, ip0, G_config["deviceName"].toString() + " - 0");	
	videoStreamer1 = new Dk::VideoStreamWriter(managerConnection, ip1, G_config["deviceName"].toString() + " - 1");
	
	
	if(device0->isOpen() && enableStream) {
		videoStreamer0->startBroadcast(device0->getSize(), 3);
		videoStreamer0->addCallback(Protocole::BIN_CLBT, onCalibration);
	}
		
	if(device1->isOpen() && enableStream) 
		videoStreamer1->startBroadcast(device1->getSize(), 3);
	
	// -------------------------- Video Recorder -----------------------	
	movieWriter0 = new MovieWriter();
	movieWriter1 = new MovieWriter();
		

	// --------------------------- Looping -----------------------------
	const int fps(std::max(device0->getFps(), device1->getFps()));
	Chronometre chronoRoutine;
	Gb::Frame frame0;
	Gb::Frame frame1;
	
	if(G_config["recording"].toBool())
		onRecordStart();
	
	bool splitRecord = G_config["splitting"].toBool();
	const int64_t NB_MS_MAX = 30*60*1000; // 30mn in milliseconds
	
	G_ready = true;
	gLedShut.setValue(Gpio::High);
	while(!G_stop) {		
		chronoRoutine.beg();
		
		// Check errors
		ErrorMsg errors = checkErrors(enableStream, enableCamera0, enableCamera1);
		if(errors.hasError()) {
			// Make the leds blink (ledRec faster if still recording)
			static int iLed = 1;
			const int nLed = G_recording ? 3 : 10;
			if(iLed % nLed == 0) {
				gLedRec.setValue(gLedRec.readValue() == Gpio::High ? Gpio::Low : Gpio::High);
			}
			if(iLed % 10 == 0) {
				gLedShut.setValue(gLedShut.readValue() == Gpio::High ? Gpio::Low : Gpio::High);
				iLed = 0;
			}
			iLed++;
			
			std::cout << errors.toString() << std::endl;
		}
		else if(G_updateLed) {
			gLedRec.setValue(G_recording ? Gpio::High : Gpio::Low);
			G_updateLed = false;
		}	
		
		// Shutting down
		if(G_countLong) {
			G_count++;
			if(G_count > 20)
				G_stop = true;
		}
		
		// Split recording if necessary
		if(G_recording && splitRecord) {
			if(G_chronoRecording.elapsed_ms() > NB_MS_MAX) {
				onRecordStop();
				onRecordStart();
			}
		}
		
		// - Read device 0
		if(device0->isOpen()) {
			device0->read(frame0);
			
			if(!frame0.empty()) {
				// - TCP
				if(videoStreamer0->isValide())
					videoStreamer0->update(frame0);	
					
				// - Recording
				if(movieWriter0->isRecording())
					movieWriter0->saveFrame(frame0);	
			}
		}
		
		// - Read device 1
		if(device1->isOpen()) {
			device1->read(frame1);
			
			if(!frame1.empty()) {
				// - TCP
				if(videoStreamer1->isValide())
					videoStreamer1->update(frame1);	
					
				// - Recording
				if(movieWriter1->isRecording())
					movieWriter1->saveFrame(frame1);	
			}
		}
		
		// Wait 'till it's time again		
		chronoRoutine.end();
		Chronometre::wait((int64_t)(1000/fps) - chronoRoutine.ms());
	}
	
	

	// -------------------------- The end -------------------------------------
	gLedRec.setValue(Gpio::Low);
	
	if(device0->isOpen())
		device0->close();
	if(movieWriter0->isRecording())
		movieWriter0->stop();
	if(videoStreamer0->isValide())
		videoStreamer0->release();
	
	if(device1->isOpen())
		device1->close();
	if(movieWriter1->isRecording())
		movieWriter1->stop();
	if(videoStreamer1->isValide())
		videoStreamer1->release();
		
	delete device0;
	delete movieWriter0;
	delete videoStreamer0;
	
	delete device1;
	delete movieWriter1;
	delete videoStreamer1;
	
	std::cout << std::endl << "Exit success" << std::endl;
	
	// Waiting for shutting down
	while(!G_shutdown) {
		Chronometre::wait(100);
		gLedShut.setValue(Gpio::High);
		Chronometre::wait(100);
		gLedShut.setValue(Gpio::Low);
	}
	
	gNpn.setValue(Gpio::Low);
	std::cout << "Shutting down" << std::endl;
	system("shutdown -h now");
	return 0;
}
