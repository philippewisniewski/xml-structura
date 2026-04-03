import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const xmlPath = resolve(process.argv[2] || 'export.xml');

console.log(`Reading XML from: ${xmlPath}`);

const xml = readFileSync(xmlPath, 'utf-8');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => ['Workout', 'WorkoutStatistics', 'MetadataEntry', 'Record'].includes(name),
    processEntities: false,
});

const data = parser.parse(xml);

const workouts = data?.HealthData?.Workout ?? [];
const records = data?.HealthData?.Record ?? [];
const runningWorkouts = workouts.filter(w => w.workoutActivityType === 'HKWorkoutActivityTypeRunning');

console.log(`Found ${runningWorkouts.length} running workouts`);
console.log(`Found ${records.length} health records`);

// ─── Workout helpers ──────────────────────────────────────────────────────────

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

// ─── Recovery record helpers ──────────────────────────────────────────────────

// Get all records of a given type
function getRecordsByType(type) {
    return records.filter(r => r.type === type);
}

// Extract date portion from a HealthKit date string
function extractDate(dateStr) {
    return dateStr?.split(' ')[0] ?? null;
}

// Build a daily index of recovery metrics keyed by date
function buildDailyRecoveryIndex() {
    const index = {};

    const ensure = (date) => {
        if (!index[date]) {
            index[date] = {
                date,
                sleepDurationHours: null,
                hrvMs: null,
                restingHeartRateBpm: null,
                vo2MaxMlKgMin: null,
                heartRateRecoveryBpm: null,
                respiratoryRateBreathsPerMin: null,
                wristTemperatureCelsius: null,
                oxygenSaturationPercent: null,
                sleepBreathingDisturbances: null,
                timeInDaylightMinutes: null,
            };
        }
        return index[date];
    };

    // ── Sleep duration ──────────────────────────────────────────────────────
    const sleepStages = [
        'HKCategoryValueSleepAnalysisAsleep',
        'HKCategoryValueSleepAnalysisAsleepCore',
        'HKCategoryValueSleepAnalysisAsleepDeep',
        'HKCategoryValueSleepAnalysisAsleepREM',
    ];

    const sleepRecords = records.filter(r =>
        r.type === 'HKCategoryTypeIdentifierSleepAnalysis' &&
        sleepStages.includes(r.value)
    );

    const sleepByDate = {};
    sleepRecords.forEach(r => {
        const date = extractDate(r.endDate);
        if (!date) return;
        if (!sleepByDate[date]) sleepByDate[date] = 0;
        const start = new Date(r.startDate.replace(' ', 'T'));
        const end = new Date(r.endDate.replace(' ', 'T'));
        const durationHours = (end - start) / (1000 * 60 * 60);
        sleepByDate[date] += durationHours;
    });

    Object.entries(sleepByDate).forEach(([date, hours]) => {
        ensure(date).sleepDurationHours = parseFloat(hours.toFixed(2));
    });

    // ── HRV (daily average) ─────────────────────────────────────────────────
    const hrvByDate = {};
    getRecordsByType('HKQuantityTypeIdentifierHeartRateVariabilitySDNN').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        if (!hrvByDate[date]) hrvByDate[date] = [];
        hrvByDate[date].push(parseFloat(r.value));
    });
    Object.entries(hrvByDate).forEach(([date, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        ensure(date).hrvMs = parseFloat(avg.toFixed(1));
    });

    // ── Resting heart rate ──────────────────────────────────────────────────
    getRecordsByType('HKQuantityTypeIdentifierRestingHeartRate').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        ensure(date).restingHeartRateBpm = Math.round(parseFloat(r.value));
    });

    // ── VO2Max ──────────────────────────────────────────────────────────────
    getRecordsByType('HKQuantityTypeIdentifierVO2Max').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        ensure(date).vo2MaxMlKgMin = parseFloat(parseFloat(r.value).toFixed(1));
    });

    // ── Heart rate recovery ─────────────────────────────────────────────────
    getRecordsByType('HKQuantityTypeIdentifierHeartRateRecoveryOneMinute').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        ensure(date).heartRateRecoveryBpm = Math.round(parseFloat(r.value));
    });

    // ── Respiratory rate (daily average) ───────────────────────────────────
    const respByDate = {};
    getRecordsByType('HKQuantityTypeIdentifierRespiratoryRate').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        if (!respByDate[date]) respByDate[date] = [];
        respByDate[date].push(parseFloat(r.value));
    });
    Object.entries(respByDate).forEach(([date, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        ensure(date).respiratoryRateBreathsPerMin = parseFloat(avg.toFixed(1));
    });

    // ── Wrist temperature ───────────────────────────────────────────────────
    getRecordsByType('HKQuantityTypeIdentifierAppleSleepingWristTemperature').forEach(r => {
        const date = extractDate(r.endDate);
        if (!date || !r.value) return;
        ensure(date).wristTemperatureCelsius = parseFloat(parseFloat(r.value).toFixed(2));
    });

    // ── Oxygen saturation (daily average) ──────────────────────────────────
    const spo2ByDate = {};
    getRecordsByType('HKQuantityTypeIdentifierOxygenSaturation').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        if (!spo2ByDate[date]) spo2ByDate[date] = [];
        spo2ByDate[date].push(parseFloat(r.value) * 100);
    });
    Object.entries(spo2ByDate).forEach(([date, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        ensure(date).oxygenSaturationPercent = parseFloat(avg.toFixed(1));
    });

    // ── Sleeping breathing disturbances ─────────────────────────────────────
    getRecordsByType('HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances').forEach(r => {
        const date = extractDate(r.endDate);
        if (!date || !r.value) return;
        ensure(date).sleepBreathingDisturbances = parseFloat(parseFloat(r.value).toFixed(2));
    });

    // ── Time in daylight (daily total) ──────────────────────────────────────
    const daylightByDate = {};
    records.filter(r => r.type === 'HKQuantityTypeIdentifierTimeInDaylight').forEach(r => {
        const date = extractDate(r.startDate);
        if (!date || !r.value) return;
        if (!daylightByDate[date]) daylightByDate[date] = 0;
        daylightByDate[date] += parseFloat(r.value);
    });
    Object.entries(daylightByDate).forEach(([date, mins]) => {
        ensure(date).timeInDaylightMinutes = Math.round(mins);
    });

    return index;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatPace(pace) {
    if (!pace) return null;
    const mins = Math.floor(pace);
    const secs = String(Math.round((pace % 1) * 60)).padStart(2, '0');
    return `${mins}:${secs} min/km`;
}

function formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// Build an enriched natural language summary with qualitative descriptors
// and recovery context — gives EmbeddingGemma semantic hooks per run
function buildSummary(run) {
    const runType = run.distanceKm > 15 ? 'long endurance run'
        : run.distanceKm > 10 ? 'medium long run'
        : run.distanceKm < 8 ? 'short run'
        : 'medium distance run';

    const paceDecimal = run.pacePerKm
        ? parseInt(run.pacePerKm) + parseInt(run.pacePerKm.split(':')[1]) / 60
        : null;
    const paceDesc = !paceDecimal ? ''
        : paceDecimal < 5 ? 'fast pace'
        : paceDecimal < 5.5 ? 'moderate fast pace'
        : paceDecimal < 6 ? 'moderate pace'
        : 'easy pace';

    const gctDesc = !run.groundContactTimeMs ? null
        : run.groundContactTimeMs < 255 ? 'excellent ground contact time'
        : run.groundContactTimeMs < 265 ? 'good ground contact time'
        : run.groundContactTimeMs < 275 ? 'average ground contact time'
        : 'higher ground contact time';

    const elevDesc = !run.elevationGainMetres ? null
        : run.elevationGainMetres > 200 ? 'hilly route with significant elevation'
        : run.elevationGainMetres > 100 ? 'moderate elevation'
        : 'relatively flat route';

    const effortDesc = !run.heartRateAvgBpm ? null
        : run.heartRateAvgBpm > 180 ? 'very high effort'
        : run.heartRateAvgBpm > 170 ? 'high effort'
        : run.heartRateAvgBpm > 160 ? 'moderate effort'
        : 'easy effort';

    // Use runDay HRV if nightBefore is not available
    const hrvSource = run.recovery?.nightBefore?.hrvMs ?? run.recovery?.runDay?.hrvMs ?? null;
    const hrvDesc = !hrvSource ? null
        : hrvSource > 60 ? 'good pre-run recovery (high HRV)'
        : hrvSource < 40 ? 'poor pre-run recovery (low HRV)'
        : 'moderate pre-run recovery';

    // Sleep from night before
    const sleepSource = run.recovery?.nightBefore?.sleepDurationHours ?? null;
    const sleepDesc = !sleepSource ? null
        : sleepSource >= 7 ? `good sleep of ${sleepSource} hours before run`
        : sleepSource < 6 ? `poor sleep of ${sleepSource} hours before run`
        : `${sleepSource} hours sleep before run`;

    // Resting HR on run day
    const restingHR = run.recovery?.runDay?.restingHeartRateBpm ?? null;

    return [
        `${runType} of ${run.distanceKm}km on ${formatDate(run.startedAt)}`,
        `completed in ${run.durationFormatted} at a ${paceDesc} of ${run.pacePerKm}`,
        effortDesc ? `${effortDesc} with average heart rate ${run.heartRateAvgBpm}bpm` : null,
        run.heartRateMaxBpm ? `max heart rate ${run.heartRateMaxBpm}bpm` : null,
        run.runningPowerWatts ? `running power ${run.runningPowerWatts}W` : null,
        elevDesc ? `${elevDesc} of ${run.elevationGainMetres}m` : null,
        run.cadenceStepsPerMin ? `cadence ${run.cadenceStepsPerMin} steps/min` : null,
        gctDesc ? `${gctDesc} of ${run.groundContactTimeMs}ms` : null,
        run.strideLengthMetres ? `stride length ${run.strideLengthMetres}m` : null,
        run.verticalOscillationCm ? `vertical oscillation ${run.verticalOscillationCm}cm` : null,
        run.activeCaloriesKcal ? `active calories ${run.activeCaloriesKcal}kcal` : null,
        hrvDesc ? hrvDesc : null,
        sleepDesc ? sleepDesc : null,
        restingHR ? `resting heart rate ${restingHR}bpm on run day` : null,
    ].filter(Boolean).join(', ');
}

// ─── Build recovery index ─────────────────────────────────────────────────────

console.log('Building daily recovery index...');
const recoveryIndex = buildDailyRecoveryIndex();
console.log(`Recovery data available for ${Object.keys(recoveryIndex).length} days`);

// ─── Parse runs ───────────────────────────────────────────────────────────────

const runs = runningWorkouts.map(workout => {
    const durationRaw = parseFloat(workout.duration);
    const durationMins = Math.floor(durationRaw);
    const durationSecs = Math.round((durationRaw - durationMins) * 60);
    const durationFormatted = `${durationMins}m ${durationSecs}s`;

    const distanceRaw = getStat(workout, 'HKQuantityTypeIdentifierDistanceWalkingRunning', 'sum');
    const distanceKm = distanceRaw ? parseFloat((distanceRaw * 1.60934).toFixed(2)) : null;

    const elevationRaw = getMeta(workout, 'HKElevationAscended');
    const elevationGainMetres = elevationRaw ? parseFloat((parseFloat(elevationRaw) / 100).toFixed(1)) : null;

    const stepCount = getStat(workout, 'HKQuantityTypeIdentifierStepCount', 'sum');
    const runningSpeed = getStat(workout, 'HKQuantityTypeIdentifierRunningSpeed');

    const paceDecimal = runningSpeed
        ? parseFloat((60 / runningSpeed).toFixed(4))
        : distanceKm && durationRaw
            ? parseFloat((durationRaw / distanceKm).toFixed(4))
            : null;

    const heartRateAvg = getStat(workout, 'HKQuantityTypeIdentifierHeartRate');
    const heartRateMin = getStat(workout, 'HKQuantityTypeIdentifierHeartRate', 'minimum');
    const heartRateMax = getStat(workout, 'HKQuantityTypeIdentifierHeartRate', 'maximum');
    const runningPower = getStat(workout, 'HKQuantityTypeIdentifierRunningPower');
    const activeCalories = getStat(workout, 'HKQuantityTypeIdentifierActiveEnergyBurned', 'sum');
    const groundContactTime = getStat(workout, 'HKQuantityTypeIdentifierRunningGroundContactTime');
    const verticalOscillation = getStat(workout, 'HKQuantityTypeIdentifierRunningVerticalOscillation');
    const strideLength = getStat(workout, 'HKQuantityTypeIdentifierRunningStrideLength');

    const startDate = workout.startDate ?? null;
    const startedAt = startDate
        ? startDate.replace(' ', 'T').replace(/\s*[+-]\d{4}$/, 'Z')
        : null;

    const runDate = startDate?.split(' ')[0] ?? null;

    const prevDate = runDate
        ? new Date(new Date(runDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

    const nextDate = runDate
        ? new Date(new Date(runDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

    const recovery = {
        nightBefore: prevDate ? (recoveryIndex[prevDate] ?? null) : null,
        runDay: runDate ? (recoveryIndex[runDate] ?? null) : null,
        dayAfter: nextDate ? (recoveryIndex[nextDate] ?? null) : null,
    };

    const run = {
        startedAt,
        durationFormatted,
        durationMinutes: parseFloat(durationRaw.toFixed(2)),
        distanceKm,
        pacePerKm: formatPace(paceDecimal),
        heartRateAvgBpm: heartRateAvg ? Math.round(heartRateAvg) : null,
        heartRateMinBpm: heartRateMin ? Math.round(heartRateMin) : null,
        heartRateMaxBpm: heartRateMax ? Math.round(heartRateMax) : null,
        runningPowerWatts: runningPower ? Math.round(runningPower) : null,
        activeCaloriesKcal: activeCalories ? Math.round(activeCalories) : null,
        elevationGainMetres,
        // NOTE: Native cadence requires enabling in Apple Watch Workout app.
        // Using stepCount / durationMinutes as approximation until then.
        cadenceStepsPerMin: stepCount && durationRaw ? Math.round(stepCount / durationRaw) : null,
        groundContactTimeMs: groundContactTime ? Math.round(groundContactTime) : null,
        verticalOscillationCm: verticalOscillation ? parseFloat(verticalOscillation.toFixed(1)) : null,
        strideLengthMetres: strideLength ? parseFloat(strideLength.toFixed(2)) : null,
        recovery,
    };

    run.summary = buildSummary(run);

    return run;
});

// ─── Filter valid runs ────────────────────────────────────────────────────────

const validRuns = runs.filter(r => {
    if (!r.distanceKm || r.distanceKm <= 1) return false;
    if (!r.pacePerKm) return false;
    if (r.durationMinutes <= 5) return false;
    if (!r.groundContactTimeMs) return false;
    if (!r.strideLengthMetres) return false;
    if (!r.verticalOscillationCm) return false;
    const paceDecimal = parseInt(r.pacePerKm) + parseInt(r.pacePerKm.split(':')[1]) / 60;
    if (paceDecimal > 10) return false;
    return true;
});

// ─── Output ───────────────────────────────────────────────────────────────────

const output = {
    exportedAt: new Date().toISOString(),
    totalRuns: validRuns.length,
    runs: validRuns,
};

const outPath = resolve('runs.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Written to: ${outPath}`);
console.log(`Valid runs: ${validRuns.length} of ${runs.length}`);
console.log('\nSample run (most recent):');
console.log(JSON.stringify(validRuns[validRuns.length - 1], null, 2));