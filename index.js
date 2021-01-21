"use strict";

var Accessory, Service, Characteristic, UUIDGen, HAPServer;
var accessories = [];
var accessoriesSound = [];
const { spawn } = require('child_process');
const fs = require('fs');

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  HAPServer = homebridge.hap.HAPServer;
  homebridge.registerPlatform("homebridge-sound-button", "SwitchSound", SwitchSoundPlatform);
}

function SwitchSoundPlatform(log, config, api) {
  this.log = log;
  this.cache_timeout = 10; // seconds
  this.refresh = config['refresh'] || 10; // Update every 10 seconds
  this.debug = config.debug || false;
  this.debugMarkerPrefix = config.debugMarkerPrefix || 'OUTLINE DEBUG: [ ';
  this.debugMarkerEnd = config.debugMarkerEnd || ' ]';
  this.log.prefix = 'SwitchSound';
  this.defaultSoundPlayer = config.defaultSoundPlayer || '';
  this.configAccessories = (config.accessories !== undefined && config.accessories.constructor === Array) ? config.accessories : [];

  if (api) {
    this.api = api;
    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }
}

SwitchSoundPlatform.prototype.didFinishLaunching = function() {
  this.outline('Finished launching, didFinishLaunching called', false);
  this.loadSoundAccesories(function() {
    this.outline('Sound Accessories Loaded!', false);
  }.bind(this));
};



SwitchSoundPlatform.prototype.loadSoundAccesories = function(callback) {
  this.outline('Loading accessories from config', false);
  var alength = this.configAccessories.length;
  for(var i = 0; i < alength; i++) {
    if(!accessories[this.configAccessories[i].id]) {
      this.log('New Accessory ' + i + ' Adding');
      this.addAccessory(this.configAccessories[i]);
    }
    if(i === (alength - 1)) {
      callback();
    }
  }
};


SwitchSoundPlatform.prototype.configureAccessory = function(accessory) {
  var accessoryId = accessory.context.id;
  var found = false;
  var alength = this.configAccessories.length;
  for(var i = 0; i < alength; i++) {
    if(this.configAccessories[i].id === accessory.context.id) {
      this.outline('FOUND ACCESSORY: ' + accessoryId + ' Name: ' + accessory.context.name, false);
      var found = true;
      var data = this.configAccessories[i];
    }
  }

  if(found) {
    this.log('Updating accessory to new config options: ' +  accessoryId + 'Name: ' + data.name);
    accessory.context.name = data.name;
    accessory.context.id = data.id;
    accessory.context.isPlaying = false;
    accessory.context.soundFile = data.soundFile;
    accessory.context.soundOptions = data.soundOptions || [];
    accessory.context.volume = data.volume || 100;
    accessory.context.loop = data.loop || false;
    accessory.context.shuffle = data.shuffle || false;
    accessory.context.debug = data.debug || false;
    accessory.context.soundFileTemp = "";
    accessory.context.sequence = data.sequence || false;

    if(data.soundPlayer !== undefined) {
      accessory.context.soundPlayer = data.soundPlayer;
    } else {
      accessory.context.soundPlayer = '';
    }

    this.setService(accessory);
    accessories[accessoryId] = accessory;
  } else {
    this.log("REMOVE Accessory Missing from Config: " + accessoryId + ' Name: ' + accessory.context.name);
    this.removeAccessory(accessory);
  }
};



SwitchSoundPlatform.prototype.addAccessory = function(data) {

  if (!accessories[data.id]) {
    this.log('Adding accessory ' + data.name);

    var uuid = UUIDGen.generate(data.id);

    var accessory = new Accessory(data.name, uuid, 8);

    accessory.context.name = data.name;
    accessory.context.id = data.id;
    accessory.context.isPlaying = false;
    accessory.context.soundFile = data.soundFile;
    accessory.context.soundOptions = data.soundOptions || [];
    accessory.context.volume = data.volume || 100;
    accessory.context.loop = data.loop || false;
    accessory.context.shuffle = data.shuffle || false;
    accessory.context.debug = data.debug || false;
    accessory.context.soundFileTemp = "";
    accessory.context.sequence = data.sequence || false;

    if(data.soundPlayer !== undefined) {
      accessory.context.soundPlayer = data.soundPlayer;
    } else {
      accessory.context.soundPlayer = '';
    }

    accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, "SwitchSound - hackerdm")
      .setCharacteristic(Characteristic.Model, "SwitchSound - GM800L")
      .setCharacteristic(Characteristic.SerialNumber, accessory.context.id)
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version);

    this.setService(accessory);

    this.api.registerPlatformAccessories("homebridge-switchsound", "SwitchSound", [accessory]);
    accessories[data.id] = accessory;
  }

};

SwitchSoundPlatform.prototype.setPowerState = function(currentSwitch, powerState, callback) {

  var  _playerSoundOptions = [];

  if(powerState === true) {

    if (currentSwitch.sequence || !accessoriesSound[currentSwitch.id]){

      if (currentSwitch.shuffle){
        currentSwitch.soundFileTemp = currentSwitch.soundFile;
        var files = fs.readdirSync(currentSwitch.soundFileTemp);
          const random = Math.floor(Math.random() * files.length);
          currentSwitch.soundFileTemp = currentSwitch.soundFile + files[random];
      }else{
          currentSwitch.soundFileTemp = currentSwitch.soundFile;
      }

      this.log('Playing Sound.... ' + currentSwitch.soundFileTemp);

      var currentObj = accessories[currentSwitch.id];
      var currentValue = true;
      if (currentObj){
      	currentValue = currentObj.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).value;
      }

      var volumeTmp;
      if (currentValue){
        if(currentSwitch.volume !== undefined && currentSwitch.volume !== '') {

      	  if (currentSwitch.volume > 0){
        	volumeTmp = 100-currentSwitch.volume;
      		volumeTmp = Math.floor((volumeTmp * 4000) / 100);
    	  }else{
    	    volumeTmp = 60000;
    	  }
        }
  	  }else{
  	  	volumeTmp = 60000;
  	  }

      var tmpVolArr = ["-o", "local", "--vol", -volumeTmp];
      _playerSoundOptions = _playerSoundOptions.concat(tmpVolArr); // spawn changes this.

      if(currentSwitch.soundOptions.length > 0) {
        _playerSoundOptions = _playerSoundOptions.concat(currentSwitch.soundOptions); // spawn changes this.
      }

      if(currentSwitch.soundFileTemp) {
        _playerSoundOptions = _playerSoundOptions.concat([currentSwitch.soundFileTemp]); // spawn changes this.
      }

      if (currentSwitch.loop){
        _playerSoundOptions = _playerSoundOptions.concat(["--loop"]); // spawn changes this.
      }

      var playerSoundPlayer = this.defaultSoundPlayer;

      if(currentSwitch.soundPlayer !== undefined && currentSwitch.soundPlayer !== '') {
        playerSoundPlayer = currentSwitch.soundPlayer;
      }

      currentSwitch.isPlaying = true;

      currentSwitch.playProcess = new spawn(playerSoundPlayer, _playerSoundOptions);

      if (!currentSwitch.sequence){
        accessoriesSound[currentSwitch.id] = currentSwitch.id;
      }

      this.outline('Sound Player: ' + playerSoundPlayer, currentSwitch.debug);
      this.outline('Player Options: ' + _playerSoundOptions, currentSwitch.debug);
      this.outline('Player File: ' + currentSwitch.soundFileTemp, currentSwitch.debug);
      this.outline('Player Command: ' + playerSoundPlayer + ' ' +  _playerSoundOptions, currentSwitch.debug);

      this.outline('Launching PID .... ' + currentSwitch.playProcess.pid, currentSwitch.debug);

      this.outline(JSON.stringify(currentSwitch.playProcess.spawnargs, null, 4), currentSwitch.debug);


      currentSwitch.playProcess.stdout.on('data', (data) => {
        this.outline('stdout: ${data}', currentSwitch.debug);
      });

      currentSwitch.playProcess.stderr.on('data', (data) => {
        this.outline('stderr: ${data}', currentSwitch.debug);
      });

      currentSwitch.playProcess.on('close', (code) => {
        // Turn Switch off after completion.
        var accessory = accessories[currentSwitch.id];
        var volumeOne = parseInt(currentSwitch.volume, 10);
        accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(false);
        if (!currentSwitch.sequence){
          delete accessoriesSound[currentSwitch.id];
        }
        delete currentSwitch.playProcess;
        currentSwitch.playProcess = null; // If not...
        currentSwitch.isPlaying = false;
      });

    }

    callback();

  } else {

    currentSwitch.isPlaying = false;

    if(currentSwitch.playProcess) {

      this.log('Stopping Sound.... ' + currentSwitch.soundFileTemp);
      if (!currentSwitch.sequence){
        delete accessoriesSound[currentSwitch.id];
      }

      this.outline('Kill State .... ' + currentSwitch.playProcess.killed, currentSwitch.debug);
      this.outline('Exit Code .... ' + currentSwitch.playProcess.exitCode, currentSwitch.debug);

      if(currentSwitch.playProcess.killed === false) {
        // currentSwitch.playProcess.kill('SIGHUP');
        // currentSwitch.playProcess.kill('SIGINT');
        currentSwitch.playProcess.kill('SIGTERM');

        this.outline('Killing PID .... ' + currentSwitch.playProcess.pid, currentSwitch.debug);
        this.outline('Kill State .... ' + currentSwitch.playProcess.killed, currentSwitch.debug);
        this.outline('Exit Code .... ' + currentSwitch.playProcess.exitCode, currentSwitch.debug);

        currentSwitch.playProcess = null;
        callback();
        return;
      }

      if(currentSwitch.playProcess.killed !== 1 && currentSwitch.playProcess.exitCode === 0) {
        this.outline('Exit Kill PID .... ' + currentSwitch.playProcess.pid, currentSwitch.debug);

        // currentSwitch.playProcess.kill('SIGHUP');
        // currentSwitch.playProcess.kill('SIGINT');
        currentSwitch.playProcess.kill('SIGTERM');

        this.outline('Kill State .... ' + currentSwitch.playProcess.killed, currentSwitch.debug);
        this.outline('Exit Code .... ' + currentSwitch.playProcess.exitCode, currentSwitch.debug);

        currentSwitch.playProcess = null;
        callback();
      }
      // delete currentSwitch.playProcess;
    } else {
      callback();
    }
  }

};

SwitchSoundPlatform.prototype.setService = function(accessory) {
  var service = accessory.getService(Service.Lightbulb);
  if (!service){
  	accessory.addService(Service.Switch, accessory.context.name + " Switch");
  	accessory.addService(Service.Lightbulb, accessory.context.name + " Volume");
  }

  var volumeOne;
  var currentValue = accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).value;
  if (currentValue > 0){
  	volumeOne = parseInt(currentValue, 10);
  }else{
  	volumeOne = parseInt(accessory.context.volume, 10);
  }

  accessory.context.volume = ""+volumeOne;

  accessory.getService(Service.Switch)
    .getCharacteristic(Characteristic.On)
    .on('set', this.setPowerState.bind(this, accessory.context));
  accessory.getService(Service.Lightbulb)
    .getCharacteristic(Characteristic.Brightness)
    .updateValue(volumeOne)
    .on('set', this.setVolume.bind(this, accessory.context));

  if (volumeOne > 0){
	  accessory.getService(Service.Lightbulb)
	    .getCharacteristic(Characteristic.On)
	    .updateValue(1);
	  accessory.context.volume = volumeOne;
  }

  accessory.on('identify', this.identify.bind(this, accessory.context));

};

SwitchSoundPlatform.prototype.setVolume = function(currentSwitch, volume, callback) {
  this.outline("setVolume requested for " + currentSwitch.id, currentSwitch.debug);
  if (accessories[currentSwitch.id]) {
  	currentSwitch.volume = volume;
  }

  callback();
};

SwitchSoundPlatform.prototype.identify = function(currentSwitch, paired, callback) {
  this.outline("Identify requested for " + currentSwitch.id, currentSwitch.debug);
  if (accessories[currentSwitch.id]) {

  }

  callback();
};

SwitchSoundPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var id = accessory.context.id;
    this.log("Removing Sound Button: " + accessory.context.name);
    this.api.unregisterPlatformAccessories("homebridge-sound-button", "SwitchSound", [accessory]);
    delete accessories[id];
  }
};

SwitchSoundPlatform.prototype.outline = function(line, currentSwitch) {
  if(this.debug || currentSwitch) {
    this.log(this.debugMarkerPrefix + line + this.debugMarkerEnd);
  }
};
