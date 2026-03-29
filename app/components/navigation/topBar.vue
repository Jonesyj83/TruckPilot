<script lang="ts" setup>
const props = defineProps<{
    truckSpeed: number;
    speedLimit: number;
    gameConnected: boolean;
    fuel: number;
    fuelCapacity: number;
    restStopMinutes: number;
    restStopTime: string;
    gameTime: string;
    isWeb: boolean;
    position: "top" | "bottom";
    blinkerLeftActive: boolean;
    blinkerRightActive: boolean;
    headlightsOn: boolean;
    highBeamsOn: boolean;
    isRouteActive: boolean;
    nextTurnInstruction: string;
}>();

const { kmToUserUnits, literToUserUnits, speedUnit, fuelUnit } =
    useUnitConversion();

const truckSpeedConverted = computed(() => kmToUserUnits(props.truckSpeed));
const speedLimitConverted = computed(() => kmToUserUnits(props.speedLimit));
const fuelConverted = computed(() => literToUserUnits(props.fuel));
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
</script>

<template>
    <div
        class="game-information"
        :class="[
            { 'is-native': !isWeb, 'position-bottom': position === 'bottom' },
        ]"
    >
        <div class="topbar-left">
            <div class="speed-readout" :class="{ 'is-over': isOverSpeedLimit }">
                <span class="speed-label">Speed</span>
                <strong class="speed-value">{{ truckSpeedConverted }}</strong>
                <span class="speed-unit">{{ speedUnit }}</span>
            </div>

            <div
                v-if="gameConnected && speedLimit > 0"
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

        <div v-if="gameConnected" class="topbar-right">
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

            <div class="status-chip sleep-chip">
                <div class="sleep-div">
                    <Icon
                        name="solar:moon-sleep-bold"
                        class="sleep-icon"
                        :class="{ 'pulse-blue': restStopMinutes < 90 }"
                    />
                    <p>{{ restStopTime }}</p>
                </div>
            </div>

            <div class="status-chip time-chip">
                <p class="game-time">{{ gameTime }}</p>
            </div>

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
                    name="tabler:bulb"
                    class="signal-icon light-icon"
                    :class="{ active: headlightsOn }"
                />
                <Icon
                    name="tabler:brightness-up"
                    class="signal-icon highbeam-icon"
                    :class="{ active: highBeamsOn }"
                />
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
</template>

<style
    lang="scss"
    scoped
    src="~/assets/scss/scoped/navigation/topBar.scss"
></style>
