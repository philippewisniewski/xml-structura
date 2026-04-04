import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface HKRecord {
    type: string;
    value: string;
    startDate: string;
    endDate: string;
    sourceName: string;
}

interface HKWorkoutStatistics {
    type: string;
    average: string;
    minimum: string;
    maximum: string;
    sum: string;
}

interface HKMetadataEntry {
    key: string;
    value: string;
}

interface HKWorkout {
    workoutActivityType: string;
    duration: string;
    startDate: string;
    WorkoutStatistics?: HKWorkoutStatistics[];
    MetadataEntry?: HKMetadataEntry[];
}

interface DailyRecovery {
    date: string;
    sleepDurationHours: number | null;
    hrvMs: number | null;
    restingHeartRateBpm: number | null;
    vo2MaxMlKgMin: number | null;
    heartRateRecoveryBpm: number | null;
    respiratoryRateBreathsPerMin: number | null;
    wristTemperatureCelsius: number | null;
    oxygenSaturationPercent: number | null;
    sleepBreathingDisturbances: number | null;
    timeInDaylightMinutes: number | null;
}

type RunInput = Omit<RunRecord, 'summary'>;

interface RunRecord {
    startedAt: string | null;
    durationFormatted: string;
    durationMinutes: number;
    distanceKm: number | null;
    pacePerKm: string | null;
    heartRateAvgBpm: number | null;
    heartRateMinBpm: number | null;
    heartRateMaxBpm: number | null;
    runningPowerWatts: number | null;
    activeCaloriesKcal: number | null;
    elevationGainMetres: number | null;
    cadenceStepsPerMin: number | null;
    groundContactTimeMs: number | null;
    verticalOscillationCm: number | null;
    strideLengthMetres: number | null;
    recovery: {
        nightBefore: DailyRecovery | null;
        runDay: DailyRecovery | null;
        dayAfter: DailyRecovery | null;
    };
    route: RouteData | null;
    summary: string;
}

interface RouteData {
    gpxFile: string;
    startLat: number;
    startLon: number;
    kmSplits: number[];
    routePolyline: [number, number][];
}

interface ParsedOutput {
    exportedAt: string;
    totalRuns: number;
    runs: RunRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MILES_TO_KM = 1.60934;

// ─── Setup ────────────────────────────────────────────────────────────────────

const xmlPath = resolve(process.argv[2] || 'export.xml');

// Parse optional --routes flag
const routesFlagIndex = process.argv.indexOf('--routes');
const routesDir: string | null = routesFlagIndex !== -1 && process.argv[routesFlagIndex + 1]
    ? resolve(process.argv[routesFlagIndex + 1])
    : resolve('workout-routes');

console.log(`Reading XML from: ${xmlPath}`);

const xml = readFileSync(xmlPath, 'utf-8');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name: string) => ['Workout', 'WorkoutStatistics', 'MetadataEntry', 'Record'].includes(name),
    processEntities: false,
});

interface HealthData {
    HealthData?: {
        Workout?: HKWorkout[];
        Record?: HKRecord[];
    };
}

const data = parser.parse(xml) as HealthData;

const workouts: HKWorkout[] = data?.HealthData?.Workout ?? [];
const records: HKRecord[] = data?.HealthData?.Record ?? [];
const runningWorkouts = workouts.filter(w => w.workoutActivityType === 'HKWorkoutActivityTypeRunning');

console.log(`Found ${runningWorkouts.length.toLocaleString()} running workouts`);
console.log(`Found ${records.length.toLocaleString()} health records`);

// ─── Workout helpers ──────────────────────────────────────────────────────────

type StatAttr = 'average' | 'minimum' | 'maximum' | 'sum';

function getStat(workout: HKWorkout, type: string, attr: StatAttr = 'average'): number | null {
    const stats = workout.WorkoutStatistics ?? [];
    const match = stats.find(s => s.type === type);
    return match ? parseFloat(match[attr]) || null : null;
}

function getMeta(workout: HKWorkout, key: string): string | null {
    const entries = workout.MetadataEntry ?? [];
    const match = entries.find(e => e.key === key);
    return match ? match.value : null;
}

// ─── Recovery record helpers ──────────────────────────────────────────────────

// Get all records of a given type
function getRecordsByType(type: string): HKRecord[] {
    return records.filter(r => r.type === type);
}

// Extract date portion from a HealthKit date string
function extractDate(dateStr: string | undefined): string | null {
    return dateStr?.split(' ')[0] ?? null;
}

// Build a daily index of recovery metrics keyed by date
function buildDailyRecoveryIndex(): Record<string, DailyRecovery> {
    const index: Record<string, DailyRecovery> = {};

    const ensure = (date: string): DailyRecovery => {
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

    const sleepByDate: Record<string, number> = {};
    sleepRecords.forEach(r => {
        const date = extractDate(r.endDate);
        if (!date) return;
        if (!sleepByDate[date]) sleepByDate[date] = 0;
        const start = new Date(r.startDate.replace(' ', 'T').replace(/\s*([+-])(\d{2})(\d{2})$/, '$1$2:$3'));
        const end = new Date(r.endDate.replace(' ', 'T').replace(/\s*([+-])(\d{2})(\d{2})$/, '$1$2:$3'));
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        sleepByDate[date] += durationHours;
    });

    Object.entries(sleepByDate).forEach(([date, hours]) => {
        ensure(date).sleepDurationHours = parseFloat(hours.toFixed(2));
    });

    // ── HRV (daily average) ─────────────────────────────────────────────────
    const hrvByDate: Record<string, number[]> = {};
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
    const respByDate: Record<string, number[]> = {};
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
    const spo2ByDate: Record<string, number[]> = {};
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
    const daylightByDate: Record<string, number> = {};
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

function formatPace(pace: number | null): string | null {
    if (!pace) return null;
    const mins = Math.floor(pace);
    const secs = String(Math.round((pace % 1) * 60)).padStart(2, '0');
    return `${mins}:${secs} min/km`;
}

function formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// ─── GPX parsing ─────────────────────────────────────────────────────────────

interface TrkPoint {
    lat: number;
    lon: number;
    time: Date;
}

// Haversine formula — returns distance in km between two lat/lon points
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ParsedGpx {
    filename: string;
    firstTimestamp: Date;
    points: TrkPoint[];
}

const gpxParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name: string) => name === 'trkpt',
    processEntities: false,
});

function parseGpxFile(filePath: string): ParsedGpx | null {
    try {
        const content = readFileSync(filePath, 'utf-8');
        const parsed = gpxParser.parse(content) as {
            gpx?: {
                trk?: {
                    trkseg?: {
                        trkpt?: Array<{ lat: string; lon: string; time: string }>;
                    };
                };
            };
        };

        const trkpts = parsed?.gpx?.trk?.trkseg?.trkpt;
        if (!trkpts || trkpts.length === 0) return null;

        const points: TrkPoint[] = trkpts
            .map(pt => {
                const lat = parseFloat(pt.lat);
                const lon = parseFloat(pt.lon);
                const time = new Date(pt.time);
                if (isNaN(lat) || isNaN(lon) || isNaN(time.getTime())) return null;
                return { lat, lon, time };
            })
            .filter((pt): pt is TrkPoint => pt !== null);

        if (points.length === 0) return null;

        return {
            filename: basename(filePath),
            firstTimestamp: points[0].time,
            points,
        };
    } catch {
        return null;
    }
}

function buildRouteData(gpx: ParsedGpx): RouteData {
    const { points } = gpx;

    const startLat = points[0].lat;
    const startLon = points[0].lon;

    // Downsample: every 10th point for the polyline
    const routePolyline: [number, number][] = points
        .filter((_, i) => i % 10 === 0)
        .map(pt => [pt.lat, pt.lon]);

    // Compute km splits from cumulative distance and per-point timestamps
    // Only meaningful when timestamps vary across points
    const kmSplits: number[] = [];
    let cumulativeDist = 0;
    let kmBoundary = 1;
    let kmStartTime = points[0].time;
    let prevPt = points[0];

    for (let i = 1; i < points.length; i++) {
        const pt = points[i];
        cumulativeDist += haversine(prevPt.lat, prevPt.lon, pt.lat, pt.lon);

        if (cumulativeDist >= kmBoundary) {
            const elapsedMs = pt.time.getTime() - kmStartTime.getTime();
            const elapsedMin = elapsedMs / 1000 / 60;
            // Skip splits with zero time (identical timestamps) or > 12 min/km (GPS pause)
            if (elapsedMin > 0 && elapsedMin <= 12) {
                kmSplits.push(parseFloat(elapsedMin.toFixed(2)));
            }
            kmStartTime = pt.time;
            kmBoundary++;
        }

        prevPt = pt;
    }

    return {
        gpxFile: gpx.filename,
        startLat,
        startLon,
        kmSplits,
        routePolyline,
    };
}

// Build a map from GPX first-trkpt timestamp (ms) → RouteData for fast matching
function buildRouteIndex(dir: string): Map<number, RouteData> {
    const index = new Map<number, RouteData>();
    let files: string[];

    try {
        files = readdirSync(dir).filter(f => f.endsWith('.gpx'));
    } catch (err) {
        console.warn(`Warning: could not read routes directory "${dir}": ${err}`);
        return index;
    }

    console.log(`Parsing ${files.length} GPX files from: ${dir}`);

    for (const file of files) {
        const gpx = parseGpxFile(join(dir, file));
        if (!gpx) continue;
        const routeData = buildRouteData(gpx);
        index.set(gpx.firstTimestamp.getTime(), routeData);
    }

    console.log(`Loaded ${index.size} GPX routes`);
    return index;
}

// Match a run's startedAt (ISO string) to a GPX route within ±5 minutes
const MATCH_WINDOW_MS = 5 * 60 * 1000;

function matchRoute(startedAt: string | null, routeIndex: Map<number, RouteData>): RouteData | null {
    if (!startedAt || routeIndex.size === 0) return null;
    const runMs = new Date(startedAt).getTime();
    if (isNaN(runMs)) return null;

    let best: RouteData | null = null;
    let bestDiff = Infinity;
    for (const [gpxMs, routeData] of routeIndex) {
        const diff = Math.abs(gpxMs - runMs);
        if (diff <= MATCH_WINDOW_MS && diff < bestDiff) {
            best = routeData;
            bestDiff = diff;
        }
    }
    return best;
}

// Build an enriched natural language summary with qualitative descriptors
// and recovery context — gives EmbeddingGemma semantic hooks per run
function buildSummary(run: RunInput): string {
    const runType = run.distanceKm && run.distanceKm > 15 ? 'long endurance run'
        : run.distanceKm && run.distanceKm > 10 ? 'medium long run'
        : run.distanceKm && run.distanceKm < 8 ? 'short run'
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

    // Pacing pattern: compare first half vs second half average pace.
    // Threshold: 5 sec/km (5/60 decimal minutes) — matches running-agent computation.
    const kmSplits = run.route?.kmSplits ?? [];
    let pacingDesc: string | null = null;
    if (kmSplits.length >= 2) {
        const mid = Math.floor(kmSplits.length / 2);
        const firstHalf = kmSplits.slice(0, mid);
        const secondHalf = kmSplits.slice(mid);
        const avg = (splits: number[]) => splits.reduce((a, b) => a + b, 0) / splits.length;
        const diff = avg(secondHalf) - avg(firstHalf);
        const THRESHOLD = 5 / 60; // 5 seconds as decimal minutes
        if (diff < -THRESHOLD) {
            pacingDesc = 'negative split';
        } else if (diff > THRESHOLD) {
            pacingDesc = 'positive split';
        } else {
            pacingDesc = 'even pacing';
        }
    }

    return [
        `${runType} of ${run.distanceKm}km on ${run.startedAt ? formatDate(run.startedAt) : 'unknown date'}`,
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
        pacingDesc,
    ].filter(Boolean).join(', ');
}

// ─── Build recovery index ─────────────────────────────────────────────────────

console.log('Building daily recovery index...');
const recoveryIndex = buildDailyRecoveryIndex();
console.log(`Recovery data available for ${Object.keys(recoveryIndex).length.toLocaleString()} days`);

// ─── Build route index ────────────────────────────────────────────────────────

const routeIndex: Map<number, RouteData> = routesDir
    ? buildRouteIndex(routesDir)
    : new Map();

// ─── Parse runs ───────────────────────────────────────────────────────────────

const runs: RunRecord[] = runningWorkouts.map(workout => {
    const durationRaw = parseFloat(workout.duration);
    const durationMins = Math.floor(durationRaw);
    const durationSecs = Math.round((durationRaw - durationMins) * 60);
    const durationFormatted = `${durationMins}m ${durationSecs}s`;

    const distanceRaw = getStat(workout, 'HKQuantityTypeIdentifierDistanceWalkingRunning', 'sum');
    const distanceKm = distanceRaw ? parseFloat((distanceRaw * MILES_TO_KM).toFixed(2)) : null;

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
    // Convert HealthKit date format "2025-05-03 18:25:15 +0100" to a proper UTC ISO string
    // by parsing the timezone offset and adjusting to UTC
    const startedAt = startDate
        ? (() => {
            const isoLike = startDate.replace(' ', 'T').replace(/\s*([+-])(\d{2})(\d{2})$/, '$1$2:$3');
            return new Date(isoLike).toISOString();
        })()
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

    const runBase: RunInput = {
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
        route: matchRoute(startedAt, routeIndex),
    };

    return { ...runBase, summary: buildSummary(runBase) };
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

const output: ParsedOutput = {
    exportedAt: new Date().toISOString(),
    totalRuns: validRuns.length,
    runs: validRuns,
};

const outPath = resolve('runs.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`Written to: ${outPath}`);
console.log(`Valid runs: ${validRuns.length.toLocaleString()} of ${runs.length.toLocaleString()}`);
console.log('\nSample run (most recent):');
console.log(JSON.stringify(validRuns[validRuns.length - 1], null, 2));
