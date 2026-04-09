<script lang="ts" setup>
const props = defineProps<{
    truckSpeed: number;
    speedLimit: number;
    gameConnected: boolean;
    fuel: number;
    fuelCapacity: number;
    routeEta: string;
    routeDistance: number;
    estimatedGameMinutes: number | null;
    estimatedDistanceKm: number | null;
    timeScale: number;
    restStopMinutes: number;
    restStopTime: string;
    gameTime: string;
    isWeb: boolean;
    blinkerLeftActive: boolean;
    blinkerRightActive: boolean;
    headlightsOn: boolean;
    highBeamsOn: boolean;
    isRouteActive: boolean;
    nextTurnInstruction: string;
}>();

const {
    kmToUserUnits,
    literToUserUnits,
    formatDistanceValue,
    speedUnit,
    distanceUnit,
    fuelUnit,
} =
    useUnitConversion();

const truckSpeedConverted = computed(() => kmToUserUnits(props.truckSpeed));
const speedLimitConverted = computed(() => kmToUserUnits(props.speedLimit));
const fuelConverted = computed(() => literToUserUnits(props.fuel));
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

const realMinutesLeft = computed(() => {
    if (props.estimatedGameMinutes == null) return null;
    if (!props.timeScale || props.timeScale <= 0) return null;
    return Math.max(1, Math.round(props.estimatedGameMinutes / props.timeScale));
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

const fuelPercent = computed(() =>
    props.fuelCapacity > 0
        ? Math.max(
              0,
              Math.min(100, Math.round((props.fuel / props.fuelCapacity) * 100)),
          )
        : 0,
);
const fuelSegments = computed(() =>
    Array.from({ length: 8 }, (_, index) => ({
        active: fuelPercent.value >= ((index + 1) / 8) * 100,
        tone: index < 2 ? "danger" : index < 4 ? "warn" : "good",
    })),
);
const isLowFuel = computed(() => fuelPercent.value < 20);
const isOverSpeedLimit = computed(
    () =>
        props.gameConnected &&
        props.speedLimit > 0 &&
        props.truckSpeed > props.speedLimit,
);

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
    <div
        class="hud-shell"
        :class="{ 'is-native': !isWeb }"
    >
        <div class="game-information game-information-top">
            <div v-if="gameConnected" class="topbar-status">
                <div class="topbar-status-left">
                    <div class="status-chip route-summary-chip">
                        <span class="route-summary-label">ETA</span>
                        <strong class="route-summary-value">{{ primaryEtaValue }}</strong>

                        <span class="route-summary-dot" aria-hidden="true">·</span>

                        <span class="route-summary-label">Dist</span>
                        <strong class="route-summary-value">{{ primaryDistanceDisplay ?? "--" }}<span v-if="primaryDistanceDisplay != null"> {{ distanceUnit }}</span></strong>

                        <span class="route-summary-divider" aria-hidden="true"></span>

                        <span class="route-summary-label">REAL ETA</span>
                        <strong class="route-summary-value">{{ realArrivalTime }}</strong>

                        <span class="route-summary-dot" aria-hidden="true">·</span>

                        <span class="route-summary-label">IN</span>
                        <strong class="route-summary-value">{{ realTimeLeft }}</strong>
                    </div>
                </div>

                <div class="topbar-status-right">
                    <div class="status-chip fuel-chip">
                        <div class="fuel-amount">
                            <Icon
                                name="bi:fuel-pump-fill"
                                :class="{ 'pulse-red': isLowFuel }"
                            />
                            <p>
                                {{ fuelConverted
                                }}<span class="liters">{{ fuelUnit }}</span>
                            </p>
                        </div>
                        <div class="fuel-gauge" aria-hidden="true">
                            <span
                                v-for="(segment, index) in fuelSegments"
                                :key="index"
                                class="fuel-segment"
                                :class="[
                                    segment.tone,
                                    { active: segment.active, 'is-low': isLowFuel },
                                ]"
                            />
                        </div>
                    </div>

                    <div class="status-chip time-chip">
                        <p class="game-time">{{ gameTime }}</p>
                    </div>

                    <div class="status-chip rest-chip">
                        <span class="limit-label">Rest</span>
                        <strong class="limit-value">{{ fatigueValue }}</strong>
                    </div>
                </div>
            </div>

            <div v-else class="disconnected-div">
                <p class="disconnected-message">Game Offline</p>
                <Icon
                    name="streamline-ultimate:link-disconnected-bold"
                    class="disconnected-icon"
                />
            </div>
        </div>

        <div v-if="gameConnected" class="game-information game-information-bottom">
            <div class="topbar-left">
                <div class="speed-readout" :class="{ 'is-over': isOverSpeedLimit }">
                    <span class="speed-label">Speed</span>
                    <strong class="speed-value">{{ truckSpeedConverted }}</strong>
                    <span class="speed-unit">{{ speedUnit }}</span>
                </div>

                <div
                    v-if="speedLimit > 0"
                    class="speed-limit-badge"
                    :class="{ 'is-over': isOverSpeedLimit }"
                >
                    <span class="limit-label">LIMIT</span>
                    <strong class="limit-value">{{ speedLimitConverted }}</strong>
                </div>
            </div>

            <div class="topbar-center">
                <div
                    v-if="isRouteActive && nextTurnInstruction"
                    class="turn-guidance"
                >
                    <span class="turn-guidance-text">{{ nextTurnInstruction }}</span>
                </div>
            </div>

            <div class="topbar-right">
                <div class="status-chip signal-chip">
                    <Icon
                        name="tabler:arrow-left"
                        class="signal-icon turn-icon"
                        :class="{ active: blinkerLeftActive, flashing: blinkerLeftActive }"
                    />
                    <Icon
                        name="tabler:arrow-right"
                        class="signal-icon turn-icon"
                        :class="{ active: blinkerRightActive, flashing: blinkerRightActive }"
                    />
                    <Icon
                        name="mdi:car-light-dimmed"
                        class="signal-icon light-icon"
                        :class="{ active: headlightsOn }"
                    />
                    <Icon
                        name="mdi:car-light-high"
                        class="signal-icon highbeam-icon"
                        :class="{ active: highBeamsOn }"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/navigation/topBar.scss"
></style>
