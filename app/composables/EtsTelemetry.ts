import { CapacitorHttp } from "@capacitor/core";
import { DEFAULT_TELEMETRY_ENDPOINT } from "~/composables/Settings";
import {
    getGameState,
    getNavigationState,
    getTruckState,
    verifyGameByTruck,
} from "~/assets/utils/telemetry/helpers";
import type {
    TruckState,
    GameState,
    NavigationState,
    JobState,
    TelemetryUpdate,
    TelemetryData,
} from "~/types";

const isTelemetryConnected = ref(false);
const isRunning = ref(false);
let currentSessionId = 0;

const truckState = reactive<TruckState>({
    truckCoords: [0, 0],
    truckHeading: 0,
    truckSpeed: 0,
    truckMake: "",
    truckModel: "",
    fuelCapacity: 0,
    truckDamage: null,
    trailerDamage: 0,
    trailerAttached: false,
    blinkerLeftActive: false,
    blinkerRightActive: false,
    headlightsOn: false,
    highBeamsOn: false,
});

const gameState = reactive<GameState>({
    gameTime: "",
    gameConnected: false,
    hasInGameMarker: false,
});

const navigationState = reactive<NavigationState>({
    fuel: 0,
    speedLimit: 0,
    restStoptime: "",
    restStopMinutes: 0,
    estimatedGameMinutes: null,
    estimatedDistanceKm: null,
});

const jobState = reactive<JobState>({
    hasActiveJob: false,
    income: 0,
    deadlineTime: new Date(),
    remainingTime: new Date(),
    sourceCity: "0",
    sourceCompany: "0",
    destinationCity: "0",
    destinationCompany: "0",
    cargoName: "",
    cargoMass: 0,
});

let lastPosition: [number, number] | null = null;
let headingOffset = 0;

let fetchTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

function safeString(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return "";
}

function safeNumber(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
}

function safeOptionalNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPrimaryTrailer(data: any) {
    const trailers = Array.isArray(data?.trailers) ? data.trailers : [];
    return (
        trailers.find((trailer: any) => trailer?.attached) ||
        data?.trailer ||
        trailers[0] ||
        null
    );
}

function getTrailerWear(trailer: any) {
    return Math.max(
        safeNumber(trailer?.wear, 0),
        safeNumber(trailer?.wearChassis, 0),
        safeNumber(trailer?.wearWheels, 0),
        safeNumber(trailer?.wearBody, 0),
        safeNumber(trailer?.cargoDamage, 0),
    );
}

function getTruckDamagePercent(truck: TelemetryData["truck"]) {
    const wears = [
        truck.wearEngine,
        truck.wearTransmission,
        truck.wearCabin,
        truck.wearChassis,
        truck.wearWheels,
    ];

    if (wears.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        return null;
    }

    return Math.round(Math.max(...wears) * 100);
}

function normalizeTelemetryPayload(raw: any): TelemetryData | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const data = raw?.telemetry ?? raw;
    if (!data || typeof data !== "object") {
        return null;
    }

    if (!data?.game || !data?.truck || !data?.navigation || !data?.job) {
        return null;
    }

    const primaryTrailer = getPrimaryTrailer(data);
    const normalizedTrailer = {
        attached: !!primaryTrailer?.attached,
        id: safeString(primaryTrailer?.id),
        name: safeString(primaryTrailer?.name),
        mass: safeNumber(primaryTrailer?.mass, data?.job?.cargoMass, 0),
        wear: getTrailerWear(primaryTrailer),
        placement: {
            x: safeNumber(primaryTrailer?.placement?.x, 0),
            y: safeNumber(primaryTrailer?.placement?.y, 0),
            z: safeNumber(primaryTrailer?.placement?.z, 0),
            heading: safeNumber(primaryTrailer?.placement?.heading, 0),
            pitch: safeNumber(primaryTrailer?.placement?.pitch, 0),
            roll: safeNumber(primaryTrailer?.placement?.roll, 0),
        },
        wearChassis: safeNumber(primaryTrailer?.wearChassis, 0),
        wearWheels: safeNumber(primaryTrailer?.wearWheels, 0),
        wearBody: safeNumber(primaryTrailer?.wearBody, 0),
        cargoDamage: safeNumber(primaryTrailer?.cargoDamage, 0),
    };

    return {
        game: {
            connected: !!data.game.connected,
            gameName: safeString(data.game.gameName),
            paused: !!data.game.paused,
            time: safeString(data.game.time),
            timeScale: safeNumber(data.game.timeScale, 0),
            nextRestStopTime: safeString(data.game.nextRestStopTime),
            version: safeString(data.game.version, data.game.serverVersion),
            serverVersion: safeString(data.game.serverVersion),
            telemetryPluginVersion: safeString(data.game.telemetryPluginVersion),
        },
        truck: {
            ...data.truck,
            make: safeString(data.truck.make),
            model: safeString(data.truck.model),
            id: safeString(data.truck.id),
            fuel: safeNumber(data.truck.fuel, 0),
            fuelCapacity: safeNumber(data.truck.fuelCapacity, 0),
            wearEngine: safeOptionalNumber(data.truck.wearEngine) ?? undefined,
            wearTransmission:
                safeOptionalNumber(data.truck.wearTransmission) ?? undefined,
            wearCabin: safeOptionalNumber(data.truck.wearCabin) ?? undefined,
            wearChassis: safeOptionalNumber(data.truck.wearChassis) ?? undefined,
            wearWheels: safeOptionalNumber(data.truck.wearWheels) ?? undefined,
            speed: safeNumber(data.truck.speed, 0),
            placement: {
                x: safeNumber(data.truck.placement?.x, 0),
                y: safeNumber(data.truck.placement?.y, 0),
                z: safeNumber(data.truck.placement?.z, 0),
                heading: safeNumber(data.truck.placement?.heading, 0),
                pitch: safeNumber(data.truck.placement?.pitch, 0),
                roll: safeNumber(data.truck.placement?.roll, 0),
            },
        },
        trailer: normalizedTrailer,
        trailers: Array.isArray(data.trailers) ? data.trailers : undefined,
        job: {
            income: safeNumber(data.job.income, 0),
            deadlineTime: safeString(data.job.deadlineTime),
            remainingTime: safeString(data.job.remainingTime),
            sourceCity: safeString(data.job.sourceCity, "0"),
            sourceCityId: safeString(data.job.sourceCityId),
            sourceCompany: safeString(
                data.job.sourceCompany,
                data.job.sourceCompanyId,
                "0",
            ),
            sourceCompanyId: safeString(data.job.sourceCompanyId),
            destinationCity: safeString(data.job.destinationCity, "0"),
            destinationCityId: safeString(data.job.destinationCityId),
            destinationCompany: safeString(
                data.job.destinationCompany,
                data.job.destinationCompanyId,
                "0",
            ),
            destinationCompanyId: safeString(data.job.destinationCompanyId),
            cargoId: safeString(data.job.cargoId),
            cargo: safeString(data.job.cargo, normalizedTrailer.name),
            cargoMass: safeNumber(data.job.cargoMass, normalizedTrailer.mass, 0),
            plannedDistanceKm: safeNumber(data.job.plannedDistanceKm, 0),
            unitCount: safeNumber(data.job.unitCount, 0),
            jobMarket: safeString(data.job.jobMarket),
        },
        navigation: {
            estimatedTime: safeString(data.navigation.estimatedTime),
            estimatedDistance: safeNumber(
                data.navigation.estimatedDistance,
                safeNumber(data.job.plannedDistanceKm, 0) * 1000,
            ),
            speedLimit: safeNumber(data.navigation.speedLimit, 0),
        },
        gameplay: data.gameplay,
    };
}

function getTelemetryEndpoint(
    settings: ReturnType<typeof useSettings>["settings"]["value"],
) {
    const endpoint = settings.telemetryEndpoint?.trim();
    return endpoint || DEFAULT_TELEMETRY_ENDPOINT;
}

function parseGameNavigationMinutes(value: string | null | undefined) {
    if (!value) return null;

    const absoluteDateMatch = value.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?Z?$/i,
    );
    if (absoluteDateMatch) {
        const dayOfMonth = Number(absoluteDateMatch[3] ?? 1);
        const hours = Number(absoluteDateMatch[4] ?? 0);
        const minutes = Number(absoluteDateMatch[5] ?? 0);
        const days = Math.max(0, dayOfMonth - 1);
        return days * 1440 + hours * 60 + minutes;
    }

    const isoMatch = value.match(
        /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i,
    );
    if (isoMatch) {
        const days = Number(isoMatch[1] ?? 0);
        const hours = Number(isoMatch[2] ?? 0);
        const minutes = Number(isoMatch[3] ?? 0);
        return days * 1440 + hours * 60 + minutes;
    }

    const dotMatch = value.match(/^(\d+)\.(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (dotMatch) {
        const days = Number(dotMatch[1] ?? 0);
        const hours = Number(dotMatch[2] ?? 0);
        const minutes = Number(dotMatch[3] ?? 0);
        return days * 1440 + hours * 60 + minutes;
    }

    const colonMatch = value.match(/^(\d{1,3}):(\d{2})(?::\d{2})?$/);
    if (colonMatch) {
        const hours = Number(colonMatch[1] ?? 0);
        const minutes = Number(colonMatch[2] ?? 0);
        return hours * 60 + minutes;
    }

    return null;
}

export function useEtsTelemetry() {
    const { isElectron, isMobile, isWeb } = usePlatform();
    const { settings } = useSettings();

    async function fetchTelemetryData(): Promise<TelemetryData | null> {
        try {
            const endpoint = getTelemetryEndpoint(settings.value);

            if (isMobile.value) {
                const response = await CapacitorHttp.get({
                    url: endpoint,
                    connectTimeout: 1000,
                    readTimeout: 1000,
                });

                if (response.status === 200) {
                    return normalizeTelemetryPayload(response.data);
                }
            } else if (isElectron.value) {
                const hasElectronFetcher =
                    typeof (window as any).electronAPI?.fetchTelemetry ===
                    "function";

                if (hasElectronFetcher) {
                    const result = await (window as any).electronAPI.fetchTelemetry(
                        endpoint,
                    );
                    return normalizeTelemetryPayload(result);
                }
            }

            if (isWeb.value || isElectron.value) {
                if (abortController) abortController.abort();
                abortController = new AbortController();
                const timeoutId = setTimeout(
                    () => abortController?.abort(),
                    1000,
                );

                const requestUrl = isWeb.value ? "/api/ets2" : endpoint;
                const res = await fetch(requestUrl, {
                    signal: abortController.signal,
                    cache: "no-cache",
                    headers: isWeb.value
                        ? {
                              Pragma: "no-cache",
                              "x-telemetry-endpoint": endpoint,
                          }
                        : { Pragma: "no-cache" },
                });

                clearTimeout(timeoutId);

                if (res.ok) {
                    const result = await res.json();
                    return normalizeTelemetryPayload(result);
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError")
                console.log(err);
        }

        return null;
    }

    function startTelemetry(onUpdate?: (data: TelemetryUpdate) => void) {
        if (isRunning.value) return;

        isRunning.value = true;
        currentSessionId++;
        const mySessionId = currentSessionId;

        const loop = async () => {
            if (!isRunning.value || currentSessionId !== mySessionId) return;

            const startTime = performance.now();
            let nextTickDelay = 100;

            const data = await fetchTelemetryData();

            if (data && data.game?.connected) {
                const apiGame = verifyGameByTruck(
                    data.truck.id,
                    data.truck.model,
                    data.game.gameName,
                );

                if (apiGame === settings.value.selectedGame) {
                    isTelemetryConnected.value = true;
                    processData(data, onUpdate);
                    nextTickDelay = 100;
                } else {
                    isTelemetryConnected.value = false;
                    resetDataOnDisconnected(onUpdate);
                    nextTickDelay = 4000;
                }
            } else {
                isTelemetryConnected.value = false;
                resetDataOnDisconnected(onUpdate);
                nextTickDelay = 1000;
            }

            const duration = performance.now() - startTime;
            const delay = Math.max(50, nextTickDelay - duration);

            if (isRunning.value && currentSessionId === mySessionId) {
                fetchTimer = setTimeout(loop, delay);
            }
        };

        loop();
    }

    function stopTelemetry() {
        isRunning.value = false;
        currentSessionId++;
        if (fetchTimer) clearTimeout(fetchTimer);
        if (abortController) abortController.abort();
        fetchTimer = null;
    }

    function processData(
        data: TelemetryData,
        onUpdate?: (data: TelemetryUpdate) => void,
    ) {
        const { gameConnected, hasInGameMarker, gameTime } = getGameState(data);
        Object.assign(gameState, {
            gameTime: gameTime,
            gameConnected: gameConnected,
            hasInGameMarker: hasInGameMarker,
        });

        const {
            truckCoords,
            truckSpeed,
            truckHeading,
            headingOffset: newOffset,
        } = getTruckState(
            data,
            lastPosition,
            settings.value.selectedGame,
            headingOffset,
        );
        Object.assign(truckState, {
            truckCoords: truckCoords,
            truckHeading: truckHeading,
            truckSpeed: truckSpeed,
            truckMake: data.truck.make,
            truckModel: data.truck.model,
            fuelCapacity: parseInt(data.truck.fuelCapacity.toFixed(1)),
            truckDamage: getTruckDamagePercent(data.truck),
            trailerDamage: data.trailer.attached
                ? Math.round(data.trailer.wear * 100)
                : 0,
            trailerAttached: data.trailer.attached,
            blinkerLeftActive: data.truck.blinkerLeftActive,
            blinkerRightActive: data.truck.blinkerRightActive,
            headlightsOn: data.truck.lightsBeamLowOn,
            highBeamsOn: data.truck.lightsBeamHighOn,
        });
        lastPosition = truckCoords;
        headingOffset = newOffset;

        const { fuel, speedLimit, restStoptime, restStopMinutes } =
            getNavigationState(data);
        Object.assign(navigationState, {
            restStoptime: restStoptime,
            restStopMinutes: restStopMinutes,
            speedLimit: speedLimit,
            fuel: fuel,
            estimatedGameMinutes: parseGameNavigationMinutes(
                data.navigation.estimatedTime,
            ),
            estimatedDistanceKm:
                typeof data.navigation.estimatedDistance === "number"
                    ? data.navigation.estimatedDistance / 1000
                    : null,
        });

        const hasActiveJob = data.job.income > 0;
        Object.assign(jobState, {
            hasActiveJob: hasActiveJob,
            income: data.job.income,
            sourceCity: data.job.sourceCity,
            sourceCompany: data.job.sourceCompany,
            destinationCity: data.job.destinationCity,
            destinationCompany: data.job.destinationCompany,
            cargoName: data.job.cargo || data.trailer.name,
            cargoMass:
                typeof data.job.cargoMass === "number"
                    ? data.job.cargoMass
                    : data.trailer.mass,
        });

        if (onUpdate) {
            onUpdate({
                truck: { ...truckState },
                game: { ...gameState },
                general: { ...navigationState },
                job: { ...jobState },
            });
        }
    }

    function resetDataOnDisconnected(
        onUpdate?: (data: TelemetryUpdate) => void,
    ) {
        const wasConnected = gameState.gameConnected;
        isTelemetryConnected.value = false;
        headingOffset = 0;

        Object.assign(gameState, {
            gameConnected: false,
            hasInGameMarker: false,
            gameTime: "",
        });

        Object.assign(truckState, {
            truckCoords: [0, 0],
            truckHeading: 0,
            truckSpeed: 0,
            truckMake: "",
            truckModel: "",
            fuelCapacity: 0,
            truckDamage: null,
            trailerDamage: 0,
            trailerAttached: false,
            blinkerLeftActive: false,
            blinkerRightActive: false,
            headlightsOn: false,
            highBeamsOn: false,
        });

        Object.assign(navigationState, {
            fuel: 0,
            speedLimit: 0,
            restStopMinutes: 0,
            restStoptime: "0",
            estimatedGameMinutes: null,
            estimatedDistanceKm: null,
        });

        Object.assign(jobState, {
            hasActiveJob: false,
            income: 0,
            sourceCity: "0",
            sourceCompany: "0",
            destinationCity: "0",
            destinationCompany: "0",
            cargoName: "",
            cargoMass: 0,
        });

        if (onUpdate && wasConnected) {
            onUpdate({
                truck: { ...truckState },
                game: { ...gameState },
                general: { ...navigationState },
                job: { ...jobState },
            });
        }
    }

    return {
        ...toRefs(navigationState),
        ...toRefs(truckState),
        ...toRefs(gameState),
        ...toRefs(jobState),
        startTelemetry,
        stopTelemetry,
    };
}
