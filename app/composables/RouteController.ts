import { distance, lineString, nearestPointOnLine, point } from "@turf/turf";
import maplibregl from "maplibre-gl";
import { generateDestinationIcon } from "~/assets/utils/map/markers";
import {
    convertGeoToAts,
    convertGeoToEts2,
} from "~/assets/utils/map/converters";
import {
    getBearing,
    getSqDistToSegment,
    DEVIATION_THRESHOLD_SQ,
    getSquaredDist,
    getSignedAngle,
} from "~/assets/utils/map/maths";
import type { SimpleCityNode } from "~/assets/utils/routing/algorithm";
import {
    deleteMapLibreData,
    setMapLibreData,
} from "~/assets/utils/map/helpers";

export const useRouteController = (
    map: Ref<maplibregl.Map | null>,
    adjacency: Map<number, { to: number; weight: number; r: number }[]>,
    nodeCoords: Map<number, [number, number]>,
) => {
    const MAX_NEXT_TURN_LOOKAHEAD_KM = 2;
    const MANEUVER_ANGLE_THRESHOLD = 35;
    const MANEUVER_WINDOW_KM = 0.15;
    const ROUTE_PROGRESS_WINDOW_BACK = 12;
    const ROUTE_PROGRESS_WINDOW_FORWARD = 35;
    const ROUTE_GUIDANCE_DEBUG_PREFIX = "[Route Guidance Debug]";
    const { getGameLocationName, getWorkerCityData } = useCityData();
    const { getClosestNodes, isGraphReady } = useGraphSystem();
    const { settings, activeSettings, updateGlobal, updateProfile } =
        useSettings();

    const currentRoutePath = shallowRef<[number, number][] | null>(null);
    const routeStatsCache = shallowRef<Float32Array | null>(null);
    const cityScaleNodes = shallowRef<SimpleCityNode[] | null>(null);

    const destinationName = ref<string>("");
    const routeDistance = ref<number>(0);
    const routeEta = ref<string>("");
    const nextTurnInstruction = ref<string>("");

    const savedDestination = ref<[number, number] | null>(null);

    const isRouteActive = ref(false);
    const isYardStart = ref(false);

    const isTruckInYard = ref(false);

    const startNodeId = ref<number | null>(null);
    const endNodeId = ref<number | null>(null);
    const lastMathPos = ref<[number, number] | null>(null);

    const isCalculating = ref(false);
    const routeFound = ref<boolean | null>(null);

    const currentRouteIndex = ref(0);
    const isWorkerReady = ref(false);

    function hasGraphDataReady() {
        return (
            isGraphReady.value &&
            adjacency.size > 0 &&
            nodeCoords.size > 0
        );
    }

    function canUseRouting() {
        return hasGraphDataReady() && isWorkerReady.value;
    }

    function formatGuidanceDistance(distanceKm: number) {
        if (activeSettings.value.units === "imperial") {
            const miles = distanceKm * 0.621371;
            if (miles < 0.2) {
                const feet = Math.max(
                    50,
                    Math.round((miles * 5280) / 50) * 50,
                );
                return `${feet} ft`;
            }

            return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
        }

        if (distanceKm < 1) {
            const meters = Math.max(
                50,
                Math.round((distanceKm * 1000) / 50) * 50,
            );
            return `${meters} m`;
        }

        return `${distanceKm < 1 ? distanceKm.toFixed(2) : distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`;
    }

    function getOutsideCityPerceptionScale() {
        return settings.value.selectedGame === "ets2" ? 20 : 19;
    }

    function convertGeoToGameCoords(coords: [number, number]): [number, number] {
        return settings.value.selectedGame === "ets2"
            ? convertGeoToEts2(coords[0], coords[1])
            : convertGeoToAts(coords[0], coords[1]);
    }

    function getPerceivedScaleMultiplier(gameX: number, gameZ: number) {
        const cities = cityScaleNodes.value;

        if (cities) {
            for (let i = 0; i < cities.length; i++) {
                const city = cities[i]!;
                const dx = gameX - city.x;
                const dy = gameZ - city.z;

                if (dx * dx + dy * dy < city.radius * city.radius) {
                    return 3;
                }
            }
        }

        return getOutsideCityPerceptionScale();
    }

    function getPerceivedSegmentDistanceKm(
        fromCoords: [number, number],
        toCoords: [number, number],
    ) {
        const fromPoint = convertGeoToGameCoords(fromCoords);
        const toPoint = convertGeoToGameCoords(toCoords);

        const dx = toPoint[0] - fromPoint[0];
        const dy = toPoint[1] - fromPoint[1];
        const rawSegmentLength = Math.sqrt(dx * dx + dy * dy);

        const midX = (fromPoint[0] + toPoint[0]) / 2;
        const midZ = (fromPoint[1] + toPoint[1]) / 2;
        const multiplier = getPerceivedScaleMultiplier(midX, midZ);

        return (rawSegmentLength * multiplier) / 1000;
    }

    function getPerceivedDistanceToVertex(
        path: [number, number][] | null,
        startIndex: number,
        projectedStart: [number, number] | null,
        vertexIndex: number,
    ) {
        if (
            !path ||
            !projectedStart ||
            startIndex < 0 ||
            vertexIndex <= startIndex ||
            startIndex >= path.length - 1 ||
            vertexIndex >= path.length
        ) {
            return 0;
        }

        let totalKm = 0;

        for (
            let segmentIndex = startIndex;
            segmentIndex < vertexIndex;
            segmentIndex++
        ) {
            const segmentStart =
                segmentIndex === startIndex
                    ? projectedStart
                    : path[segmentIndex]!;
            const segmentEnd = path[segmentIndex + 1]!;

            totalKm += getPerceivedSegmentDistanceKm(segmentStart, segmentEnd);
        }

        return totalKm;
    }

    function getPointAtDistance(
        path: [number, number][],
        startIndex: number,
        direction: -1 | 1,
        targetKm: number,
    ) {
        let travelled = 0;
        let cursor = startIndex;

        while (cursor + direction >= 0 && cursor + direction < path.length) {
            const from = path[cursor]!;
            const to = path[cursor + direction]!;
            travelled += distance(point(from), point(to), {
                units: "kilometers",
            });

            cursor += direction;
            if (travelled >= targetKm) {
                return path[cursor]!;
            }
        }

        return path[Math.max(0, Math.min(path.length - 1, cursor))]!;
    }

    function getManeuverAngle(path: [number, number][], vertexIndex: number) {
        if (vertexIndex <= 0 || vertexIndex >= path.length - 1) return 0;

        const before = getPointAtDistance(
            path,
            vertexIndex,
            -1,
            MANEUVER_WINDOW_KM,
        );
        const after = getPointAtDistance(
            path,
            vertexIndex,
            1,
            MANEUVER_WINDOW_KM,
        );

        return getSignedAngle(before, path[vertexIndex]!, after);
    }

    function getRouteProjection(
        path: [number, number][],
        coords: [number, number],
        aroundIndex: number,
    ) {
        if (path.length < 2) return null;

        const windowStart = Math.max(
            0,
            aroundIndex - ROUTE_PROGRESS_WINDOW_BACK,
        );
        const windowEnd = Math.min(
            path.length - 1,
            aroundIndex + ROUTE_PROGRESS_WINDOW_FORWARD,
        );
        const windowPath = path.slice(windowStart, windowEnd + 1);
        if (windowPath.length < 2) return null;

        const snapped = nearestPointOnLine(
            lineString(windowPath),
            point(coords),
            { units: "kilometers" },
        ) as any;

        const localSegmentIndex = Number(snapped.properties?.index ?? 0);
        const segmentIndex = Math.max(
            windowStart,
            Math.min(windowStart + localSegmentIndex, path.length - 2),
        );
        const projectedCoords = snapped.geometry.coordinates as [
            number,
            number,
        ];
        const segmentFraction = getProjectedSegmentFraction(
            projectedCoords,
            path[segmentIndex]!,
            path[segmentIndex + 1]!,
        );

        const cache = routeStatsCache.value;
        const currentVertexKm = cache?.[segmentIndex * 2] ?? 0;
        const nextVertexKm =
            cache?.[(segmentIndex + 1) * 2] ?? currentVertexKm;
        const currentVertexHours = cache?.[segmentIndex * 2 + 1] ?? 0;
        const nextVertexHours =
            cache?.[(segmentIndex + 1) * 2 + 1] ?? currentVertexHours;

        const projectedRouteKm =
            currentVertexKm +
            Math.max(0, nextVertexKm - currentVertexKm) * segmentFraction;
        const projectedRouteHours =
            currentVertexHours +
            Math.max(0, nextVertexHours - currentVertexHours) *
                segmentFraction;

        return {
            segmentIndex,
            projectedCoords,
            segmentFraction,
            projectedRouteKm,
            projectedRouteHours,
        };
    }

    function getProjectedSegmentFraction(
        p: [number, number],
        v: [number, number],
        w: [number, number],
    ) {
        const l2 = getSquaredDist(v, w);
        if (l2 === 0) return 0;

        let t =
            ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) /
            l2;
        t = Math.max(0, Math.min(1, t));
        return t;
    }

    function getProjectedRouteDistance(
        path: [number, number][],
        cache: Float32Array | null,
        startIndex: number,
        projectedStart: [number, number],
    ) {
        if (!cache || startIndex >= path.length - 1) {
            return 0;
        }

        const currentVertexKm = cache[startIndex * 2] ?? 0;
        const nextVertexKm = cache[(startIndex + 1) * 2] ?? currentVertexKm;
        const segmentKm = Math.max(0, nextVertexKm - currentVertexKm);
        const segmentFraction = getProjectedSegmentFraction(
            projectedStart,
            path[startIndex]!,
            path[startIndex + 1]!,
        );

        return currentVertexKm + segmentKm * segmentFraction;
    }

    function getDistanceToVertex(
        cache: Float32Array | null,
        vertexIndex: number,
        projectedRouteKm: number,
    ) {
        if (!cache) {
            return { targetRouteKm: projectedRouteKm, distanceKm: 0 };
        }

        const targetRouteKm = cache[vertexIndex * 2] ?? projectedRouteKm;

        return {
            targetRouteKm,
            distanceKm: Math.max(0, targetRouteKm - projectedRouteKm),
        };
    }

    function buildNextTurnInstruction(
        path: [number, number][],
        projection: {
            segmentIndex: number;
            projectedCoords: [number, number];
            projectedRouteKm: number;
        } | null,
        currentCoords: [number, number] | null,
    ) {
        if (path.length < 2) return "";

        const startIndex = projection?.segmentIndex ?? currentRouteIndex.value;
        if (startIndex >= path.length - 1) return "";

        const segmentStart = path[startIndex]!;
        const segmentEnd = path[startIndex + 1]!;
        const projectedStart =
            projection?.projectedCoords ??
            (currentCoords && startIndex < path.length - 1
                ? projectPointToSegment(currentCoords, segmentStart, segmentEnd)
                : null);
        const projectedRouteKm =
            projection?.projectedRouteKm ??
            (projectedStart
                ? getProjectedRouteDistance(
                      path,
                      routeStatsCache.value,
                      startIndex,
                      projectedStart,
                  )
                : 0);

        for (
            let vertexIndex = startIndex + 1;
            vertexIndex < path.length - 1;
            vertexIndex++
        ) {
            const angle = getManeuverAngle(path, vertexIndex);

            if (Math.abs(angle) >= MANEUVER_ANGLE_THRESHOLD) {
                const rawDistanceKm = getDistanceToVertex(
                    routeStatsCache.value,
                    vertexIndex,
                    projectedRouteKm,
                ).distanceKm;
                const distanceKm = getPerceivedDistanceToVertex(
                    path,
                    startIndex,
                    projectedStart,
                    vertexIndex,
                );
                const displayDivisor =
                    settings.value.selectedGame === "ets2" ? 20 : 7;
                const displayedDistanceKm = distanceKm / displayDivisor;
                const finalInstruction =
                    distanceKm > MAX_NEXT_TURN_LOOKAHEAD_KM
                        ? "Continue on route"
                        : `${angle > 0 ? "Turn right" : "Turn left"} in ${formatGuidanceDistance(displayedDistanceKm)}`;

                console.debug(ROUTE_GUIDANCE_DEBUG_PREFIX, "maneuver", {
                    currentRouteIndex: startIndex,
                    maneuverVertexIndex: vertexIndex,
                    projectedPoint: projectedStart
                        ? projectedStart.map((v) => Number(v.toFixed(6)))
                        : null,
                    projectedRouteDistance: Number(projectedRouteKm.toFixed(3)),
                    rawRouteManeuverDistance: Number(rawDistanceKm.toFixed(3)),
                    perceivedManeuverDistance: Number(
                        distanceKm.toFixed(3),
                    ),
                    displayedManeuverDistance: Number(
                        displayedDistanceKm.toFixed(3),
                    ),
                    finalInstruction,
                });

                return finalInstruction;
            }
        }

        return "Continue on route";
    }

    function setNextTurnInstruction(
        source: string,
        value: string,
        details: Record<string, unknown> = {},
    ) {
        const previousValue = nextTurnInstruction.value;
        nextTurnInstruction.value = value;

        console.debug(ROUTE_GUIDANCE_DEBUG_PREFIX, "nextTurnInstruction:update", {
            source,
            previousValue,
            nextValue: value,
            ...details,
        });
    }

    function refreshNextTurnInstruction(
        currentCoords: [number, number] | null = null,
        projectionOverride: {
            segmentIndex: number;
            projectedCoords: [number, number];
            projectedRouteKm: number;
        } | null = null,
        source = "refreshNextTurnInstruction",
    ) {
        if (!hasGraphDataReady() || !currentRoutePath.value) {
            setNextTurnInstruction(`${source}:missing-route`, "", {
                hasGraphDataReady: hasGraphDataReady(),
                hasCurrentRoutePath: !!currentRoutePath.value,
            });
            return;
        }

        const projection =
            projectionOverride ??
            (currentCoords && currentRoutePath.value.length > 1
                ? getRouteProjection(
                      currentRoutePath.value,
                      currentCoords,
                      currentRouteIndex.value,
                  )
                : null);

        const instruction = buildNextTurnInstruction(
            currentRoutePath.value,
            projection,
            currentCoords,
        );

        setNextTurnInstruction(source, instruction, {
            usedProjectionOverride: !!projectionOverride,
            projectionSegmentIndex: projection?.segmentIndex ?? null,
            projectedRouteKm:
                projection?.projectedRouteKm != null
                    ? Number(projection.projectedRouteKm.toFixed(3))
                    : null,
        });
    }

    watch(
        () => activeSettings.value.themeColor,
        async (newColor) => {
            if (map.value && map.value.hasImage("destination-icon")) {
                const newPinImg = await generateDestinationIcon(newColor);
                map.value.updateImage("destination-icon", newPinImg);
            }
        },
    );
    watch(
        () => activeSettings.value.routeColor,
        (newColor) => {
            if (map.value && map.value.getLayer("route-line")) {
                map.value.setPaintProperty(
                    "route-line",
                    "line-color",
                    newColor,
                );
            }
        },
    );
    watch(
        () => activeSettings.value.units,
        () => {
            refreshNextTurnInstruction(lastMathPos.value, null, "units-watch");
        },
    );

    let worker: Worker | null = null;
    if (import.meta.client) {
        worker = new Worker(
            new URL("~/workers/route.worker.ts", import.meta.url),
            { type: "module" },
        );

        worker.onmessage = (e) => {
            if (e.data.type === "READY") console.log("Web Worker Ready.");
        };
    }

    function destroyWorker() {
        if (worker) {
            worker.terminate();
            worker = null;
        }
    }

    function initWorkerData(nodesArray: any[], edgesArray: any[]) {
        if (!worker) return;

        const cityPayload = getWorkerCityData();
        cityScaleNodes.value = cityPayload ?? null;

        worker.postMessage({
            type: "INIT_GRAPH",
            payload: {
                nodes: nodesArray,
                edges: edgesArray,
                cities: cityPayload,
            },
        });

        isWorkerReady.value = true;
    }

    function projectPointToSegment(
        p: [number, number],
        v: [number, number],
        w: [number, number],
    ): [number, number] {
        const l2 = getSquaredDist(v, w);
        if (l2 === 0) return [v[0], v[1]];
        let t =
            ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) /
            l2;
        t = Math.max(0, Math.min(1, t));
        return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
    }

    let lastPrefabCheckTime = 0;
    let lastPrefabCheckResult = false;
    function isPositionInPrefab(coords: [number, number]): boolean {
        const now = Date.now();
        if (now - lastPrefabCheckTime < 2000) {
            return lastPrefabCheckResult;
        }
        lastPrefabCheckTime = now;

        if (!map.value || !map.value.getLayer("prefab-zones")) {
            lastPrefabCheckResult = false;
            return false;
        }

        try {
            const screenPt = map.value.project(coords);
            const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
                [screenPt.x - 20, screenPt.y - 20],
                [screenPt.x + 20, screenPt.y + 20],
            ];

            const features = map.value.queryRenderedFeatures(bbox, {
                layers: ["prefab-zones"],
            });
            lastPrefabCheckResult = features.length > 0;
            return lastPrefabCheckResult;
        } catch (e) {
            lastPrefabCheckResult = false;
            return false;
        }
    }

    function getSnappedCoords(
        truckCoords: [number, number],
        truckHeading: number,
    ): [number, number] {
        if (!hasGraphDataReady()) {
            setNextTurnInstruction("getSnappedCoords:no-graph", "", {
                truckCoords,
            });
            return truckCoords;
        }

        isTruckInYard.value = isPositionInPrefab(truckCoords);

        if (isTruckInYard.value) {
            return truckCoords;
        }

        if (
            isRouteActive.value &&
            currentRoutePath.value &&
            currentRoutePath.value.length > 1
        ) {
            const path = currentRoutePath.value;
            const idx = currentRouteIndex.value;

            let bestProj = truckCoords;
            let minSqDist = Infinity;
            let bestSegmentHeading = 0;

            const searchLimit = Math.min(path.length - 1, idx + 4);
            const startSearch = Math.max(0, idx - 1);

            for (let i = startSearch; i < searchLimit; i++) {
                const proj = projectPointToSegment(
                    truckCoords,
                    path[i]!,
                    path[i + 1]!,
                );
                const distSq = getSquaredDist(truckCoords, proj);

                if (distSq < minSqDist) {
                    minSqDist = distSq;
                    bestProj = proj;
                    bestSegmentHeading = getBearing(path[i]!, path[i + 1]!);
                }
            }

            const distKm = Math.sqrt(minSqDist) * 111;

            let hDiff = Math.abs(truckHeading - bestSegmentHeading);
            while (hDiff > 180) hDiff = 360 - hDiff;
            const trueDiff = hDiff > 90 ? 180 - hDiff : hDiff;

            if (distKm < 0.4 && trueDiff < 35) {
                return bestProj;
            }
        }

        const config = findBestStartConfiguration(truckCoords, truckHeading, 2);

        if (!config || !config.projectedCoords) {
            return truckCoords;
        }

        const distSq = getSquaredDist(truckCoords, config.projectedCoords);
        const distKm = Math.sqrt(distSq) * 111;

        if (distKm < 0.1) {
            return config.projectedCoords;
        }

        return truckCoords;
    }

    function calculateRouteInWorker(
        startId: number,
        possibleEnds: number[],
        heading: number,
        startType: string,
        targetCoords: [number, number],
        projectedStartCoords: [number, number],
        ownedDlcs: number[],
    ): Promise<any> {
        return new Promise((resolve) => {
            if (!worker) {
                resolve(null);
                return;
            }

            const handler = (e: MessageEvent) => {
                if (e.data.type === "RESULT") {
                    worker!.removeEventListener("message", handler);
                    resolve(e.data.payload);
                }
            };

            worker.addEventListener("message", handler);

            worker.postMessage({
                type: "CALC_ROUTE",
                payload: {
                    startId,
                    possibleEnds,
                    heading,
                    startType,
                    targetCoords,
                    projectedStartCoords,
                    ownedDlcs,
                    selectedGame: settings.value.selectedGame,
                },
            });
        });
    }

    function findBestStartConfiguration(
        truckCoords: [number, number],
        truckHeading: number,
        _ignoredLimit: number = 20,
    ) {
        if (!hasGraphDataReady()) {
            return null;
        }

        const nearbyNodes = getClosestNodes(truckCoords, 5, 0.1);

        if (nearbyNodes.length === 0) {
            return null;
        }

        let bestEdge = null;
        let minScore = Infinity;

        for (const fromNodeId of nearbyNodes) {
            const neighbors = adjacency.get(fromNodeId);
            const fromPos = nodeCoords.get(fromNodeId);
            if (!neighbors || !fromPos) continue;

            for (const edge of neighbors) {
                const toPos = nodeCoords.get(edge.to);
                if (!toPos) continue;

                let roadBearing = getBearing(fromPos, toPos);

                let diff = Math.abs(truckHeading - roadBearing);
                if (diff > 180) diff = 360 - diff;

                const isOpposite = diff > 90;
                const trueDiff = isOpposite ? 180 - diff : diff;
                if (trueDiff > 45) continue;

                const visualRoadBearing = isOpposite
                    ? (roadBearing + 180) % 360
                    : roadBearing;

                const projected = projectPointToSegment(
                    truckCoords,
                    fromPos,
                    toPos,
                );
                const distSq = getSquaredDist(truckCoords, projected);
                const distKm = Math.sqrt(distSq) * 111;

                const headingPenalty = Math.pow(trueDiff / 90, 2) * 0.1;
                const directionPenalty = isOpposite ? 0.05 : 0;

                const score = distKm + headingPenalty + directionPenalty;

                if (score < minScore) {
                    minScore = score;
                    bestEdge = {
                        type: "road",
                        fromId: fromNodeId,
                        toId: edge.to,
                        projectedCoords: projected,
                        bearing: visualRoadBearing,
                    };
                }
            }
        }

        if (bestEdge) return bestEdge;

        const yardCandidates = getClosestNodes(truckCoords, 2, 0.3);
        let closestNodeId: number | null = null;
        let minNodeDist = Infinity;

        for (const nodeId of yardCandidates) {
            const nodePos = nodeCoords.get(nodeId);
            if (!nodePos) continue;

            const distSq = getSquaredDist(truckCoords, nodePos);
            if (distSq < minNodeDist) {
                minNodeDist = distSq;
                closestNodeId = nodeId;
            }
        }

        if (closestNodeId !== null) {
            const nodePos = nodeCoords.get(closestNodeId);
            if (!nodePos) return;

            return {
                type: "yard",
                fromId: closestNodeId,
                toId: closestNodeId,
                projectedCoords: nodePos,
            };
        }

        return null;
    }

    async function findFlexibleRoute(
        startNodeId: number,
        targetCoords: [number, number],
        truckHeading: number,
        startType: "road" | "yard",
        projectedStartCoords: [number, number],
    ) {
        const SEARCH_RADII = [1, 2, 4, 8, 16, 32, 100, 300];
        const userDlcs = toRaw(activeSettings.value.ownedDlcs);

        for (const radius of SEARCH_RADII) {
            const candidates = getClosestNodes(targetCoords, radius, 0.1);

            if (candidates.length === 0) continue;

            const result = await calculateRouteInWorker(
                startNodeId,
                candidates,
                truckHeading,
                startType,
                targetCoords,
                projectedStartCoords,
                userDlcs,
            );

            if (result) {
                return result;
            }
        }

        return null;
    }

    function drawRouteOnMap(coords: [number, number][]) {
        if (!map.value) return;

        const rawMap = toRaw(map.value);
        setMapLibreData(rawMap, "route-line", "LineString", toRaw(coords));
    }

    function addDestinationMarker(nodeId: number) {
        const endLocation = nodeCoords.get(nodeId);
        if (!endLocation || !map.value) return;

        setMapLibreData(map.value, "destination-source", "Point", endLocation);
    }

    async function setupRouteLayer() {
        if (!map.value) return;
        if (map.value.getSource("route-line")) return;

        if (!map.value.hasImage("destination-icon")) {
            const pinImg = await generateDestinationIcon(
                activeSettings.value.themeColor,
            );
            map.value.addImage("destination-icon", pinImg, { pixelRatio: 2.5 });
        }

        map.value.addSource("route-line", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });

        map.value.addLayer(
            {
                id: "route-line",
                type: "line",
                source: "route-line",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": activeSettings.value.routeColor,
                    "line-width": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        10,
                        8,
                        10.2,
                        9,
                        10.5,
                        6,
                        11.5,
                        11,
                    ],
                },
            },
            "all-sprites",
        );

        if (!map.value.getSource("destination-source")) {
            map.value.addSource("destination-source", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
            });

            map.value.addLayer({
                id: "destination-layer",
                type: "symbol",
                source: "destination-source",
                layout: {
                    "icon-image": "destination-icon",
                    "icon-anchor": "bottom",
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                },
            });

            map.value.on("click", "destination-layer", () => {
                clearRouteState();
            });
            map.value.on("mouseenter", "destination-layer", () => {
                map.value!.getCanvas().style.cursor = "pointer";
            });
            map.value.on("mouseleave", "destination-layer", () => {
                map.value!.getCanvas().style.cursor = "";
            });
        }
    }

    async function handleRouteClick(
        clickCoords: [number, number],
        truckCoords: [number, number],
        truckHeading: number,
        createEndMarker: boolean,
    ) {
        if (!canUseRouting() || isCalculating.value) return;

        isCalculating.value = true;
        routeFound.value = null;

        savedDestination.value = clickCoords;

        try {
            const startConfig = findBestStartConfiguration(
                truckCoords,
                truckHeading,
                10,
            );

            if (!startConfig) return;
            isYardStart.value = startConfig.type === "yard";

            startNodeId.value = startConfig.toId;
            const result = await findFlexibleRoute(
                startNodeId.value!,
                toRaw(clickCoords),
                truckHeading,
                startConfig.type as "road" | "yard",
                startConfig.projectedCoords,
            );

            if (result) {
                isRouteActive.value = true;

                endNodeId.value = result.endId;

                const frozenRawPath = Object.freeze(result.rawPath);
                currentRoutePath.value = frozenRawPath as any;

                routeStatsCache.value = result.stats;

                const cache = result.stats;
                const lastIdx = (result.rawPath.length - 1) * 2;
                const totalKm = cache[lastIdx]!;
                const totalHours = cache[lastIdx + 1]!;

                drawRouteOnMap(result.displayPath);
                if (createEndMarker) addDestinationMarker(result.endId);

                routeDistance.value = Math.round(totalKm);
                const h = Math.floor(totalHours);
                const m = Math.round((totalHours - h) * 60);
                routeEta.value = `${h}h ${m}min`;

                destinationName.value = getGameLocationName(
                    clickCoords[0],
                    clickCoords[1],
                );

                routeFound.value = true;
                currentRouteIndex.value = 0;
                refreshNextTurnInstruction(
                    truckCoords,
                    null,
                    "handleRouteClick",
                );
                updateProfile("lastDestination", savedDestination.value);
            } else {
                routeFound.value = false;
            }
        } catch (e) {
            console.log(`Route calculation Failed: ${e}`);
            isRouteActive.value = false;
        } finally {
            isCalculating.value = false;
        }
    }

    const lastRecalcTime = ref(0);
    const updateRouteProgress = (
        truckCoords: [number, number],
        truckHeading: number,
    ) => {
        if (!currentRoutePath.value || currentRoutePath.value.length < 2)
            return;
        const cache = routeStatsCache.value;
        if (!cache) return;

        if (lastMathPos.value) {
            const sqDist = getSquaredDist(lastMathPos.value, truckCoords);
            if (sqDist < 0.000000002) return;
        }
        lastMathPos.value = truckCoords;

        const path = currentRoutePath.value;
        const previousIndex = currentRouteIndex.value;
        const projection = getRouteProjection(path, truckCoords, previousIndex);
        if (!projection) return;

        const bestIndex = projection.segmentIndex;
        const minSqDist = getSquaredDist(
            truckCoords,
            projection.projectedCoords,
        );
        const jumpedForward = bestIndex > previousIndex + 1;

        console.debug(ROUTE_GUIDANCE_DEBUG_PREFIX, "progress", {
            previousIndex,
            currentRouteIndex: bestIndex,
            jumpedForward,
            projectedPoint: projection.projectedCoords.map((v) =>
                Number(v.toFixed(6)),
            ),
            projectedRouteDistance: Number(
                projection.projectedRouteKm.toFixed(3),
            ),
        });

        currentRouteIndex.value = bestIndex;
        refreshNextTurnInstruction(
            truckCoords,
            projection,
            "updateRouteProgress",
        );
        const now = Date.now();
        if (now - lastRecalcTime.value < 5000) return;

        let activeThreshold = DEVIATION_THRESHOLD_SQ;

        if (isTruckInYard.value) {
            activeThreshold = 0.05;
        } else if (isYardStart.value) {
            if (bestIndex > 0) {
                isYardStart.value = false;
            } else {
                activeThreshold = 0.005;
            }
        }

        if (minSqDist > activeThreshold) {
            if (!isCalculating.value && savedDestination.value) {
                lastRecalcTime.value = now;
                console.log("Deviation detected! Recalculating...");
                handleRouteClick(
                    toRaw(savedDestination.value),
                    truckCoords,
                    truckHeading,
                    false,
                );
                return;
            }
        }

        const distToEndSq = getSquaredDist(truckCoords, path[path.length - 1]!);
        if (distToEndSq < 0.000005) {
            clearRouteState();
            return;
        }

        const lastIdx = (path.length - 1) * 2;

        const totalKm = cache[lastIdx]!;
        const totalHours = cache[lastIdx + 1]!;

        const remKm = totalKm - projection.projectedRouteKm;
        const remHours = totalHours - projection.projectedRouteHours;

        routeDistance.value = Math.round(remKm);

        if (remHours > 0) {
            const h = Math.floor(remHours);
            const m = Math.round((remHours - h) * 60);
            routeEta.value = `${h}h ${m}min`;
        } else {
            routeEta.value = "Arriving...";
        }
    };

    function clearRouteState() {
        if (!map.value) return;

        deleteMapLibreData(map.value, "route-line");
        deleteMapLibreData(map.value, "destination-source");

        isRouteActive.value = false;
        endNodeId.value = null;
        currentRoutePath.value = null;
        savedDestination.value = null;
        isYardStart.value = false;
        setNextTurnInstruction("clearRouteState", "", {});
        updateProfile("lastDestination", null);
    }

    return {
        worker,
        destinationName,
        routeDistance,
        routeEta,
        nextTurnInstruction,
        isCalculating,
        routeFound,
        currentRoutePath,
        isWorkerReady,
        isRouteActive,
        initWorkerData,
        destroyWorker,
        setupRouteLayer,
        handleRouteClick,
        findBestStartConfiguration,
        updateRouteProgress,
        getSnappedCoords,
        clearRouteState,
    };
};
