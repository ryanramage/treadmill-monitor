
[Full App Found Here](https://ra.mage.rocks/treadmill)

# Smart Treadmill Training

Transform your treadmill workouts with intelligent heart rate-based training that automatically adjusts your speed to keep you in the perfect training zone.

## Why Use This?

**🎯 Stay in Your Target Zone**
No more constantly checking your heart rate and manually adjusting speed. The app automatically speeds up or slows down your treadmill to keep you in your optimal training zone.

**📱 Train Smarter, Not Harder**
Whether you're doing interval training, endurance runs, or recovery sessions, let the technology handle the speed adjustments while you focus on your form and breathing.

**📊 Real-Time Feedback**
See your heart rate, pace, distance, and training progress all in one place. Track your performance and stay motivated throughout your workout.

**🏃‍♀️ Personalized Workouts**
Create custom training sessions with different heart rate zones, durations, and intensity levels. Perfect for beginners building endurance or athletes fine-tuning their performance.

## What You Need

- A Bluetooth-enabled treadmill (like the Decathlon Domyos T900D)
- A heart rate monitor or chest strap
- A smartphone or tablet with Bluetooth support
- For iPhones: the Bluefy browser app

## Get Started

**Try it now:** [Launch the app](https://ra.mage.rocks/treadmill)

1. Turn on your treadmill and heart rate monitor
2. Open the app and tap "Connect"
3. Select your treadmill from the list
4. Set your target heart rate zone
5. Start your workout and let the app do the rest!

## Import Custom Workouts

Create sophisticated training plans by importing JSON workout files. The app supports a flexible format that lets you define heart rate zones, pace targets, and complex interval structures.

**JSON Schema:** [workout-schema.json](workout-schema.json)

### Using ChatGPT to Create Workouts

You can use ChatGPT to convert existing workout plans into the JSON format:

1. Copy your existing workout description (from a training plan, coach, or app)
2. Ask ChatGPT: "Convert this workout to JSON format using this schema: [paste the schema]"
3. Import the generated JSON into the app

**Example prompt:**
```
Convert this workout to JSON format using the provided schema:
"5 min warmup at easy pace, then 6x (3 min at 165 BPM, 2 min recovery at 140 BPM), 5 min cooldown"

Use this schema: [paste workout-schema.json contents]
```

## Export to Garmin

After completing your workout, export your training data to Garmin Connect:

- **TCX Export**: Download your workout as a TCX file compatible with Garmin Connect, Strava, and other fitness platforms
- **Complete Data**: Includes heart rate, pace, distance, and elevation data
- **Easy Upload**: Simply upload the TCX file to your preferred fitness tracking service

The export captures all your training metrics, making it easy to track progress and analyze performance over time.

## Features

### 🔄 Import & Export
- **JSON Import**: Import complex workout structures with multiple segments and heart rate zones
- **ChatGPT Integration**: Use AI to convert any workout description into importable JSON format
- **TCX Export**: Export completed workouts to Garmin Connect, Strava, and other fitness platforms

### 🎛️ Smart Controls
- **Automatic Speed Adjustment**: AI-powered speed changes to maintain target heart rate
- **Manual Override**: Take control when needed, then resume automatic mode
- **Safety Limits**: Set minimum and maximum speed boundaries for each segment

### 📊 Real-Time Analytics
- **Live Heart Rate Monitoring**: See your current HR, target zone, and trends
- **Pace & Distance Tracking**: Monitor your progress throughout the workout
- **Segment Progress**: Visual indicators for current segment and remaining time

## Safety First

This app is designed to enhance your training, but always prioritize safety. Keep the emergency stop button within reach, start with conservative settings, and listen to your body. The app is continuously being improved, so report any issues you encounter.
