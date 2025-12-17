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

// Load saved workouts on page load
loadSavedWorkouts();

// Workout Builder Functions
function addSegment() {
    const speed = parseFloat(document.getElementById('segmentSpeed').value);
    const duration = parseFloat(document.getElementById('segmentDuration').value);
    
    if (isNaN(speed) || isNaN(duration) || speed <= 0 || duration <= 0) {
        alert('Please enter valid speed and duration values');
        return;
    }
    
    const segment = {
        speed: speed,
        duration: duration * 60 // convert to seconds
    };
    
    currentWorkoutSegments.push(segment);
    updateSegmentsList();
    
    // Clear inputs
    document.getElementById('segmentSpeed').value = '';
    document.getElementById('segmentDuration').value = '';
}

function updateSegmentsList() {
    const list = document.getElementById('segmentsList');
    list.innerHTML = '';
    
    currentWorkoutSegments.forEach((segment, index) => {
        const div = document.createElement('div');
        div.className = 'segment-item';
        div.innerHTML = `
            <div class="segment-details">
                Segment ${index + 1}: ${segment.speed} km/h for ${(segment.duration / 60).toFixed(1)} minutes
            </div>
            <button class="remove-segment" onclick="removeSegment(${index})">Remove</button>
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
    
    // Set target speed on display
    document.getElementById('targetSpeed').textContent = `Target: ${segment.speed} km/h`;
    
    // Set speed on treadmill if connected
    if (treadmillControl.connected()) {
        treadmillCommands.setSpeed(segment.speed);
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

// Make functions global for onclick handlers
window.removeSegment = removeSegment;

// Event Listeners
document.getElementById('addSegment').addEventListener('click', addSegment);
document.getElementById('saveWorkout').addEventListener('click', saveWorkout);
document.getElementById('loadWorkout').addEventListener('click', loadWorkout);
document.getElementById('deleteWorkout').addEventListener('click', deleteWorkout);
document.getElementById('startWorkout').addEventListener('click', startWorkout);
document.getElementById('pauseWorkout').addEventListener('click', pauseWorkout);
document.getElementById('stopWorkout').addEventListener('click', stopWorkout);

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
