export class HeartRateTraining {

    constructor(treadmillCommands) {
        this.trainingInterval = null;
        this.enableAdjustSpeed = false;
        this.enableAdjustIncline = false;
        this.heartRates = [];
        this.targetHeartRateMin = 0;
        this.targetHeartRateMax = 0;
        this.speedLimits = { min: 1.0, max: 20.0 };
        this.inclineLimits = { min: 0, max: 15 };
        this.treadmillCommands = treadmillCommands;
        this.currentSpeed = 0;
        this.currentIncline = 0;
        this.tolerance = 5;
        this.smallAdjustment = 0.2;
        this.largeAdjustment = 0.5;
        this.smallTimeout = 5000;
        this.largeTimeout = 10000;
        
        // Ramping control
        this.segmentDuration = 0;
        this.isRamping = false;
        this.rampingInterval = null;
        this.targetSpeed = 0;
        this.targetIncline = 0;
        this.rampStepSize = 0.1;
        this.rampStepInterval = 1000; // 1 second between steps
    }

    handleHeartRateChanged(heartRate) {
        this.heartRates.push(heartRate);
        if (this.heartRates.length > 20) this.heartRates.shift();
    }

    calculateAverageHeartRate() {
        const sum = this.heartRates.reduce((a, b) => a + b, 0);
        return (sum / this.heartRates.length) || 0;
    }

    async adjustTreadmill() {
        if (!this.enableAdjustSpeed && !this.enableAdjustIncline) {
            return;
        }

        const averageHeartRate = this.calculateAverageHeartRate();
        if (averageHeartRate === 0) {
            // No heart rate data yet, try again later
            this.trainingInterval = setTimeout(this.adjustTreadmill.bind(this), this.smallTimeout);
            return;
        }

        const targetCenter = (this.targetHeartRateMin + this.targetHeartRateMax) / 2;
        let newSpeed = this.currentSpeed;
        let newIncline = this.currentIncline;
        let timeout = this.smallTimeout;

        // Determine if we need to increase or decrease intensity
        let needsIncrease = false;
        let needsDecrease = false;
        let isLargeAdjustment = false;

        if (averageHeartRate < this.targetHeartRateMin) {
            needsIncrease = true;
            if (averageHeartRate < this.targetHeartRateMin - this.tolerance) {
                isLargeAdjustment = true;
                timeout = this.largeTimeout;
            }
        } else if (averageHeartRate > this.targetHeartRateMax) {
            needsDecrease = true;
            if (averageHeartRate > this.targetHeartRateMax + this.tolerance) {
                isLargeAdjustment = true;
                timeout = this.largeTimeout;
            }
        }

        // Apply adjustments
        if (needsIncrease || needsDecrease) {
            const adjustment = isLargeAdjustment ? this.largeAdjustment : this.smallAdjustment;
            const multiplier = needsIncrease ? 1 : -1;

            // Prioritize speed adjustments, then incline
            if (this.enableAdjustSpeed) {
                newSpeed += adjustment * multiplier;
                newSpeed = Math.max(this.speedLimits.min, Math.min(newSpeed, this.speedLimits.max));
            } else if (this.enableAdjustIncline) {
                newIncline += (adjustment * 2) * multiplier; // Incline adjustments are typically larger
                newIncline = Math.max(this.inclineLimits.min, Math.min(newIncline, this.inclineLimits.max));
            }

            // Send commands to treadmill
            if (newSpeed !== this.currentSpeed && this.enableAdjustSpeed) {
                await this.treadmillCommands.setSpeed(newSpeed);
                this.currentSpeed = newSpeed;
            }

            if (newIncline !== this.currentIncline && this.enableAdjustIncline) {
                await this.treadmillCommands.setInclination(newIncline);
                this.currentIncline = newIncline;
            }
        }

        this.trainingInterval = setTimeout(this.adjustTreadmill.bind(this), timeout);
    }


    startHFTraining() {
        if (!this.trainingInterval) {
            this.trainingInterval = setTimeout(this.adjustTreadmill.bind(this), 0);
        }
    }

    stopHFTraining() {
        if (this.trainingInterval) {
            clearTimeout(this.trainingInterval);
            this.trainingInterval = null;
        }
    }

    setTargetHeartRateZone(min, max) {
        this.targetHeartRateMin = min;
        this.targetHeartRateMax = max;
    }

    setSpeedLimits(min, max) {
        this.speedLimits.min = min;
        this.speedLimits.max = max;
    }

    setInclineLimits(min, max) {
        this.inclineLimits.min = min;
        this.inclineLimits.max = max;
    }

    setAdjustmentMethods(adjustSpeed, adjustIncline) {
        this.enableAdjustSpeed = adjustSpeed;
        this.enableAdjustIncline = adjustIncline;
    }

    setCurrentSpeed(speed) {
        this.currentSpeed = speed;
    }

    setCurrentIncline(incline) {
        this.currentIncline = incline;
    }

    setSegmentDuration(duration) {
        this.segmentDuration = duration;
        
        // Adjust ramping parameters based on segment duration
        if (duration < 120) { // Short segments (< 2 minutes) - intervals
            this.smallAdjustment = 0.3;
            this.largeAdjustment = 0.6;
            this.smallTimeout = 3000;
            this.largeTimeout = 6000;
            this.rampStepSize = 0.2;
            this.rampStepInterval = 500; // Faster ramping for intervals
        } else if (duration < 600) { // Medium segments (2-10 minutes)
            this.smallAdjustment = 0.2;
            this.largeAdjustment = 0.4;
            this.smallTimeout = 5000;
            this.largeTimeout = 8000;
            this.rampStepSize = 0.1;
            this.rampStepInterval = 1000;
        } else { // Long segments (> 10 minutes)
            this.smallAdjustment = 0.1;
            this.largeAdjustment = 0.3;
            this.smallTimeout = 8000;
            this.largeTimeout = 12000;
            this.rampStepSize = 0.05;
            this.rampStepInterval = 2000; // Slower, more gradual ramping
        }
    }

    async rampToTarget(targetSpeed, targetIncline) {
        if (this.isRamping) {
            clearInterval(this.rampingInterval);
        }
        
        this.isRamping = true;
        this.targetSpeed = targetSpeed;
        this.targetIncline = targetIncline;
        
        console.log(`Ramping from ${this.currentSpeed.toFixed(1)} km/h to ${targetSpeed.toFixed(1)} km/h`);
        
        this.rampingInterval = setInterval(async () => {
            let speedReached = false;
            let inclineReached = false;
            
            // Ramp speed
            if (this.enableAdjustSpeed) {
                const speedDiff = this.targetSpeed - this.currentSpeed;
                if (Math.abs(speedDiff) <= this.rampStepSize) {
                    if (this.currentSpeed !== this.targetSpeed) {
                        await this.treadmillCommands.setSpeed(this.targetSpeed);
                        this.currentSpeed = this.targetSpeed;
                    }
                    speedReached = true;
                } else {
                    const step = speedDiff > 0 ? this.rampStepSize : -this.rampStepSize;
                    const newSpeed = Math.max(this.speedLimits.min, 
                                            Math.min(this.speedLimits.max, this.currentSpeed + step));
                    await this.treadmillCommands.setSpeed(newSpeed);
                    this.currentSpeed = newSpeed;
                }
            } else {
                speedReached = true;
            }
            
            // Ramp incline
            if (this.enableAdjustIncline) {
                const inclineDiff = this.targetIncline - this.currentIncline;
                const inclineStepSize = this.rampStepSize * 2; // Incline changes are typically larger
                if (Math.abs(inclineDiff) <= inclineStepSize) {
                    if (this.currentIncline !== this.targetIncline) {
                        await this.treadmillCommands.setInclination(this.targetIncline);
                        this.currentIncline = this.targetIncline;
                    }
                    inclineReached = true;
                } else {
                    const step = inclineDiff > 0 ? inclineStepSize : -inclineStepSize;
                    const newIncline = Math.max(this.inclineLimits.min, 
                                              Math.min(this.inclineLimits.max, this.currentIncline + step));
                    await this.treadmillCommands.setInclination(newIncline);
                    this.currentIncline = newIncline;
                }
            } else {
                inclineReached = true;
            }
            
            // Stop ramping when both targets are reached
            if (speedReached && inclineReached) {
                clearInterval(this.rampingInterval);
                this.isRamping = false;
                console.log(`Ramping complete: ${this.currentSpeed.toFixed(1)} km/h, ${this.currentIncline.toFixed(1)}%`);
            }
        }, this.rampStepInterval);
    }

    stopRamping() {
        if (this.rampingInterval) {
            clearInterval(this.rampingInterval);
            this.rampingInterval = null;
            this.isRamping = false;
        }
    }
}
