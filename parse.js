import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const xmlPath = resolve(process.argv[2] || 'export.xml');

console.log(`Reading XML from: ${xmlPath}`);

const xml = readFileSync(xmlPath, 'utf-8');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => ['Workout', 'WorkoutStatistics', 'MetadataEntry'].includes(name),
    processEntities: false,
});

const data = parser.parse(xml);

const workouts = data?.HealthData?.Workout ?? [];
const runningWorkouts = workouts.filter(w => w.workoutActivityType === 'HKWorkoutActivityTypeRunning');

console.log(`Found ${runningWorkouts.length} running workouts`);

function getStat(workout, type, attr = 'average') {
    const stats = workout.WorkoutStatistics ?? [];
    const match = stats.find(s => s.type === type);
    return match ? parseFloat(match[attr]) || null : null;
}

function getMeta(workout, key) {
    const entries = workout.MetadataEntry ?? [];
    const match = entries.find(e => e.key === key);
    return match ? match.value : null;
}

const runs = runningWorkouts.map(workout => {
    const durationRaw = parseFloat(workout.duration);
    const durationMins = Math.floor(durationRaw);
    const durationSecs = Math.round((durationRaw - durationMins) * 60);

    const distanceRaw = getStat(workout, 'HKQuantityTypeIdentifierDistanceWalkingRunning', 'sum');
    const elevationRaw = getMeta(workout, 'HKElevationAscended');
    const stepCount = getStat(workout, 'HKQuantityTypeIdentifierStepCount', 'sum');
    const runningSpeed = getStat(workout, 'HKQuantityTypeIdentifierRunningSpeed');

    return {
        date: workout.startDate?.split(' ')[0] ?? null,
        startTime: workout.startDate?.split(' ')[1]?.substring(0, 8) ?? null,
        duration: `${durationMins}m ${durationSecs}s`,
        durationMinutes: parseFloat(durationRaw.toFixed(4)),
        device: workout.device?.split(',')[1]?.split(':')[1]?.trim() ?? 'Unknown',
        distance: distanceRaw ? parseFloat((distanceRaw * 1.60934).toFixed(2)) : null,
        heartRate: {
            average: getStat(workout, 'HKQuantityTypeIdentifierHeartRate'),
            min: getStat(workout, 'HKQuantityTypeIdentifierHeartRate', 'minimum'),
            max: getStat(workout, 'HKQuantityTypeIdentifierHeartRate', 'maximum'),
        },
        runningPower: getStat(workout, 'HKQuantityTypeIdentifierRunningPower'),
        activeCalories: getStat(workout, 'HKQuantityTypeIdentifierActiveEnergyBurned', 'sum'),
        elevationAscended: elevationRaw ? parseFloat((parseFloat(elevationRaw) / 100).toFixed(1)) : null,
        // NOTE: Native cadence requires enabling in Apple Watch Workout app settings.
        // Using stepCount / durationMinutes as approximation until then.
        cadence: stepCount && durationRaw ? parseFloat((stepCount / durationRaw).toFixed(1)) : null,
        stepCount: stepCount,
        runningSpeed: runningSpeed, // km/h
        pace: runningSpeed ? parseFloat((60 / runningSpeed).toFixed(4)) : null, // min/km
        groundContactTime: getStat(workout, 'HKQuantityTypeIdentifierRunningGroundContactTime'),
        verticalOscillation: getStat(workout, 'HKQuantityTypeIdentifierRunningVerticalOscillation'),
        strideLength: getStat(workout, 'HKQuantityTypeIdentifierRunningStrideLength'),
    };
});

const output = {
    exportDate: new Date().toISOString(),
    totalRuns: runs.length,
    runs,
};

const outPath = resolve('runs.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Written to: ${outPath}`);
console.log('\nSample run (most recent):');
console.log(JSON.stringify(runs[runs.length - 1], null, 2));