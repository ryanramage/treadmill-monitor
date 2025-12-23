const serviceIds = {
    serviceFTMS: 0x1826,
    treadmillData: 0x2acd,
    treadmillControl: 0x2ad9,
    supportedSpeedRange: 0x2ad4,
    supportedInclinationRange: 0x2ad5
}

export class TreadmillControl {

    constructor() {
        this.controlPointCharacteristic = null;
        this.treadmillDataCharacteristic = null;
        this.device = null;
        this.server = null;
        this.service = null;

        this.supportedSpeedRangeCharacteristic = null;
        this.supportedInclinationRangeCharacteristic = null;
        this.currentSpeed = 0;
        this.heartRates = [];

        this.dataHandler = [];
        this.statusChangeHandlers = []; // New handlers for status changes
        this.lastMachineStatus = null; // Track previous status
        this.lastDataTimestamp = null; // Track when we last received data
        this.dataTimeoutTimer = null; // Timer to detect when data stops
        this.dataTimeoutMs = 3000; // 3 seconds without data = stopped
    }

    async sendCommand(command) {
        if (!this.connected()) {
            throw new Error('Treadmill not connected');
        }
        
        if (!this.controlPointCharacteristic) {
            throw new Error('Control point characteristic not available');
        }
        
        try {
            let result = await this.controlPointCharacteristic.writeValueWithResponse(command);
            return result;
        } catch (error) {
            console.error('Fehler beim Senden des Befehls', error);
            throw error;
        }
    }

    addDataHandler(handler) {
        this.dataHandler.push(handler);
    }

    addStatusChangeHandler(handler) {
        this.statusChangeHandlers.push(handler);
    }

    isWebBluetoothEnabled() {
        if (navigator.bluetooth) {
            return true;
        } else {
            ChromeSamples.setStatus('Web Bluetooth API is not available.\n' +
                'Please make sure the "Experimental Web Platform features" flag is enabled.');
            return false;
        }
    }

    async connect() {
        this.device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [serviceIds.serviceFTMS] }]
        });

        this.server = await this.device.gatt.connect();
        this.service = await this.server.getPrimaryService(serviceIds.serviceFTMS);

        this.treadmillDataCharacteristic = await this.service.getCharacteristic(serviceIds.treadmillData);
        await this.treadmillDataCharacteristic.startNotifications();
        this.treadmillDataCharacteristic.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

        this.controlPointCharacteristic = await this.service.getCharacteristic(serviceIds.treadmillControl);
        //await controlPointCharacteristic.startNotifications();
        //controlPointCharacteristic.addEventListener('characteristicvaluechanged', logValue);

        this.supportedSpeedRangeCharacteristic = await this.service.getCharacteristic(serviceIds.supportedSpeedRange);
        this.supportedInclinationRangeCharacteristic = await this.service.getCharacteristic(serviceIds.supportedInclinationRange);
    }

    disconnect() {
        if (this.connected()) {
            this.device.gatt.disconnect();
            this.device = null;
        }
    }

    connected() {
        return this.device && this.device.gatt.connected;
    }

    isSpeedStable() {
        if (this.speedHistory.length < 3) return false;
        
        const recent = this.speedHistory.slice(-3);
        const speeds = recent.map(h => h.speed);
        const maxDiff = Math.max(...speeds) - Math.min(...speeds);
        
        return maxDiff < 0.2; // Speed is stable if variation is less than 0.2 km/h
    }

    hasRecentSpeedDrop() {
        if (this.speedHistory.length < 5) return false;
        
        const recent = this.speedHistory.slice(-5);
        const firstSpeed = recent[0].speed;
        const lastSpeed = recent[recent.length - 1].speed;
        
        // Detect if speed dropped by more than 1 km/h in recent readings
        return (firstSpeed - lastSpeed) > 1.0;
    }

    handleDataTimeout() {
        console.log('FTMS Data timeout - treadmill likely stopped');
        
        // Only trigger if we were previously running
        if (this.lastMachineStatus === 'running' || this.lastMachineStatus === 'stopping') {
            this.statusChangeHandlers.forEach(handler => {
                handler({
                    previousStatus: this.lastMachineStatus,
                    currentStatus: 'stopped',
                    speed: 0,
                    flags: 0,
                    speedHistory: [...this.speedHistory],
                    timestamp: Date.now(),
                    reason: 'data_timeout'
                });
            });
            
            this.lastMachineStatus = 'stopped';
        }
    }

    disconnect() {
        // Clear timeout timer when disconnecting
        if (this.dataTimeoutTimer) {
            clearTimeout(this.dataTimeoutTimer);
            this.dataTimeoutTimer = null;
        }
        
        if (this.connected()) {
            this.device.gatt.disconnect();
            this.device = null;
        }
    }

    handleNotifications(event) {
        let value = event.target.value;
        var flags = value.getUint16(0, /*littleEndian=*/true);
        // 2octets for flags, 2octets for instant speed, nextPosition is incremented following the number of octets for each value
        var nextPosition = 4;

        let posAvgSpeed = undefined;
        let posTotDistance = undefined;
        let posInclination = undefined;
        let posElevGain = undefined;
        let posInsPace = undefined;
        let posAvgPace = undefined;
        let posKcal = undefined;
        let posHR = undefined;
        let posMET = undefined;
        let posElapsedTime = undefined;
        let posRemainTime = undefined;
        let posForceBelt = undefined;

        if ((flags & (1 << 1)) != 0) { posAvgSpeed = nextPosition; nextPosition += 2; }
        if ((flags & (1 << 2)) != 0) { posTotDistance = nextPosition; nextPosition += 3; }//4
        if ((flags & (1 << 3)) != 0) { posInclination = nextPosition; nextPosition += 4; }//8
        if ((flags & (1 << 4)) != 0) { posElevGain = nextPosition; nextPosition += 4; }
        if ((flags & (1 << 5)) != 0) { posInsPace = nextPosition; nextPosition += 1; }
        if ((flags & (1 << 6)) != 0) { posAvgPace = nextPosition; nextPosition += 1; }
        if ((flags & (1 << 7)) != 0) { posKcal = nextPosition; nextPosition += 5; }
        if ((flags & (1 << 8)) != 0) { posHR = nextPosition; nextPosition += 1; }
        if ((flags & (1 << 9)) != 0) { posMET = nextPosition; nextPosition += 1; }
        if ((flags & (1 << 10)) != 0) { posElapsedTime = nextPosition; nextPosition += 2; }
        if ((flags & (1 << 11)) != 0) { posRemainTime = nextPosition; nextPosition += 2; }
        if ((flags & (1 << 12)) != 0) { posForceBelt = nextPosition; nextPosition += 4; }

        const result = new TreadmillData();

        // instantaneous speed
        const speed = value.getUint16(2, /*littleEndian=*/true) / 100;
        result.speed = speed;

        //distance
        let distance = value.getUint16(posTotDistance, /*littleEndian=*/true);

        let distance_complement = value.getUint8(posTotDistance + 2, /*littleEndian=*/true);
        distance_complement = distance_complement << 16;
        distance = distance + distance_complement;
        result.totalDistance = distance;

        if (typeof posInclination != "undefined") {
            const inclination = value.getInt16(posInclination, /*littleEndian=*/true) / 10;
            result.inclination = inclination;
        }

        if (typeof posKcal != "undefined") {
            const kcal = (value.getUint16(posKcal, /*littleEndian=*/true));
            result.kcal = kcal;
        }

        if (typeof posHR != "undefined") {
            const hr = (value.getUint8(posHR, /*littleEndian=*/true));
            result.hr = hr;
        }

        if (typeof posElapsedTime != "undefined") {
            const elapsedTime = (value.getUint16(posElapsedTime, /*littleEndian=*/true));
            result.elapsedTime = elapsedTime;
        }

        // Update last data timestamp
        this.lastDataTimestamp = Date.now();
        
        // Clear any existing timeout timer since we got data
        if (this.dataTimeoutTimer) {
            clearTimeout(this.dataTimeoutTimer);
            this.dataTimeoutTimer = null;
        }
        
        // Set up timeout to detect when data stops coming
        this.dataTimeoutTimer = setTimeout(() => {
            this.handleDataTimeout();
        }, this.dataTimeoutMs);
        
        // Enhanced status detection for manual mode treadmills
        let machineStatus = 'unknown';
        
        // Store speed history for better detection
        if (!this.speedHistory) {
            this.speedHistory = [];
        }
        
        this.speedHistory.push({
            speed: speed,
            timestamp: Date.now()
        });
        
        // Keep only last 10 readings (about 10 seconds of data)
        if (this.speedHistory.length > 10) {
            this.speedHistory.shift();
        }
        
        // Check various status indicators - lowered threshold for treadmill startup
        const isSpeedZero = speed <= 0.1;
        const isSpeedVeryLow = speed > 0.1 && speed <= 1.5; // Detect startup speed
        const isSpeedStable = this.isSpeedStable();
        const hasRecentSpeedDrop = this.hasRecentSpeedDrop();
        
        // Additional FTMS flags to check
        const targetSettingStatus = (flags & (1 << 14)) !== 0;
        const machineStatusFlag = (flags & (1 << 13)) !== 0;
        
        // Determine status based on multiple factors with hysteresis to prevent jitter
        if (isSpeedZero) {
            machineStatus = 'stopped';
        } else if (this.lastMachineStatus === 'stopped' && speed > 0.1) {
            // Treadmill starting up from stopped state - any speed > 0.1 means running
            machineStatus = 'running';
        } else if (this.lastMachineStatus === 'running' && speed > 0.5) {
            // Stay running if we were running and speed is reasonable
            machineStatus = 'running';
        } else if (this.lastMachineStatus === 'running' && hasRecentSpeedDrop && speed < 1.0) {
            // Only go to stopping if we were running, had a speed drop, and are now very slow
            machineStatus = 'stopping';
        } else if (this.lastMachineStatus === 'stopping' && speed < 0.5) {
            // From stopping to stopped only when very slow
            machineStatus = 'stopped';
        } else if (speed > 0.1) {
            // Default to running for any reasonable speed
            machineStatus = 'running';
        } else {
            // Keep previous status if unclear
            machineStatus = this.lastMachineStatus || 'unknown';
        }
        
        result.machineStatus = machineStatus;
        result.flags = flags; // Include flags for debugging

        // Log all FTMS events to devtools
        console.log('FTMS Data:', {
            speed: speed,
            flags: flags.toString(2).padStart(16, '0'),
            machineStatus: machineStatus,
            machineStatusFlag: machineStatusFlag,
            targetSettingStatus: targetSettingStatus,
            isSpeedZero: isSpeedZero,
            isSpeedVeryLow: isSpeedVeryLow,
            hasRecentSpeedDrop: hasRecentSpeedDrop,
            lastStatus: this.lastMachineStatus,
            speedHistory: this.speedHistory.slice(-3), // Last 3 readings
            rawData: Array.from(new Uint8Array(value.buffer))
        });

        // Check for status changes and notify handlers
        if (this.lastMachineStatus !== null && this.lastMachineStatus !== machineStatus) {
            this.statusChangeHandlers.forEach(handler => {
                handler({
                    previousStatus: this.lastMachineStatus,
                    currentStatus: machineStatus,
                    speed: speed,
                    flags: flags,
                    speedHistory: [...this.speedHistory],
                    timestamp: Date.now()
                });
            });
        }
        this.lastMachineStatus = machineStatus;

        this.dataHandler.forEach(cb => cb(result));
    }
}


export class TreadmillData {
    constructor() {
        this.speed = undefined;
        this.avgSpeed = undefined;
        this.totalDistance = undefined;
        this.inclination = undefined;
        this.elevationGain = undefined;
        this.insPace = undefined;
        this.avgPace = undefined;
        this.kcal = undefined;
        this.hr = undefined;
        this.met = undefined;
        this.elapsedTime = undefined;
        this.remainingTime = undefined;
        this.forceBelt = undefined;
        this.machineStatus = undefined; // New field for machine status
    }
}

