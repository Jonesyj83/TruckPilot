<script lang="ts" setup>
import { ref, onMounted, shallowRef, Transition } from "vue";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { usePlatform } from "~/composables/Platform";
import eruda from "eruda";
import { blendWithBg, lightenColor } from "~/assets/utils/shared/colors";
import { generateTruckIcon } from "~/assets/utils/map/markers";

defineProps<{ goHome: () => void }>();

// MAP STATE
const mapEl = shallowRef<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);
const isSettingsPanelOpened = ref(false);
const isClickingEnabled = ref(true);

// JOB STATE
const currentJobKey = ref<string>("");

// NOTIFICATION TRIGGERS
const clickingNotificationTrigger = ref(0);

//
//
//// ======> COMPOSABLES <======

//
//
// Telemetry Data
const {
    startTelemetry,
    stopTelemetry,
    gameTime,
    gameConnected,
    truckCoords,
    truckSpeed,
    speedLimit,
    truckHeading,
    fuel,
    fuelCapacity,
    estimatedGameMinutes,
    estimatedDistanceKm,
    restStoptime,
    restStopMinutes,
    hasInGameMarker,
    hasActiveJob,
    cargoName,
    cargoMass,
    income,
    sourceCity,
    sourceCompany,
    destinationCity,
    destinationCompany,
    truckMake,
    truckModel,
    truckDamage,
    trailerDamage,
    trailerAttached,
    blinkerLeftActive,
    blinkerRightActive,
    headlightsOn,
    highBeamsOn,
} = useEtsTelemetry();

//
//
// Map Areas Data
const { loadLocationData, findDestinationCoords } = useCityData();

//
//
// Check Platform
const { isElectron, isMobile, isWeb } = usePlatform();

//
//
// Graph manipulation
const {
    loading,
    progress,
    adjacency,
    nodeCoords,
    initializeGraphData,
    getClosestNodes,
} = useGraphSystem();

//
//
// Maplibre Camera
const {
    isCameraLocked,
    isNavigating,
    initCameraListeners,
    followTruck,
    setNavigationActive,
    startNavigationMode,
    stopNavigationMode,
    lockCamera,
    initMarker,
    updateMarkerImage,
} = useMapCamera(map);

//
//
// Route Controller
const {
    setupRouteLayer,
    handleRouteClick,
    updateRouteProgress,
    clearRouteState,
    destinationName,
    routeDistance,
    routeEta,
    nextTurnInstruction,
    isCalculating: isCalculatingRoute,
    isWorkerReady,
    initWorkerData,
    destroyWorker,
    isRouteActive,
    routeFound,
    getSnappedCoords,
} = useRouteController(map, adjacency, nodeCoords);

//
//
// Settings Controller
const { activeSettings } = useSettings();
const isTruckMoving = computed(() => truckSpeed.value > 1);
const isCustomRouteOverride = ref(false);
const showResetRoute = computed(
    () => isRouteActive.value && (!hasActiveJob.value || isCustomRouteOverride.value),
);

const NAV_BAR_SIZE_METRICS = {
    default: { height: "52px", scale: 1.1 },
    large: { height: "58px", scale: 1.2 },
    xlarge: { height: "64px", scale: 1.3 },
    xxlarge: { height: "70px", scale: 1.4 },
} as const;

const navBarLayoutVars = computed(() => {
    const metrics =
        NAV_BAR_SIZE_METRICS[activeSettings.value.navBarSize ?? "default"];

    return {
        "--nav-bar-height": metrics.height,
        "--nav-scale": String(metrics.scale),
    };
});

let uiTimer: ReturnType<typeof setTimeout> | null = null;
let routeTimer: ReturnType<typeof setTimeout> | null = null;

// Forcing loading screen before mounting elements to prevent flashing between game changes
loading.value = true;
progress.value = 0;

// We check if it has active job, if it has one, plot a route
watch(
    [
        hasActiveJob,
        destinationCity,
        destinationCompany,
        gameConnected,
        loading,
        isWorkerReady,
    ],
    async ([hasJob, city, company, isConnected, isLoading, isWorkerReady]) => {
        if (isLoading || !isWorkerReady) return;

        if (!isConnected) {
            currentJobKey.value = "";
            return;
        }

        if (
            !truckCoords.value ||
            (truckCoords.value[0] === 0 && truckCoords.value[1] === 0)
        ) {
            return;
        }

        const newJobKey = hasJob ? `${city}|${company}` : "";

        if (routeTimer) clearTimeout(routeTimer);

        routeTimer = setTimeout(async () => {
            if (hasJob && newJobKey !== currentJobKey.value) {
                if (!truckCoords.value) return;
                const destCoords = findDestinationCoords(city, company);

                if (destCoords) {
                    clearRouteState();
                    isClickingEnabled.value = false;
                    isCustomRouteOverride.value = false;
                    currentJobKey.value = newJobKey;

                    await handleRouteClick(
                        destCoords,
                        truckCoords.value,
                        truckHeading.value,
                        false,
                    );
                }
            }
        }, 500);

        if (!hasJob && currentJobKey.value !== "") {
            clearRouteState();
            currentJobKey.value = "";
        }
    },
);

watch(
    [hasActiveJob, gameConnected, loading, isWorkerReady],
    ([hasJob, isGameConnected, isLoading, isWorkerReady]) => {
        if (!isLoading && isWorkerReady && isGameConnected && !hasJob) {
            const destination = activeSettings.value.lastDestination;

            if (destination && truckCoords.value) {
                clearRouteState();
                isCustomRouteOverride.value = true;

                handleRouteClick(
                    destination,
                    truckCoords.value,
                    truckHeading.value,
                    true,
                );
            }
        }
    },
);

// We check each time the theme color changes to udate the map libre appsettings.default theme color
watch(
    () => activeSettings.value.themeColor,
    async (newColor) => {
        if (!map.value) return;

        const newTruckImg = await generateTruckIcon(newColor);
        updateMarkerImage(newTruckImg.src);

        if (map.value.getLayer("prefab-zones")) {
            const blended = blendWithBg(lightenColor(newColor, 0.3), 0.6);
            map.value.setPaintProperty("prefab-zones", "fill-color", blended);
        }
    },
);

// We set the routeFound back to null with a delay if its true / false.
watch(routeFound, (newVal) => {
    if (newVal !== null) {
        if (uiTimer) clearTimeout(uiTimer);

        uiTimer = setTimeout(() => {
            routeFound.value = null;
        }, 1000);
    }
});

// When loaded, checks gameConnected -> show map
watch([loading, gameConnected], ([isLoading, isGameConnected]) => {
    if (!isLoading) {
        setTimeout(() => {
            isCameraLocked.value = true;
        }, 100);

        if (isGameConnected) {
            setTimeout(() => {
                isCameraLocked.value = true;
            }, 500);
        }
    }
});

watch(gameConnected, (isConnected) => {
    if (!map.value) return;
    if (!isConnected) {
        isCameraLocked.value = false;
        stopNavigationMode();
        clearRouteState();
    }
});

watch(
    () => isRouteActive.value,
    (hasRoute) => {
        setNavigationActive(hasRoute);
        if (!hasRoute) {
            stopNavigationMode();
        }
    },
);

watch(
    isTruckMoving,
    (moving, wasMoving) => {
        if (!isRouteActive.value || !truckCoords.value) return;

        if (moving && !wasMoving) {
            startNavigationMode(truckCoords.value, truckHeading.value);
            return;
        }

        if (!moving && isCameraLocked.value) {
            isCameraLocked.value = false;
        }
    },
);

onMounted(async () => {
    // eruda.init(); // KEEP FOR DEBUGGING MOBILE
    await loadLocationData();
    if (!mapEl.value) return;
    if (isElectron.value) {
        (window as any).electronAPI.setWindowSize(900, 600, true, true);
    }

    try {
        const mapInstance = await initializeMap(mapEl.value);
        map.value = markRaw(mapInstance);
        if (!map.value) return;

        const initialTruckImg = await generateTruckIcon(
            activeSettings.value.themeColor,
        );
        map.value.on("load", async () => {
            initMarker(initialTruckImg.src);
            const graphData = await initializeGraphData();
            if (!graphData) return;
            const { nodes, edges } = graphData;
            initWorkerData(nodes, edges);

            setupRouteLayer();
            initCameraListeners();
        });

        map.value.on("click", async (e) => {
            const features = map.value!.queryRenderedFeatures(e.point, {
                layers: ["destination-layer"],
            });
            if (features.length > 0) return;

            console.log(
                ` ${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`,
            ); // KEEP FOR DEBUGGING BUGGED AREAS
            if (!isClickingEnabled.value) return;
            if (!gameConnected.value) return;
            if (!truckCoords.value) return;

            await handleRouteClick(
                [e.lngLat.lng, e.lngLat.lat],
                truckCoords.value,
                truckHeading.value,
                true,
            );
            isCustomRouteOverride.value = true;
        });

        startTelemetry(() => {
            onTelemetryUpdate();
        });
    } catch (e) {
        console.error(e);
    }
});

onUnmounted(() => {
    stopTelemetry();
    destroyWorker();

    if (routeTimer) clearTimeout(routeTimer);
    if (uiTimer) clearTimeout(uiTimer);

    if (map.value) {
        map.value.remove();
        map.value = null;
    }
});

function onTelemetryUpdate() {
    if (!truckCoords.value || !map.value) return;

    const snappedCoords = getSnappedCoords(
        truckCoords.value,
        truckHeading.value,
    );

    followTruck(snappedCoords, truckHeading.value);

    if (isRouteActive.value && isTruckMoving.value && !isCameraLocked.value) {
        startNavigationMode(snappedCoords, truckHeading.value);
    }

    if (isRouteActive.value) {
        updateRouteProgress(snappedCoords, truckHeading.value);
    }
}

function toggleEnableClicking() {
    isClickingEnabled.value = !isClickingEnabled.value;

    clickingNotificationTrigger.value++;
}

async function resetAppRoute() {
    clearRouteState();
    isCustomRouteOverride.value = false;

    if (!hasActiveJob.value || !truckCoords.value) {
        currentJobKey.value = "";
        return;
    }

    const jobKey = `${destinationCity.value}|${destinationCompany.value}`;
    const destCoords = findDestinationCoords(
        destinationCity.value,
        destinationCompany.value,
    );

    if (!destCoords) {
        currentJobKey.value = "";
        return;
    }

    currentJobKey.value = jobKey;
    await handleRouteClick(
        destCoords,
        truckCoords.value,
        truckHeading.value,
        false,
    );
}

const onResetNorth = () => {
    map.value?.easeTo({
        bearing: 0,
        pitch: 0,
        duration: 500,
    });
};

const onToggleFullscreen = async () => {
    const target = document.documentElement;

    try {
        if (!document.fullscreenElement) {
            await target.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        }

        setTimeout(() => {
            map.value?.resize();
        }, 100);
    } catch (err) {
        console.error("Fullscreen error:", err);
    }
};

const toggleSettingsPanel = () => {
    isSettingsPanelOpened.value = !isSettingsPanelOpened.value;
};
</script>

<template>
    <div
        ref="wrapperEl"
        class="full-page-wrapper"
        :class="{ 'platform-mobile': isMobile }"
    >
        <div ref="mapEl" class="map-container"></div>

        <div class="ui-safe-container">
            <Transition name="ui-layer-fade">
                <div
                    v-show="!isSettingsPanelOpened"
                    class="map-ui-layer"
                    :class="{ 'nav-bottom': activeSettings.navBarPosition === 'bottom' }"
                    :style="navBarLayoutVars"
                >
                    <Transition name="fade">
                        <LoadingScreen v-if="loading" :progress="progress" />
                    </Transition>

                    <TopBar
                        :fuel="fuel"
                        :fuel-capacity="fuelCapacity"
                        :game-connected="gameConnected"
                        :game-time="gameTime"
                        :rest-stop-minutes="restStopMinutes"
                        :rest-stop-time="restStoptime"
                        :speed-limit="speedLimit"
                        :truck-speed="truckSpeed"
                        :is-web="isWeb"
                        :position="activeSettings.navBarPosition"
                        :blinker-left-active="blinkerLeftActive"
                        :blinker-right-active="blinkerRightActive"
                        :headlights-on="headlightsOn"
                        :high-beams-on="highBeamsOn"
                        :is-route-active="isRouteActive"
                        :next-turn-instruction="nextTurnInstruction"
                    />

                    <div class="left-buttons">
                        <HudButton
                            icon-name="material-symbols:arrow-back-rounded"
                            :onClick="goHome"
                        />
                        <HudButton
                            icon-name="flowbite:cog-outline"
                            :onClick="toggleSettingsPanel"
                        />
                    </div>

                    <NotificationGeneral
                        :icon-name="
                            isClickingEnabled
                                ? 'i-tabler:hand-click'
                                : 'i-tabler:hand-click-off'
                        "
                        :trigger="clickingNotificationTrigger"
                        :text="
                            isClickingEnabled
                                ? 'Tapping Enabled'
                                : 'Tapping Disabled'
                        "
                        :icon-color="isClickingEnabled ? '#4caf50' : '#dd4a34'"
                    />

                    <NotificationRoute
                        :is-route-found="routeFound"
                        :is-calculating-route="isCalculatingRoute"
                    />

                    <div class="hud-buttons">
                        <HudButton
                            v-if="isWeb"
                            icon-name="gridicons:fullscreen"
                            :onClick="onToggleFullscreen"
                        />
                        <HudButton
                            icon-name="ix:navigation"
                            :onClick="onResetNorth"
                        />
                        <HudButton
                            icon-name="fe:target"
                            :onClick="lockCamera"
                        />
                        <HudButton
                            :class="
                                isClickingEnabled ? 'red-icon' : 'green-icon'
                            "
                            :icon-name="
                                isClickingEnabled
                                    ? 'i-tabler:hand-click-off'
                                    : 'i-tabler:hand-click'
                            "
                            :onClick="toggleEnableClicking"
                        />
                    </div>

                    <div
                        class="warnings"
                        :class="{ 'nav-bottom': activeSettings.navBarPosition === 'bottom' }"
                    >
                        <WarningSlide
                            :show-if="hasInGameMarker && !isRouteActive"
                            :reset-on="isRouteActive"
                            text="External Route Detected: Set Waypoint"
                        />

                        <WarningSlide
                            :show-if="!gameConnected"
                            :reset-on="gameConnected"
                            text="Game Offline"
                        />
                    </div>

                    <DashboardPanel
                        :game-connected="gameConnected"
                        :is-route-active="isRouteActive"
                        :has-active-job="hasActiveJob"
                        :destination-name="destinationName"
                        :route-distance="routeDistance"
                        :route-eta="routeEta"
                        :estimated-game-minutes="estimatedGameMinutes"
                        :estimated-distance-km="estimatedDistanceKm"
                        :rest-stop-minutes="restStopMinutes"
                        :fuel="fuel"
                        :fuel-capacity="fuelCapacity"
                        :truck-make="truckMake"
                        :truck-model="truckModel"
                        :truck-damage="truckDamage"
                        :trailer-damage="trailerDamage"
                        :trailer-attached="trailerAttached"
                        :cargo-name="cargoName"
                        :cargo-mass="cargoMass"
                        :source-city="sourceCity"
                        :source-company="sourceCompany"
                        :destination-city="destinationCity"
                        :destination-company="destinationCompany"
                        :reward="income"
                        :show-reset-route="showResetRoute"
                        :reset-route="resetAppRoute"
                        :nav-bar-position="activeSettings.navBarPosition"
                        :dashboard-horizontal="
                            activeSettings.routeGuidanceHorizontal
                        "
                        :dashboard-vertical="
                            activeSettings.routeGuidanceVertical
                        "
                    />
                </div>
            </Transition>

            <Transition name="panel-pop">
                <SettingsPanel
                    v-show="isSettingsPanelOpened"
                    :close-panel="toggleSettingsPanel"
                />
            </Transition>
        </div>
    </div>
</template>

<style scoped lang="scss" src="~/assets/scss/scoped/map/map.scss"></style>
