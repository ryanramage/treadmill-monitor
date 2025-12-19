import { HrMonitor } from "./HrMonitor.js";
import { TreadmillControl , TreadmillData} from "./TreadmillControl.js";
import { TreadmillCommands } from "./TreadmillCommands.js";
import { HeartRateTraining } from "./HeartRateTraining.js";
import { Workout, Segment } from "./Workout.js";
import { WorkoutParser } from "./WorkoutParser.js";

let monitor = new HrMonitor();
let treadmillControl = new TreadmillControl();
let treadmillCommands = new TreadmillCommands(treadmillControl);
let hrTraining = new HeartRateTraining(treadmillCommands);

// Workout Builder State
let currentWorkoutSegments = [];
let currentWorkout = null;
let workoutStartTime = null;
let currentSegmentIndex = 0;
let segmentStartTime = null;
let workoutInterval = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Speed conversion utilities
    function kmhToMinPerKm(kmh) {
        if (kmh <= 0) return 0;
        return 60 / kmh;
    }
    
    function minPerKmToKmh(minPerKm) {
        if (minPerKm <= 0) return 0;
        return 60 / minPerKm;
    }
    
    function formatMinPerKm(minPerKm) {
        const minutes = Math.floor(minPerKm);
        const seconds = Math.round((minPerKm - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // UI Mode switching
    function toggleTrainingMode() {
        const mode = document.querySelector('input[name="trainingMode"]:checked').value;
        const hrMode = document.getElementById('heartRateMode');
        const manualMode = document.getElementById('manualMode');
        
        if (mode === 'heartRate') {
            hrMode.style.display = 'block';
            manualMode.style.display = 'none';
        } else {
            hrMode.style.display = 'none';
            manualMode.style.display = 'block';
        }
    }
    
    // Workout Builder Functions
    function addSegment() {
        const duration = parseFloat(document.getElementById('segmentDuration').value);
        const mode = document.querySelector('input[name="trainingMode"]:checked').value;
        
        if (isNaN(duration) || duration <= 0) {
            alert('Please enter a valid duration');
            return;
        }
        
        let segment;
        
        if (mode === 'heartRate') {
            const targetHR = parseFloat(document.getElementById('targetHeartRate').value);
            const adjustSpeed = document.querySelector('input[name="adjustSpeed"]').checked;
            const adjustIncline = document.querySelector('input[name="adjustIncline"]').checked;
            const minSpeedInput = parseFloat(document.getElementById('minSpeed').value);
            const maxSpeedInput = parseFloat(document.getElementById('maxSpeed').value);
            const speedLimitsUnit = document.getElementById('speedLimitsUnit').value;
            
            if (isNaN(targetHR) || targetHR < 50 || targetHR > 220) {
                alert('Please enter a valid target heart rate (50-220 bpm)');
                return;
            }
            
            if (!adjustSpeed && !adjustIncline) {
                alert('Please select at least one adjustment method (Speed or Incline)');
                return;
            }
            
            // Convert speed limits to km/h if needed
            let minSpeed = minSpeedInput;
            let maxSpeed = maxSpeedInput;
            if (speedLimitsUnit === 'minperkm') {
                minSpeed = minPerKmToKmh(minSpeedInput);
                maxSpeed = minPerKmToKmh(maxSpeedInput);
            }
            
            segment = {
                type: 'heartRate',
                duration: duration * 60, // convert to seconds
                targetHeartRate: targetHR,
                adjustments: {
                    speed: adjustSpeed,
                    incline: adjustIncline
                },
                speedLimits: {
                    min: minSpeed || 1.0,
                    max: maxSpeed || 20.0
                },
                inclineLimits: {
                    min: 0,
                    max: 15
                }
            };
        } else {
            const speedInput = parseFloat(document.getElementById('manualSpeed').value);
            const speedUnit = document.getElementById('speedUnit').value;
            const incline = parseFloat(document.getElementById('manualIncline').value) || 0;
            
            if (isNaN(speedInput) || speedInput <= 0) {
                alert('Please enter a valid speed');
                return;
            }
            
            // Convert speed to km/h if needed
            let speed = speedInput;
            if (speedUnit === 'minperkm') {
                speed = minPerKmToKmh(speedInput);
            }
            
            segment = {
                type: 'manual',
                duration: duration * 60, // convert to seconds
                speed: speed,
                incline: incline
            };
        }
        
        currentWorkoutSegments.push(segment);
        updateSegmentsList();
        clearSegmentInputs();
    }
    
    function clearSegmentInputs() {
        document.getElementById('segmentDuration').value = '';
        document.getElementById('targetHeartRate').value = '';
        document.getElementById('minSpeed').value = '';
        document.getElementById('maxSpeed').value = '';
        document.getElementById('manualSpeed').value = '';
        document.getElementById('manualIncline').value = '';
    }

    function updateSegmentsList() {
        const list = document.getElementById('segmentsList');
        list.innerHTML = '';
        
        currentWorkoutSegments.forEach((segment, index) => {
            const div = document.createElement('div');
            div.className = 'segment-item';
            
            let segmentDescription;
            if (segment.type === 'heartRate') {
                const adjustments = [];
                if (segment.adjustments.speed) adjustments.push('Speed');
                if (segment.adjustments.incline) adjustments.push('Incline');
                
                segmentDescription = `
                    <div class="segment-details">
                        <strong>Segment ${index + 1}:</strong> HR Target ${segment.targetHeartRate} bpm
                        <br>Duration: ${(segment.duration / 60).toFixed(1)} minutes
                        <br>Adjust: ${adjustments.join(', ')}
                        <br>Speed limits: ${segment.speedLimits.min.toFixed(1)} - ${segment.speedLimits.max.toFixed(1)} km/h
                    </div>
                `;
            } else {
                segmentDescription = `
                    <div class="segment-details">
                        <strong>Segment ${index + 1}:</strong> Manual
                        <br>Duration: ${(segment.duration / 60).toFixed(1)} minutes
                        <br>Speed: ${segment.speed.toFixed(1)} km/h, Incline: ${segment.incline.toFixed(1)}%
                    </div>
                `;
            }
            
            div.innerHTML = `
                ${segmentDescription}
                <button class="remove-segment" data-index="${index}">Remove</button>
            `;
            list.appendChild(div);
        });
    }

    function removeSegment(index) {
        currentWorkoutSegments.splice(index, 1);
        updateSegmentsList();
    }

    function saveWorkout() {
        const name = document.getElementById('workoutName').value.trim();
        if (!name) {
            alert('Please enter a workout name');
            return;
        }
        
        if (currentWorkoutSegments.length === 0) {
            alert('Please add at least one segment');
            return;
        }
        
        const workouts = JSON.parse(localStorage.getItem('savedWorkouts') || '{}');
        workouts[name] = currentWorkoutSegments;
        localStorage.setItem('savedWorkouts', JSON.stringify(workouts));
        
        loadSavedWorkouts();
        document.getElementById('workoutName').value = '';
        alert('Workout saved successfully!');
    }

    function loadSavedWorkouts() {
        const select = document.getElementById('savedWorkouts');
        const workouts = JSON.parse(localStorage.getItem('savedWorkouts') || '{}');
        
        select.innerHTML = '<option value="">Select saved workout...</option>';
        
        Object.keys(workouts).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    function loadWorkout() {
        const name = document.getElementById('savedWorkouts').value;
        if (!name) return;
        
        const workouts = JSON.parse(localStorage.getItem('savedWorkouts') || '{}');
        if (workouts[name]) {
            currentWorkoutSegments = [...workouts[name]];
            updateSegmentsList();
            document.getElementById('workoutName').value = name;
        }
    }

    function deleteWorkout() {
        const name = document.getElementById('savedWorkouts').value;
        if (!name) return;
        
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
            const workouts = JSON.parse(localStorage.getItem('savedWorkouts') || '{}');
            delete workouts[name];
            localStorage.setItem('savedWorkouts', JSON.stringify(workouts));
            loadSavedWorkouts();
            currentWorkoutSegments = [];
            updateSegmentsList();
        }
    }

    function importJsonWorkout() {
        document.getElementById('jsonFileInput').click();
    }

    function handleJsonFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // Validate and convert JSON workout to internal format
                const segments = validateAndConvertJsonWorkout(jsonData);
                
                if (segments) {
                    currentWorkoutSegments = segments;
                    updateSegmentsList();
                    
                    // Set workout name if provided
                    if (jsonData.name) {
                        document.getElementById('workoutName').value = jsonData.name;
                    }
                    
                    alert('Workout imported successfully!');
                }
            } catch (error) {
                alert('Error importing JSON file: ' + error.message);
            }
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    function validateAndConvertJsonWorkout(jsonData) {
        // Validate required fields
        if (!jsonData.segments || !Array.isArray(jsonData.segments)) {
            throw new Error('JSON must contain a "segments" array');
        }

        if (jsonData.segments.length === 0) {
            throw new Error('Workout must contain at least one segment');
        }

        const convertedSegments = [];

        jsonData.segments.forEach((segment, index) => {
            // Validate required fields
            if (typeof segment.duration !== 'number' || segment.duration <= 0) {
                throw new Error(`Segment ${index + 1}: duration must be a positive number (in seconds)`);
            }

            if (!segment.type || !['heartRate', 'manual'].includes(segment.type)) {
                throw new Error(`Segment ${index + 1}: type must be "heartRate" or "manual"`);
            }

            let convertedSegment = {
                type: segment.type,
                duration: segment.duration
            };

            if (segment.type === 'heartRate') {
                // Heart rate segment validation
                if (typeof segment.targetHeartRate !== 'number' || 
                    segment.targetHeartRate < 50 || segment.targetHeartRate > 220) {
                    throw new Error(`Segment ${index + 1}: targetHeartRate must be between 50-220 bpm`);
                }

                if (!segment.adjustments || typeof segment.adjustments !== 'object') {
                    throw new Error(`Segment ${index + 1}: adjustments object is required for heart rate segments`);
                }

                if (typeof segment.adjustments.speed !== 'boolean' || 
                    typeof segment.adjustments.incline !== 'boolean') {
                    throw new Error(`Segment ${index + 1}: adjustments.speed and adjustments.incline must be boolean`);
                }

                if (!segment.adjustments.speed && !segment.adjustments.incline) {
                    throw new Error(`Segment ${index + 1}: at least one adjustment method must be enabled`);
                }

                convertedSegment.targetHeartRate = segment.targetHeartRate;
                convertedSegment.adjustments = segment.adjustments;
                
                // Speed limits (optional, with defaults)
                convertedSegment.speedLimits = {
                    min: segment.speedLimits?.min || 1.0,
                    max: segment.speedLimits?.max || 20.0
                };

                // Incline limits (optional, with defaults)
                convertedSegment.inclineLimits = {
                    min: segment.inclineLimits?.min || 0,
                    max: segment.inclineLimits?.max || 15
                };

            } else if (segment.type === 'manual') {
                // Manual segment validation
                if (typeof segment.speed !== 'number' || segment.speed <= 0) {
                    throw new Error(`Segment ${index + 1}: speed must be a positive number (in km/h)`);
                }

                convertedSegment.speed = segment.speed;
                convertedSegment.incline = segment.incline || 0;
            }

            convertedSegments.push(convertedSegment);
        });

        return convertedSegments;
    }

    function startWorkout() {
        if (currentWorkoutSegments.length === 0) {
            alert('Please add segments to your workout first');
            return;
        }
        
        // Hide workout builder, show running interface
        document.getElementById('workoutBuilder').style.display = 'none';
        document.getElementById('runningInterface').style.display = 'block';
        
        // Initialize workout state
        currentSegmentIndex = 0;
        workoutStartTime = Date.now();
        segmentStartTime = Date.now();
        
        // Start first segment
        startSegment(currentWorkoutSegments[0]);
        updateWorkoutDisplay();
        
        // Start workout update interval
        workoutInterval = setInterval(updateWorkoutDisplay, 1000);
    }

    function startSegment(segment) {
        segmentStartTime = Date.now();
        
        if (segment.type === 'heartRate') {
            // Set target heart rate display
            document.getElementById('targetSpeed').textContent = `Target HR: ${segment.targetHeartRate} bpm`;
            
            // TODO: Start heart rate training with adjustment parameters
            // This will be implemented in the next phase
        } else {
            // Manual segment - set fixed values
            document.getElementById('targetSpeed').textContent = `Target: ${segment.speed.toFixed(1)} km/h`;
            
            // Set speed and incline on treadmill if connected
            if (treadmillControl.connected()) {
                treadmillCommands.setSpeed(segment.speed);
                treadmillCommands.setInclination(segment.incline);
            }
        }
    }

    function updateWorkoutDisplay() {
        if (currentSegmentIndex >= currentWorkoutSegments.length) {
            finishWorkout();
            return;
        }
        
        const segment = currentWorkoutSegments[currentSegmentIndex];
        const elapsed = (Date.now() - segmentStartTime) / 1000;
        const remaining = Math.max(0, segment.duration - elapsed);
        
        // Update segment info
        document.getElementById('currentSegmentInfo').textContent = 
            `Segment ${currentSegmentIndex + 1}/${currentWorkoutSegments.length}`;
        
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        document.getElementById('segmentTimeRemaining').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
        
        // Update progress bar
        const progress = Math.min(100, (elapsed / segment.duration) * 100);
        document.getElementById('segmentProgress').style.width = `${progress}%`;
        
        // Check if segment is complete
        if (elapsed >= segment.duration) {
            currentSegmentIndex++;
            if (currentSegmentIndex < currentWorkoutSegments.length) {
                startSegment(currentWorkoutSegments[currentSegmentIndex]);
            }
        }
    }

    function pauseWorkout() {
        if (workoutInterval) {
            clearInterval(workoutInterval);
            workoutInterval = null;
            document.getElementById('pauseWorkout').textContent = 'Resume';
        } else {
            workoutInterval = setInterval(updateWorkoutDisplay, 1000);
            document.getElementById('pauseWorkout').textContent = 'Pause';
        }
    }

    function stopWorkout() {
        finishWorkout();
    }

    function finishWorkout() {
        // Clear workout interval
        if (workoutInterval) {
            clearInterval(workoutInterval);
            workoutInterval = null;
        }
        
        // Show workout builder, hide running interface
        document.getElementById('workoutBuilder').style.display = 'block';
        document.getElementById('runningInterface').style.display = 'none';
        
        // Reset pause button text
        document.getElementById('pauseWorkout').textContent = 'Pause';
        
        // Stop treadmill if connected
        if (treadmillControl.connected()) {
            treadmillCommands.setSpeed(0);
        }
        
        alert('Workout completed!');
    }
    
    // Load saved workouts on page load
    loadSavedWorkouts();
    
    // Initialize UI
    toggleTrainingMode();
    
    // Event Listeners
    document.getElementById('addSegment').addEventListener('click', addSegment);
    document.getElementById('saveWorkout').addEventListener('click', saveWorkout);
    document.getElementById('loadWorkout').addEventListener('click', loadWorkout);
    document.getElementById('deleteWorkout').addEventListener('click', deleteWorkout);
    document.getElementById('importJson').addEventListener('click', importJsonWorkout);
    document.getElementById('jsonFileInput').addEventListener('change', handleJsonFileImport);
    document.getElementById('startWorkout').addEventListener('click', startWorkout);
    document.getElementById('pauseWorkout').addEventListener('click', pauseWorkout);
    document.getElementById('stopWorkout').addEventListener('click', stopWorkout);
    
    // Training mode toggle
    document.querySelectorAll('input[name="trainingMode"]').forEach(radio => {
        radio.addEventListener('change', toggleTrainingMode);
    });
    
    // Event delegation for remove segment buttons
    document.getElementById('segmentsList').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-segment')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            removeSegment(index);
        }
    });
    
    document.querySelector('#toggleConnection').addEventListener('click', async function() {
        if(!treadmillControl.connected()) {
            document.querySelector('#toggleConnection').textContent = 'Disconnect';

            await treadmillControl.connect();
            await treadmillCommands.requestControl();
        
            monitor.setDeviceName(treadmillControl.device.name);
        }
        else {
            document.querySelector('#toggleConnection').textContent = 'Connect';
            treadmillControl.disconnect();
            monitor.setDeviceName('Not connected');
        }
    });
});

treadmillControl.addDataHandler(treadmillData => {
    monitor.setCurrentHeartRate(treadmillData.hr);
    monitor.setSpeed(treadmillData.speed);
    monitor.setDistance(treadmillData.totalDistance);
    monitor.setDuration(treadmillData.elapsedTime);
    monitor.setIncline(treadmillData.inclination);
    monitor.setCalories(treadmillData.kcal);
    
    // Update current speed display in running interface
    if (document.getElementById('runningInterface').style.display !== 'none') {
        document.getElementById('currentSpeed').textContent = `${treadmillData.speed.toFixed(1)} km/h`;
    }
});

