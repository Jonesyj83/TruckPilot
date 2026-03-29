<script lang="ts" setup>
const props = defineProps<{
    gameConnected: boolean;
    isRouteActive: boolean;
    hasActiveJob: boolean;
    destinationName: string;
    routeEta: string;
    routeDistance: number;
    estimatedGameMinutes: number | null;
    estimatedDistanceKm: number | null;
    restStopMinutes: number;
    fuel: number;
    fuelCapacity: number;
    truckMake: string;
    truckModel: string;
    truckDamage: number | null;
    trailerDamage: number;
    trailerAttached: boolean;
    cargoName: string;
    cargoMass: number;
    sourceCity: string;
    sourceCompany: string;
    destinationCity: string;
    destinationCompany: string;
    reward: number;
    showResetRoute: boolean;
    resetRoute: () => void;
    navBarPosition: "top" | "bottom";
    dashboardHorizontal: "left" | "right";
    dashboardVertical: "top" | "middle" | "bottom";
}>();

const { activeSettings } = useSettings();
const {
    kmToUserUnits,
    literToUserUnits,
    formatDistanceValue,
    distanceUnit,
    fuelUnit,
} = useUnitConversion();

const localNow = ref(Date.now());
let localClockTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
    localClockTimer = window.setInterval(() => {
        localNow.value = Date.now();
    }, 10000);
});

onUnmounted(() => {
    if (localClockTimer) {
        clearInterval(localClockTimer);
    }
});

const telemetryDistanceValue = computed(() => {
    if (props.estimatedDistanceKm == null) return null;
    return props.estimatedDistanceKm;
});

const routeDistanceValue = computed(() => props.routeDistance);

const primaryDistanceDisplay = computed(() => {
    if (telemetryDistanceValue.value != null) {
        return formatDistanceValue(telemetryDistanceValue.value);
    }

    return props.isRouteActive
        ? formatDistanceValue(routeDistanceValue.value)
        : null;
});

const primaryEtaValue = computed(() => {
    if (props.estimatedGameMinutes != null) {
        return formatMinutes(props.estimatedGameMinutes);
    }

    if (props.isRouteActive && props.routeEta) {
        return props.routeEta;
    }

    return "--";
});

const fuelConverted = computed(() => literToUserUnits(props.fuel));
const fuelCapacityConverted = computed(() =>
    literToUserUnits(props.fuelCapacity),
);

const vehicleLabel = computed(
    () =>
        [props.truckMake, props.truckModel].filter(Boolean).join(" ") ||
        "Truck unavailable",
);

const realMinutesLeft = computed(() => {
    if (props.estimatedGameMinutes == null) return null;
    return Math.floor(props.estimatedGameMinutes / 20);
});

const realTimeLeft = computed(() => {
    if (realMinutesLeft.value == null) return "--";
    return formatMinutes(realMinutesLeft.value);
});

const realArrivalTime = computed(() => {
    if (realMinutesLeft.value == null) return "--";

    const arrival = new Date(
        localNow.value + realMinutesLeft.value * 60 * 1000,
    );
    return new Intl.DateTimeFormat([], {
        hour: "numeric",
        minute: "2-digit",
    }).format(arrival);
});

const fatigueValue = computed(() => {
    if (!props.gameConnected) return "--";
    const hours = Math.floor(props.restStopMinutes / 60);
    const minutes = props.restStopMinutes % 60;
    return `${hours}h ${minutes}m`;
});

const rewardValue = computed(() => {
    if (!props.hasActiveJob || !props.reward) return "--";
    return new Intl.NumberFormat([], {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(props.reward);
});

const cargoMassValue = computed(() => {
    if (!props.cargoMass) return "--";
    if (activeSettings.value.units === "metric") {
        return props.cargoMass >= 1000
            ? `${(props.cargoMass / 1000).toFixed(1)} t`
            : `${Math.round(props.cargoMass)} kg`;
    }

    const pounds = props.cargoMass * 2.20462;
    return pounds >= 2000
        ? `${(pounds / 2000).toFixed(1)} ton`
        : `${Math.round(pounds)} lb`;
});

const fuelPercent = computed(() =>
    props.fuelCapacity > 0
        ? Math.round((props.fuel / props.fuelCapacity) * 100)
        : 0,
);

const routeSummary = computed(() => {
    if (!props.isRouteActive) return "No active route";
    if (!props.hasActiveJob)
        return props.destinationName || "Pinned destination";
    return formatPlace(props.destinationCity, props.destinationCompany);
});

const sourceSummary = computed(() =>
    formatPlace(props.sourceCity, props.sourceCompany),
);
const destinationSummary = computed(() =>
    props.hasActiveJob
        ? formatPlace(props.destinationCity, props.destinationCompany)
        : props.destinationName || "--",
);

function formatPlace(city: string, company: string) {
    const parts = [city, company].filter((value) => value && value !== "0");
    return parts.length > 0 ? parts.join(" | ") : "--";
}

function formatMinutes(totalMinutes: number) {
    if (totalMinutes <= 0) return "0m";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}
</script>

<template>
    <aside
        class="dashboard-panel"
        :class="[
            { 'nav-bottom': navBarPosition === 'bottom' },
            `dashboard-${dashboardHorizontal}`,
            `dashboard-${dashboardVertical}`,
        ]"
    >
        <div class="dashboard-header">
            <div>
                <p class="eyebrow">TruckPilot Dashboard</p>
                <h2>{{ routeSummary }}</h2>
            </div>
        </div>

        <div class="dashboard-grid">
            <section class="dashboard-card dashboard-card-navigation">
                <div class="card-title-row">
                    <h3>Navigation</h3>
                    <Icon name="tabler:route-2" size="18" />
                </div>

                <div class="metric-grid">
                    <div class="metric">
                        <span class="metric-label">ETA</span>
                        <strong>{{ primaryEtaValue }}</strong>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Distance</span>
                        <strong>
                            {{ primaryDistanceDisplay ?? "--" }}
                            <span v-if="primaryDistanceDisplay != null">{{ distanceUnit }}</span>
                        </strong>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Real Time Left</span>
                        <strong>{{ realTimeLeft }}</strong>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Real Arrival</span>
                        <strong>{{ realArrivalTime }}</strong>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Fatigue</span>
                        <strong>{{ fatigueValue }}</strong>
                    </div>
                </div>
            </section>

            <section class="dashboard-card">
                <div class="card-title-row">
                    <h3>Job</h3>
                    <Icon name="tabler:briefcase-2" size="18" />
                </div>

                <div class="info-stack">
                    <div class="info-row">
                        <span>Cargo</span>
                        <strong>{{ hasActiveJob ? cargoName || "Attached trailer" : "--" }}</strong>
                    </div>
                    <div class="info-row">
                        <span>From</span>
                        <strong>{{ sourceSummary }}</strong>
                    </div>
                    <div class="info-row">
                        <span>To</span>
                        <strong>{{ destinationSummary }}</strong>
                    </div>
                    <div class="info-row">
                        <span>Reward</span>
                        <strong>{{ rewardValue }}</strong>
                    </div>
                    <div class="info-row">
                        <span>Mass</span>
                        <strong>{{ cargoMassValue }}</strong>
                    </div>
                </div>
            </section>

            <section class="dashboard-card">
                <div class="card-title-row">
                    <h3>Truck</h3>
                    <Icon name="tabler:truck" size="18" />
                </div>

                <div class="info-stack">
                    <div class="info-row">
                        <span>Model</span>
                        <strong>{{ vehicleLabel }}</strong>
                    </div>
                    <div class="info-row">
                        <span>Fuel</span>
                        <strong>
                            {{ fuelConverted }}/{{ fuelCapacityConverted }} {{ fuelUnit }}
                            <small>({{ fuelPercent }}%)</small>
                        </strong>
                    </div>
                    <div class="info-row">
                        <span>Truck Damage</span>
                        <strong>{{
                            truckDamage == null ? "--" : `${truckDamage}%`
                        }}</strong>
                    </div>
                    <div class="info-row">
                        <span>Trailer Damage</span>
                        <strong>{{
                            trailerAttached ? `${trailerDamage}%` : "No trailer"
                        }}</strong>
                    </div>
                </div>
            </section>
        </div>

        <div v-if="showResetRoute" class="dashboard-actions">
            <button
                class="action-btn secondary"
                @click="resetRoute"
            >
                <Icon name="material-symbols:close-rounded" size="18" />
                <span>Reset Route</span>
            </button>
        </div>
    </aside>
</template>

<style scoped lang="scss">
.dashboard-panel {
    position: absolute;
    top: calc(env(safe-area-inset-top) + var(--nav-bar-height, #{$game-info-bar-height}) + 10px);
    right: 78px;
    width: min(392px, calc(100vw - 170px));
    max-height: calc(100dvh - env(safe-area-inset-top) - 90px);
    overflow: auto;
    padding: 16px;
    border-radius: 22px;
    background:
        linear-gradient(180deg, rgba(18, 25, 35, 0.92), rgba(10, 16, 25, 0.88));
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(18px);
    color: #f5f8fb;
}

.dashboard-left {
    left: 88px;
    right: auto;
}

.dashboard-right {
    right: 78px;
    left: auto;
}

.dashboard-top {
    top: calc(env(safe-area-inset-top) + var(--nav-bar-height, #{$game-info-bar-height}) + 10px);
    bottom: auto;
    transform: none;
}

.dashboard-middle {
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
}

.dashboard-bottom {
    top: auto;
    bottom: 16px;
    transform: none;
}

.dashboard-panel.nav-bottom {
    top: calc(env(safe-area-inset-top) + 10px);
    max-height: calc(
        100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) -
            var(--nav-bar-height, #{$game-info-bar-height}) - 30px
    );
}

.dashboard-panel.nav-bottom.dashboard-top {
    top: calc(env(safe-area-inset-top) + 10px);
    bottom: auto;
    transform: none;
}

.dashboard-panel.nav-bottom.dashboard-middle {
    top: 50%;
    bottom: auto;
    transform: translateY(-50%);
}

.dashboard-panel.nav-bottom.dashboard-bottom {
    top: auto;
    bottom: calc(
        env(safe-area-inset-bottom) + var(--nav-bar-height, #{$game-info-bar-height}) + 24px
    );
    transform: none;
}

.dashboard-header {
    margin-bottom: 12px;
}

.eyebrow {
    margin: 0 0 4px;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.6;
}

.dashboard-header h2 {
    margin: 0;
    font-size: 1.18rem;
    line-height: 1.2;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.dashboard-card {
    padding: 13px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.dashboard-card-navigation {
    grid-column: 1 / -1;
}

.card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.card-title-row h3 {
    margin: 0;
    font-size: 0.94rem;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 10px;
}

.metric,
.info-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.metric-label,
.info-row span {
    font-size: 0.82rem;
    opacity: 0.64;
}

.metric strong,
.info-row strong {
    font-size: 1.08rem;
    line-height: 1.25;
}


.info-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.dashboard-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 14px;
    padding: 12px 14px;
    font-weight: 700;
}

.action-btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #f5f8fb;
}

@media (max-width: 800px) {
    .dashboard-panel {
        top: calc(env(safe-area-inset-top) + var(--nav-bar-height, #{$game-info-bar-height}) + 10px);
        right: 68px;
        width: min(350px, calc(100vw - 96px));
        max-height: calc(100dvh - env(safe-area-inset-top) - 92px);
        padding: 14px;
    }

    .dashboard-left {
        left: 74px;
    }

    .dashboard-panel.nav-bottom {
        top: calc(env(safe-area-inset-top) + 10px);
        max-height: calc(
            100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) -
                var(--nav-bar-height, #{$game-info-bar-height}) - 24px
        );
    }

    .dashboard-panel.nav-bottom.dashboard-middle {
        top: 50%;
        bottom: auto;
        transform: translateY(-50%);
    }

    .dashboard-panel.nav-bottom.dashboard-bottom {
        top: auto;
        bottom: calc(
            env(safe-area-inset-bottom) + var(--nav-bar-height, #{$game-info-bar-height}) + 20px
        );
        transform: none;
    }

    .dashboard-grid {
        grid-template-columns: 1fr;
    }

    .dashboard-actions {
        flex-direction: column;
    }
}
</style>
