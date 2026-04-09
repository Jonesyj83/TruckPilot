<script lang="ts" setup>
const props = defineProps<{
    gameConnected: boolean;
    isRouteActive: boolean;
    hasActiveJob: boolean;
    destinationName: string;
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
}>();

const { activeSettings } = useSettings();
const {
    literToUserUnits,
    fuelUnit,
} = useUnitConversion();

const fuelConverted = computed(() => literToUserUnits(props.fuel));
const fuelCapacityConverted = computed(() =>
    literToUserUnits(props.fuelCapacity),
);

const vehicleLabel = computed(
    () =>
        [props.truckMake, props.truckModel].filter(Boolean).join(" ") ||
        "Truck unavailable",
);

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
</script>

<template>
    <aside class="dashboard-panel dashboard-left dashboard-top">
        <div class="dashboard-header">
            <div>
                <p class="eyebrow">TruckPilot Dashboard</p>
                <h2>{{ routeSummary }}</h2>
            </div>
        </div>

        <div class="dashboard-grid">
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
    right: var(--dashboard-right-clearance, 78px);
    width: min(
        392px,
        calc(
            100vw - var(--dashboard-left-clearance, 88px) -
                var(--dashboard-right-clearance, 78px) - 10px
        )
    );
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
    left: var(--dashboard-left-clearance, 88px);
    right: auto;
}

.dashboard-right {
    right: var(--dashboard-right-clearance, 78px);
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

.info-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.info-row span {
    font-size: 0.82rem;
    opacity: 0.64;
}

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
        right: var(--dashboard-right-clearance, 60px);
        width: min(
            300px,
            calc(
                100vw - var(--dashboard-left-clearance, 60px) -
                    var(--dashboard-right-clearance, 60px) - 8px
            )
        );
        max-height: calc(
            100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) -
                var(--nav-bar-height, #{$game-info-bar-height}) - 36px
        );
        padding: 12px;
        border-radius: 18px;
    }

    .dashboard-left {
        left: var(--dashboard-left-clearance, 60px);
    }

    .dashboard-panel.nav-bottom {
        top: calc(env(safe-area-inset-top) + 10px);
        max-height: calc(
            100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) -
                var(--nav-bar-height, #{$game-info-bar-height}) - 20px
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
        gap: 8px;
    }

    .dashboard-header {
        margin-bottom: 10px;
    }

    .eyebrow {
        margin-bottom: 3px;
        font-size: 0.68rem;
        letter-spacing: 0.14em;
    }

    .dashboard-header h2 {
        font-size: 1.02rem;
    }

    .dashboard-card {
        padding: 11px;
        border-radius: 16px;
    }

    .card-title-row {
        margin-bottom: 9px;
    }

    .card-title-row h3 {
        font-size: 0.88rem;
    }

    .info-row {
        gap: 3px;
    }

    .info-row span {
        font-size: 0.76rem;
    }

    .info-row strong {
        font-size: 0.96rem;
        line-height: 1.18;
    }

    .info-stack {
        gap: 8px;
    }

    .dashboard-actions {
        flex-direction: column;
        margin-top: 10px;
    }

    .action-btn {
        padding: 10px 12px;
        border-radius: 12px;
    }
}

@media (max-width: 800px) and (orientation: portrait) {
    .dashboard-panel {
        top: calc(env(safe-area-inset-top) + var(--nav-bar-height, #{$game-info-bar-height}) + 8px);
        width: min(
            272px,
            calc(
                100vw - var(--dashboard-left-clearance, 60px) -
                    var(--dashboard-right-clearance, 60px) - 8px
            )
        );
    }

    .dashboard-panel.nav-bottom {
        top: calc(env(safe-area-inset-top) + 8px);
    }
}
</style>
